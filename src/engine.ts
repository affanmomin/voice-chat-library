// src/engine.ts
import {
  STTProvider,
  LLMProvider,
  TTSProvider,
  ChatHistory,
} from "./providers";
import { AudioChunk, TokenChunk } from "./types";
import { performance } from "node:perf_hooks";
import { EventEmitter } from "eventemitter3";

export interface VoiceBotEvents {
  sttChunk: (data: string) => void;
  llmToken: (token: string) => void;
  audioChunk: (chunk: AudioChunk) => void;
  metrics: (m: Metrics) => void;
}

export interface Metrics {
  sttCompleteMs: number;
  firstTokenMs: number;
  fullAnswerMs: number;
  fullTtsMs: number;
}

export class VoiceBot extends EventEmitter<VoiceBotEvents> {
  constructor(
    private stt: STTProvider,
    private llm: LLMProvider,
    private tts: TTSProvider
  ) {
    super();
  }

  async run(audioIn: AsyncIterable<Buffer>): Promise<void> {
    const t0 = performance.now();
    const history: ChatHistory = [];
    let accumulatedText = "";
    let lastInterimTime = performance.now();

    for await (const chunk of this.stt.transcribe(audioIn)) {
      this.emit("sttChunk", chunk.text);

      if (!chunk.isFinal) {
        accumulatedText = chunk.text;
        lastInterimTime = performance.now();
        continue;
      }

      const finalText =
        chunk.text.length > accumulatedText.length
          ? chunk.text
          : accumulatedText;

      const sttDone = performance.now();
      const tokens: { token: string; time: number; isFinal: boolean }[] = [];
      let firstTokenSent = false;

      const llmStream = this.llm.chat([
        ...history,
        { role: "user", content: finalText },
      ]);

      const ttsInput = this._tokStreamToText(llmStream, tokens);
      const ttsStart = performance.now();

      for await (const audio of this.tts.synthesize(ttsInput)) {
        if (!firstTokenSent) {
          this.emit("metrics", {
            sttCompleteMs: sttDone - t0,
            firstTokenMs: performance.now() - sttDone,
          } as Partial<Metrics> as Metrics);
          firstTokenSent = true;
        }
        this.emit("audioChunk", audio);
      }

      const fullTtsDone = performance.now();

      this.emit("metrics", {
        sttCompleteMs: sttDone - t0,
        firstTokenMs: tokens.length ? tokens[0].time - sttDone : 0,
        fullAnswerMs: tokens.at(-1)?.time! - t0,
        fullTtsMs: fullTtsDone - t0,
      });

      history.push({
        role: "assistant",
        content: tokens.map((t) => t.token).join(""),
      });

      accumulatedText = "";
    }
  }

  private async *_tokStreamToText(
    src: AsyncIterable<TokenChunk>,
    tokens: { token: string; time: number; isFinal: boolean }[]
  ): AsyncIterable<string> {
    for await (const tok of src) {
      const tokenWithTime = {
        token: tok.token,
        time: performance.now(),
        isFinal: tok.isFinal,
      };
      tokens.push(tokenWithTime);
      this.emit("llmToken", tok.token);
      yield tok.isFinal ? "__FINAL__" : tok.token;
    }
  }
}
