import { STTProvider } from "../providers";
import { TranscriptChunk } from "../types";
import { createClient } from "@deepgram/sdk";

export class DeepgramSTT implements STTProvider {
  private dg = createClient(process.env.DEEPGRAM_API_KEY!);

  constructor(private model = "nova-3") {}

  async *transcribe(
    audio: AsyncIterable<Buffer>
  ): AsyncIterable<TranscriptChunk> {
    const conn = this.dg.listen.live({
      model: this.model,
      interim_results: true,
      smart_format: true,
      vad_events: true,
      endpointing: 2000,
      sample_rate: 48000,
      channels: 1,
      encoding: "linear16",
      punctuate: true,
      language: "en-US",
    });

    const chunks: TranscriptChunk[] = [];
    let isFinished = false;
    let connectionError: Error | null = null;

    conn.on("Results", (data: any) => {
      const alt = data.channel.alternatives[0];
      if (alt && alt.transcript && alt.transcript.trim()) {
        chunks.push({
          text: alt.transcript,
          isFinal: data.is_final,
          start: alt.words[0]?.start ?? 0,
          end: alt.words.at(-1)?.end ?? 0,
        });
      }
    });

    conn.on("close", () => {
      isFinished = true;
    });

    conn.on("error", (error: any) => {
      connectionError = error;
    });

    (async () => {
      for await (const chunk of audio) {
        conn.send(chunk);
      }
      conn.finish();
    })().catch((error) => {
      connectionError = error;
    });

    while (!isFinished && !connectionError) {
      if (chunks.length > 0) {
        yield chunks.shift()!;
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }

    if (connectionError) {
      throw connectionError;
    }

    while (chunks.length > 0) {
      yield chunks.shift()!;
    }
  }
}
