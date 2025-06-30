import "dotenv/config";
import { VoiceBot } from "./engine";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { createReadStream } from "fs";
import { StreamingAudioPlayer } from "./system-audio";

const requiredEnvVars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY"];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
  process.exit(1);
}

async function* readWavFile(filePath: string): AsyncGenerator<Buffer> {
  const stream = createReadStream(filePath);
  let headerSkipped = false;
  let headerBuffer = Buffer.alloc(0);

  for await (const chunk of stream) {
    if (!headerSkipped) {
      headerBuffer = Buffer.concat([headerBuffer, chunk]);

      if (headerBuffer.length >= 44) {
        const sampleRate = headerBuffer.readUInt32LE(24);
        const numChannels = headerBuffer.readUInt16LE(22);
        const bitsPerSample = headerBuffer.readUInt16LE(34);

        console.log(
          `Processing WAV: ${sampleRate}Hz, ${numChannels}ch, ${bitsPerSample}-bit`
        );

        const audioData = headerBuffer.slice(44);
        if (audioData.length > 0) {
          yield audioData;
        }
        headerSkipped = true;
      }
    } else {
      yield chunk;
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
  console.log(`Processing WAV file: ${filePath}`);

  const systemAudio = new StreamingAudioPlayer(24000);
  const bot = new VoiceBot(
    new DeepgramSTT(),
    new OpenAIChat(),
    new OpenAITTS()
  );

  bot.on("sttChunk", (text) => {
    if (text.trim()) {
      console.log(`Transcribed: "${text}"`);
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
    console.log(
      `\nMetrics - STT: ${Math.round(
        metrics.sttCompleteMs
      )}ms | First Token: ${Math.round(metrics.firstTokenMs)}ms\n`
    );
  });

  try {
    const audioStream = readWavFile(filePath);
    const realTimeStream = simulateRealTimeStream(audioStream);

    await bot.run(realTimeStream);

    console.log("Waiting for processing to complete...");
    await new Promise((resolve) => setTimeout(resolve, 3000));

    await systemAudio.finish();
    console.log("File processing completed!");
  } catch (error) {
    console.error("Error processing file:", error);
    await systemAudio.finish();
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
    console.log("Processing completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to process file:", error);
    process.exit(1);
  });
