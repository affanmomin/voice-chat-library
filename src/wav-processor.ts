import "dotenv/config";
import { VoiceBot } from "./engine";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { MetricsServer } from "./metrics-server";
import { createReadStream } from "fs";
import { StreamingAudioPlayer } from "./system-audio";
import * as wav from "wav";

const requiredEnvVars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY"];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
  process.exit(1);
}

async function* readWavFile(filePath: string): AsyncGenerator<Buffer> {
  const fileStream = createReadStream(filePath);
  const reader = new wav.Reader();
  let audioBytesYielded = 0;
  let format: any = null;
  const chunks: Buffer[] = [];
  let readerFinished = false;
  let readerError: Error | null = null;

  reader.on("format", (fmt: any) => {
    format = fmt;
  });

  reader.on("data", (chunk: Buffer) => {
    audioBytesYielded += chunk.length;
    chunks.push(chunk);
  });

  reader.on("end", () => {
    readerFinished = true;
  });

  reader.on("error", (error: Error) => {
    readerError = error;
  });

  fileStream.pipe(reader);

  while (!format && !readerError) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  if (readerError) {
    throw readerError;
  }

  while (!readerFinished || chunks.length > 0) {
    if (readerError) {
      throw readerError;
    }

    if (chunks.length > 0) {
      const chunk = chunks.shift()!;
      yield chunk;
    } else {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }
}

async function* simulateRealTimeStream(
  audioStream: AsyncGenerator<Buffer>,
  chunkSizeMs: number = 100
): AsyncGenerator<Buffer> {
  const chunkSize = Math.floor((48000 * 2 * chunkSizeMs) / 1000);

  for await (const chunk of audioStream) {
    for (let i = 0; i < chunk.length; i += chunkSize) {
      const smallChunk = chunk.slice(i, i + chunkSize);
      yield smallChunk;
      await new Promise((resolve) => setTimeout(resolve, chunkSizeMs * 0.8));
    }
  }
}

async function processWavFile(filePath: string) {
  const systemAudio = new StreamingAudioPlayer(24000);
  const metricsServer = new MetricsServer(9464);
  const bot = new VoiceBot(
    new DeepgramSTT(),
    new OpenAIChat(),
    new OpenAITTS()
  );

  await metricsServer.start();

  bot.on("sttChunk", (text) => {
    if (text.trim() && text.length > 2) {
      console.log(`\n🎯 Transcribing: "${text}"`);
    }
  });

  bot.on("llmToken", (token) => {
    process.stdout.write(token);
  });

  bot.on("audioChunk", (chunk) => {
    if (chunk.data.length > 0) {
      systemAudio.playChunk(chunk.data);
    }

    if (chunk.isFinal) {
      systemAudio.finish().catch(console.error);
    }
  });

  bot.on("metrics", (metrics) => {
    const { recordMetrics } = require("./metrics");
    recordMetrics(metrics);

    const parts = [];
    if (typeof metrics.sttCompleteMs === "number")
      parts.push(`STT: ${metrics.sttCompleteMs.toFixed(0)}ms`);
    if (typeof metrics.firstTokenMs === "number")
      parts.push(`First Token: ${metrics.firstTokenMs.toFixed(0)}ms`);
    if (typeof metrics.fullAnswerMs === "number")
      parts.push(`Full LLM: ${metrics.fullAnswerMs.toFixed(0)}ms`);
    if (typeof metrics.fullTtsMs === "number")
      parts.push(`TTS: ${metrics.fullTtsMs.toFixed(0)}ms`);

    if (parts.length > 0) {
      console.log(`\n📊 Metrics - ${parts.join(" | ")}`);
    }
  });

  try {
    const audioStream = readWavFile(filePath);
    const realTimeStream = simulateRealTimeStream(audioStream);

    await bot.run(realTimeStream);

    await new Promise((resolve) => setTimeout(resolve, 3000));

    await systemAudio.finish();
    await metricsServer.stop();
  } catch (error) {
    console.error("Error processing file:", error);
    await systemAudio.finish();
    await metricsServer.stop();
    process.exit(1);
  }
}

const filePath = process.argv[2];

if (!filePath) {
  console.log("Usage: npm run wav <path-to-wav-file>");
  console.log("Example: npm run wav ./audio/test.wav");
  process.exit(1);
}

if (!filePath.toLowerCase().endsWith(".wav")) {
  console.log("Please provide a WAV file (.wav extension)");
  process.exit(1);
}

processWavFile(filePath)
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to process file:", error);
    process.exit(1);
  });
