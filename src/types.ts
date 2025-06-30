// src/types.ts
export type TranscriptChunk = {
  text: string;
  isFinal: boolean;
  start?: number;
  end?: number;
};

export type TokenChunk = {
  token: string;
  isFinal: boolean;
};

export type AudioChunk = {
  /** raw 16-bit PCM little-endian */
  data: Buffer;
  sampleRate: number; // Allow any sample rate
  isFinal: boolean;
};
