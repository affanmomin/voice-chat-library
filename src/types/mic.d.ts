import { EventEmitter } from "node:events";
import { Readable } from "node:stream";

declare namespace Mic {
  export interface MicOptions {
    rate?: string;
    channels?: string;
    bitwidth?: string;
    encoding?: string;
    endian?: string;
    device?: string;
    exitOnSilence?: number;
    debug?: boolean;
    fileType?: string;
  }

  export interface MicInstance extends EventEmitter {
    start(): void;
    stop(): void;
    pause(): void;
    resume(): void;
    getAudioStream(): Readable;
  }
}

/** CJS factory function returned by the real library */
declare function mic(options?: Mic.MicOptions): Mic.MicInstance;

export = mic;
