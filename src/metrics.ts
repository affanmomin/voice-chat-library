// src/metrics.ts
import { Counter, Histogram, Registry } from "prom-client";

export const registry = new Registry();

export const sttLatency = new Histogram({
  name: "stt_latency_ms",
  help: "STT complete latency",
  buckets: [250, 500, 1000, 2000, 5000],
});
registry.registerMetric(sttLatency);

export const llmFirstToken = new Histogram({
  name: "llm_first_token_ms",
  help: "Latency to first LLM token",
  buckets: [100, 300, 700, 1500, 3000],
});
registry.registerMetric(llmFirstToken);

/* add more… */
