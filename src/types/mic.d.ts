declare module "mic" {
  import { EventEmitter } from "node:events";
  import { Readable } from "node:stream";

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

  function mic(options?: MicOptions): MicInstance;
  export = mic;
}
