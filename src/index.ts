// src/index.ts
//@ts-nocheck
import "dotenv/config";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { VoiceBot } from "./engine";
import { MetricsServer } from "./metrics-server";
import mic from "mic";
import Speaker from "speaker";

const requiredEnvVars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY"];
const missingVars = requiredEnvVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  console.error(
    `Missing required environment variables: ${missingVars.join(", ")}`
  );
  process.exit(1);
}

const speaker = new Speaker({
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
  lowWaterMark: 0,
  highWaterMark: 16384,
});

speaker.on("drain", () => {
  // Audio buffer drained, this is normal
});

const bot = new VoiceBot(new DeepgramSTT(), new OpenAIChat(), new OpenAITTS());
const metricsServer = new MetricsServer(9464);
let isAISpeaking = false;
let isMicrophoneActive = false;
let currentMicInstance: ReturnType<typeof mic> | null = null;
let currentBotProcess: Promise<void> | null = null;

function createMicInstance() {
  return mic({
    rate: "48000",
    channels: "1",
    encoding: "signed-integer",
  });
}

function startListening() {
  if (isMicrophoneActive || isAISpeaking) {
    return;
  }

  isMicrophoneActive = true;

  currentMicInstance = createMicInstance();
  const recorder = currentMicInstance.getAudioStream();
  currentMicInstance.start();

  currentBotProcess = bot.run(recorder).catch((error) => {
    if (!error.message?.includes("aborted")) {
      console.error("Bot error:", error);
    }
    stopListening();
  });
}

function stopListening() {
  if (!isMicrophoneActive) {
    return;
  }

  isMicrophoneActive = false;

  bot.abort();

  if (currentMicInstance) {
    try {
      currentMicInstance.stop();
    } catch (error) {
      // Ignore stop errors
    }
    currentMicInstance = null;
  }

  if (currentBotProcess) {
    currentBotProcess = null;
  }
}

function writeAudioChunk(chunk: Buffer) {
  if (chunk.length > 0) {
    try {
      speaker.write(chunk);
    } catch (error) {
      // Ignore audio write errors
    }
  }
}

bot.on("sttChunk", (text) => {
  if (text.trim() && text.length > 2 && !isAISpeaking) {
    process.stdout.write(`\r🎯 Listening: "${text}"`);
  }
});

bot.on("llmToken", (token) => {
  if (!isAISpeaking) {
    isAISpeaking = true;
    stopListening();
  }
  process.stdout.write(token);
});

bot.on("audioChunk", (chunk) => {
  writeAudioChunk(chunk.data);
});

bot.on("speaking", (isSpeaking) => {
  if (isSpeaking) {
    isAISpeaking = true;
    stopListening();
  } else {
    setTimeout(() => {
      isAISpeaking = false;
      startListening();
    }, 2000);
  }
});

bot.on("metrics", (metrics) => {
  // Record metrics to Prometheus
  const { recordMetrics } = require("./metrics");
  recordMetrics(metrics);

  // Optional: Log metrics to console for debugging (only log defined values)
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

// Start metrics server
metricsServer.start().then(() => {
  console.log("🚀 Voice bot started with Prometheus metrics enabled");
  startListening();
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down...");
  bot.abort();
  stopListening();
  await metricsServer.stop();
  process.exit(0);
});
