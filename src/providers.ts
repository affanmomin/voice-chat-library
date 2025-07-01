import { TranscriptChunk, TokenChunk, AudioChunk } from "./types";
import { AsyncIterableLike } from "./utils";

/** 1️⃣  Speech-to-Text (STT) */
export interface STTProvider {
  transcribe(stream: AsyncIterableLike<Buffer>): AsyncIterable<TranscriptChunk>;
}

/** 2️⃣  Large Language Model (LLM) */
export interface LLMProvider {
  chat(messages: ChatHistory): AsyncIterable<TokenChunk>;
}

export type ChatHistory = {
  role: "system" | "user" | "assistant";
  content: string;
}[];

/** 3️⃣  Text-to-Speech (TTS) */
export interface TTSProvider {
  synthesize(partialText: AsyncIterableLike<string>): AsyncIterable<AudioChunk>;
}
