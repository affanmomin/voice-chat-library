// src/index.ts
// @ts-nocheck

import "dotenv/config";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { VoiceBot } from "./engine";
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

console.log("Voice Bot Starting...");
console.log("🔄 Walkie-talkie mode: Only one party speaks at a time\n");

// Speaker setup with larger buffer
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

// Bot and state management
const bot = new VoiceBot(new DeepgramSTT(), new OpenAIChat(), new OpenAITTS());
let isAISpeaking = false;
let isMicrophoneActive = false;
let currentMicInstance = null;
let currentBotProcess: Promise<void> | null = null;

// Create a new microphone instance
function createMicInstance() {
  return mic({
    rate: "48000",
    channels: "1",
    encoding: "signed-integer",
  });
}

// Start microphone and bot processing
function startListening() {
  if (isMicrophoneActive || isAISpeaking) {
    return; // Already listening or AI is speaking
  }

  console.log("🎤 Ready to listen - speak now!");
  isMicrophoneActive = true;

  // Create a fresh microphone instance
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

// Stop microphone completely
function stopListening() {
  if (!isMicrophoneActive) {
    return; // Already stopped
  }

  console.log("🔇 Microphone stopped");
  isMicrophoneActive = false;

  // Abort any ongoing engine processing
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

// Audio chunk handling
function writeAudioChunk(chunk: Buffer) {
  if (chunk.length > 0) {
    try {
      speaker.write(chunk);
    } catch (error) {
      // Ignore audio write errors
    }
  }
}

// Bot event handlers
bot.on("sttChunk", (text) => {
  if (text.trim() && text.length > 2 && !isAISpeaking) {
    process.stdout.write(`\r🎯 Listening: "${text}"`);
  }
});

bot.on("llmToken", (token) => {
  if (!isAISpeaking) {
    console.log("\n🤖 AI Response:");
    isAISpeaking = true;
    stopListening(); // Stop microphone AND abort engine processing
  }
  process.stdout.write(token);
});

bot.on("audioChunk", (chunk) => {
  writeAudioChunk(chunk.data);
});

bot.on("speaking", (isSpeaking) => {
  if (isSpeaking) {
    console.log("\n🔊 AI is speaking... (processing STOPPED)");
    isAISpeaking = true;
    stopListening(); // Ensure everything is stopped
  } else {
    // AI finished speaking - wait a moment then allow user input
    setTimeout(() => {
      console.log("\n✅ AI finished speaking");
      isAISpeaking = false;
      startListening(); // Restart with fresh instance and reset engine
    }, 2000); // Increased delay to ensure audio finishes completely
  }
});

bot.on("metrics", (metrics) => {
  console.log(
    `\n⏱️  STT: ${Math.round(
      metrics.sttCompleteMs
    )}ms | First Token: ${Math.round(metrics.firstTokenMs)}ms\n`
  );
});

// Start the application
console.log("🚀 Voice bot ready!");
startListening();
