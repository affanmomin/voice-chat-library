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
  data: Buffer;
  sampleRate: number;
  isFinal: boolean;
};
