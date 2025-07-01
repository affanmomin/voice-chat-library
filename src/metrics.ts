import { Histogram, Registry } from "prom-client";

export const registry = new Registry();
export const sttLatency = new Histogram({
  name: "stt_duration_ms",
  help: "Speech-to-Text processing duration in milliseconds",
  buckets: [100, 250, 500, 1000, 2000, 5000, 10000],
  registers: [registry],
});

export const ttsLatency = new Histogram({
  name: "tts_duration_ms",
  help: "Text-to-Speech processing duration in milliseconds",
  buckets: [500, 1000, 2000, 5000, 10000, 20000, 30000],
  registers: [registry],
});

export const llmLatency = new Histogram({
  name: "llm_duration_ms",
  help: "LLM response generation duration in milliseconds",
  buckets: [500, 1000, 2000, 5000, 10000, 20000, 30000],
  registers: [registry],
});

export function recordMetrics(metrics: {
  sttCompleteMs?: number;
  firstTokenMs?: number;
  fullAnswerMs?: number;
  fullTtsMs?: number;
}) {
  if (
    typeof metrics.sttCompleteMs === "number" &&
    !isNaN(metrics.sttCompleteMs)
  ) {
    sttLatency.observe(metrics.sttCompleteMs);
  }

  if (
    typeof metrics.fullAnswerMs === "number" &&
    !isNaN(metrics.fullAnswerMs)
  ) {
    llmLatency.observe(metrics.fullAnswerMs);
  }

  if (typeof metrics.fullTtsMs === "number" && !isNaN(metrics.fullTtsMs)) {
    ttsLatency.observe(metrics.fullTtsMs);
  }
}
