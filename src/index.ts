// src/index.ts
// @ts-nocheck

import "dotenv/config";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { VoiceBot } from "./engine";
// src/index.ts
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

const micInstance = mic({
  rate: "48000",
  channels: "1",
  encoding: "signed-integer",
});

const recorder = micInstance.getAudioStream();
const speaker = new Speaker({
  sampleRate: 24000,
  channels: 1,
  bitDepth: 16,
});

const bot = new VoiceBot(new DeepgramSTT(), new OpenAIChat(), new OpenAITTS());

bot.on("audioChunk", (chunk) => {
  if (chunk.data.length > 0) {
    speaker.write(chunk.data);
  }
});

bot.on("metrics", (metrics) => {
  console.log(
    `STT: ${Math.round(metrics.sttCompleteMs)}ms | First Token: ${Math.round(
      metrics.firstTokenMs
    )}ms`
  );
});

micInstance.start();
bot.run(recorder).catch(console.error);
