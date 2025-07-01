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
  speaking: (isSpeaking: boolean) => void;
}

export interface Metrics {
  sttCompleteMs: number;
  firstTokenMs: number;
  fullAnswerMs: number;
  fullTtsMs: number;
}

export class VoiceBot extends EventEmitter<VoiceBotEvents> {
  private isSpeaking = false;
  private lastResponseTime = 0;
  private minimumTextLength = 3;
  private cooldownPeriod = 1000;
  private abortController: AbortController | null = null;
  private isAborted = false;

  constructor(
    private stt: STTProvider,
    private llm: LLMProvider,
    private tts: TTSProvider
  ) {
    super();
  }

  abort(): void {
    this.isAborted = true;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  reset(): void {
    this.isAborted = false;
    this.abortController = new AbortController();
  }

  async run(audioIn: AsyncIterable<Buffer>): Promise<void> {
    this.reset();
    const history: ChatHistory = [];
    let accumulatedText = "";

    try {
      for await (const chunk of this.stt.transcribe(audioIn)) {
        if (this.isAborted || this.abortController?.signal.aborted) {
          break;
        }

        this.emit("sttChunk", chunk.text);

        if (!chunk.isFinal) {
          accumulatedText = chunk.text;
          continue;
        }

        const finalText =
          chunk.text.length > accumulatedText.length
            ? chunk.text
            : accumulatedText;

        if (!this.shouldProcessText(finalText)) {
          accumulatedText = "";
          continue;
        }

        await this.processUserInput(finalText, history);
        accumulatedText = "";
      }

      if (accumulatedText.trim() && this.shouldProcessText(accumulatedText)) {
        await this.processUserInput(accumulatedText.trim(), history);
      }
    } catch (error) {
      if (!this.isAborted) {
        console.error("Engine error:", error);
      }
    }
  }

  private shouldProcessText(text: string): boolean {
    if (this.isAborted) {
      return false;
    }

    const trimmedText = text.trim();

    if (trimmedText.length < this.minimumTextLength) {
      return false;
    }

    if (this.isSpeaking) {
      return false;
    }

    const timeSinceLastResponse = performance.now() - this.lastResponseTime;
    if (timeSinceLastResponse < this.cooldownPeriod) {
      return false;
    }

    const noisePatterns = [
      /^(uh|um|ah|hmm|er|oh)$/i,
      /^[.,!?;:\s]+$/,
      /^thank you$/i,
      /^thanks$/i,
    ];

    if (noisePatterns.some((pattern) => pattern.test(trimmedText))) {
      return false;
    }

    return true;
  }

  private async processUserInput(
    finalText: string,
    history: ChatHistory
  ): Promise<void> {
    const t0 = performance.now();
    this.isSpeaking = true;
    this.emit("speaking", true);

    try {
      const sttDone = performance.now();
      const tokens: { token: string; time: number; isFinal: boolean }[] = [];
      let firstTokenSent = false;

      const llmStream = this.llm.chat([
        ...history,
        { role: "user", content: finalText },
      ]);

      const ttsInput = this._tokStreamToText(llmStream, tokens);

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

      history.push({ role: "user", content: finalText });
      history.push({
        role: "assistant",
        content: tokens.map((t) => t.token).join(""),
      });

      this.lastResponseTime = performance.now();
    } catch (error) {
      console.error("Processing error:", error);
      throw error;
    } finally {
      this.isSpeaking = false;
      this.emit("speaking", false);
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
