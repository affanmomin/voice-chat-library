import { spawn } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { join } from "path";

export class SystemAudioPlayer {
  private audioBuffers: Buffer[] = [];
  private tempFile?: string;

  constructor(private sampleRate: number = 24000) {}

  write(chunk: Buffer) {
    if (chunk.length > 0) {
      this.audioBuffers.push(chunk);
    }
  }

  async play() {
    if (this.audioBuffers.length === 0) {
      return;
    }

    const combinedAudio = Buffer.concat(this.audioBuffers);
    const rawFile = join(process.cwd(), "audio", `temp-${Date.now()}.raw`);
    const wavFile = join(process.cwd(), "audio", `temp-${Date.now()}.wav`);
    this.tempFile = wavFile;

    try {
      writeFileSync(rawFile, combinedAudio);

      const soxProcess = spawn(
        "sox",
        [
          "-t",
          "raw",
          "-r",
          this.sampleRate.toString(),
          "-e",
          "signed-integer",
          "-b",
          "16",
          "-c",
          "1",
          rawFile,
          "-t",
          "wav",
          wavFile,
        ],
        {
          stdio: "inherit",
        }
      );

      await new Promise((resolve, reject) => {
        soxProcess.on("close", (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            reject(new Error(`sox failed with code ${code}`));
          }
        });
      });

      try {
        unlinkSync(rawFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      const playProcess = spawn("afplay", [wavFile], {
        stdio: "inherit",
      });

      const playbackPromise = new Promise((resolve) => {
        playProcess.on("close", () => {
          resolve(void 0);
        });
      });

      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve(void 0);
        }, 8000);
      });

      await Promise.race([playbackPromise, timeoutPromise]);
    } catch (error) {
      console.error(
        "Audio playback error:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  close() {
    if (this.tempFile) {
      try {
        unlinkSync(this.tempFile);
      } catch (error) {
        // Ignore cleanup errors
      }
    }
  }
}

export class StreamingAudioPlayer {
  private chunkCount = 0;
  private isFinished = false;
  private tempFiles: string[] = [];
  private audioQueue: { file: string; chunkNumber: number }[] = [];
  private isPlaying = false;
  private currentPlayProcess?: any;

  constructor(private sampleRate: number = 24000) {}

  async playChunk(chunk: Buffer) {
    if (chunk.length === 0 || this.isFinished) return;

    this.chunkCount++;
    const timestamp = Date.now();
    const rawFile = join(
      process.cwd(),
      "audio",
      `stream-${timestamp}-${this.chunkCount}.raw`
    );
    const wavFile = join(
      process.cwd(),
      "audio",
      `stream-${timestamp}-${this.chunkCount}.wav`
    );

    this.tempFiles.push(rawFile, wavFile);

    try {
      writeFileSync(rawFile, chunk);

      const soxProcess = spawn(
        "sox",
        [
          "-t",
          "raw",
          "-r",
          this.sampleRate.toString(),
          "-e",
          "signed-integer",
          "-b",
          "16",
          "-c",
          "1",
          rawFile,
          "-t",
          "wav",
          wavFile,
        ],
        { stdio: "pipe" }
      );

      await new Promise((resolve, reject) => {
        soxProcess.on("close", (code) => {
          if (code === 0) {
            resolve(void 0);
          } else {
            reject(new Error(`sox failed with code ${code}`));
          }
        });
      });

      try {
        unlinkSync(rawFile);
      } catch (e) {
        // Ignore cleanup errors
      }

      this.audioQueue.push({ file: wavFile, chunkNumber: this.chunkCount });

      if (!this.isPlaying) {
        this.startPlaybackQueue();
      }
    } catch (error) {
      console.error(`Error preparing audio chunk ${this.chunkCount}:`, error);
    }
  }

  private async startPlaybackQueue() {
    if (this.isPlaying) return;
    this.isPlaying = true;

    while (this.audioQueue.length > 0 || !this.isFinished) {
      if (this.audioQueue.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        continue;
      }

      const { file, chunkNumber } = this.audioQueue.shift()!;

      try {
        await this.playAudioFile(file, chunkNumber);
      } catch (error) {
        console.error(`Error playing chunk ${chunkNumber}:`, error);
      }

      setTimeout(() => {
        try {
          unlinkSync(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 3000);
    }

    this.isPlaying = false;
  }

  private playAudioFile(file: string, chunkNumber: number): Promise<void> {
    return new Promise((resolve, reject) => {
      this.currentPlayProcess = spawn("afplay", [file], {
        stdio: "pipe",
      });

      let hasResolved = false;

      this.currentPlayProcess.on("close", (code: number) => {
        if (hasResolved) return;
        hasResolved = true;

        if (code === 0 || code === null) {
          resolve();
        } else {
          resolve();
        }
      });

      this.currentPlayProcess.on("error", (error: any) => {
        if (hasResolved) return;
        hasResolved = true;
        resolve();
      });

      setTimeout(() => {
        if (
          !hasResolved &&
          this.currentPlayProcess &&
          !this.currentPlayProcess.killed
        ) {
          // Don't kill the process, let it finish naturally
        }
      }, 30000);
    });
  }

  async finish() {
    this.isFinished = true;

    while (this.audioQueue.length > 0 || this.isPlaying) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setTimeout(() => {
      this.tempFiles.forEach((file) => {
        try {
          unlinkSync(file);
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      this.tempFiles = [];
    }, 2000);
  }
}
