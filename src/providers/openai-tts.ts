import OpenAI from "openai";
import { TTSProvider } from "../providers";
import { AudioChunk } from "../types";

export class OpenAITTS implements TTSProvider {
  private openai = new OpenAI();
  constructor(private model = "tts-1") {}

  private cleanTextForSpeech(text: string): string {
    return text
      .replace(/\n{2,}/g, ". ")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  async *synthesize(
    textParts: AsyncIterable<string>
  ): AsyncIterable<AudioChunk> {
    let buffer = "";
    for await (const part of textParts) {
      buffer += part;

      const shouldSynthesize =
        part === "__FINAL__" ||
        (buffer.length >= 30 &&
          (buffer.endsWith(".") ||
            buffer.endsWith("!") ||
            buffer.endsWith("?") ||
            buffer.endsWith(",") ||
            buffer.includes(". "))) ||
        buffer.length >= 80;

      if (!shouldSynthesize) continue;

      const rawText = buffer.replace("__FINAL__", "").trim();
      if (!rawText) {
        buffer = "";
        continue;
      }

      const cleanText = this.cleanTextForSpeech(rawText);
      if (!cleanText) {
        buffer = "";
        continue;
      }

      const audio = await this.openai.audio.speech.create({
        model: this.model,
        input: cleanText,
        voice: "alloy",
        response_format: "pcm",
      });

      yield {
        data: Buffer.from(await audio.arrayBuffer()),
        sampleRate: 24000,
        isFinal: false,
      };
      buffer = "";
    }

    yield { data: Buffer.alloc(0), sampleRate: 24000, isFinal: true };
  }
}
