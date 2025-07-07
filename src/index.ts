import dotenv from "dotenv";
import { VoiceBot } from "./engine";
import { DeepgramSTT } from "./providers/deepgram";
import { OpenAIChat } from "./providers/openai-llm";
import { OpenAITTS } from "./providers/openai-tts";
import { MicrophoneAudioSource, StreamingAudioPlayer } from "./system-audio";
import { MetricsServer } from "./metrics-server";

dotenv.config();

async function main() {
  const deepgramKey = process.env.DEEPGRAM_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!deepgramKey) {
    console.error("❌ DEEPGRAM_API_KEY environment variable is required");
    process.exit(1);
  }

  if (!openaiKey) {
    console.error("❌ OPENAI_API_KEY environment variable is required");
    process.exit(1);
  }

  console.log("🎙️  Starting Voice Bot...");

  const metricsServer = new MetricsServer(9464);
  await metricsServer.start();
  console.log(
    "📊 Metrics dashboard available at: http://localhost:9464/dashboard"
  );

  const sttProvider = new DeepgramSTT();
  const llmProvider = new OpenAIChat();
  const ttsProvider = new OpenAITTS();

  const bot = new VoiceBot(sttProvider, llmProvider, ttsProvider);

  const audioPlayer = new StreamingAudioPlayer(24000);

  bot.on("sttChunk", (text) => {
    if (text.trim()) {
      console.log(`🎯 Transcribed: ${text}`);
    }
  });

  bot.on("llmToken", (token) => {
    process.stdout.write(token);
  });

  bot.on("audioChunk", (chunk) => {
    if (chunk.data.length > 0) {
      audioPlayer.playChunk(chunk.data);
    }
  });

  bot.on("speaking", (isSpeaking) => {
    if (isSpeaking) {
      console.log("\n🤖 AI is speaking...");
    } else {
      console.log("\n👂 Listening...");
    }
  });

  bot.on("metrics", (metrics) => {
    console.log(
      `\n📈 Performance: STT: ${metrics.sttCompleteMs}ms | First Token: ${metrics.firstTokenMs}ms | Full Response: ${metrics.fullAnswerMs}ms | TTS: ${metrics.fullTtsMs}ms`
    );
  });

  const mic = new MicrophoneAudioSource();

  console.log("🎤 Microphone ready! Start speaking...");
  console.log("💡 Press Ctrl+C to stop");

  process.on("SIGINT", async () => {
    console.log("\n🛑 Shutting down...");
    bot.abort();
    mic.stop();
    await audioPlayer.finish();
    await metricsServer.stop();
    process.exit(0);
  });

  try {
    await bot.run(mic.getAudioStream());
  } catch (error) {
    console.error("❌ Voice bot error:", error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Application error:", error);
  process.exit(1);
});
