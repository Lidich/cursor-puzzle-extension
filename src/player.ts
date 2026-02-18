import { ChildProcess, spawn } from 'child_process';
import * as path from 'path';

export interface MusicPlayer {
  play(): Promise<void>;
  pause(): Promise<void>;
  readonly playing: boolean;
  dispose(): void;
}

const BUNDLED_TRACK = 'media/puzzle-track.mp3';
const AUDIO_HELPER = 'media/audio-helper.js';

/**
 * Uses macOS NSSound via a JXA helper process.
 * NSSound handles pause/resume at the CoreAudio buffer level,
 * avoiding the clicks that SIGSTOP/SIGCONT cause with afplay.
 */
export class FilePlayer implements MusicPlayer {
  private proc: ChildProcess | null = null;
  private _playing = false;
  private readonly filePath: string;
  private readonly helperPath: string;
  private readonly volume: number;

  constructor(extensionPath: string, volume: number = 0.5) {
    this.filePath = path.join(extensionPath, BUNDLED_TRACK);
    this.helperPath = path.join(extensionPath, AUDIO_HELPER);
    this.volume = volume;
  }

  get playing(): boolean {
    return this._playing;
  }

  async play(): Promise<void> {
    if (this._playing) {
      return;
    }

    if (!this.proc) {
      this.spawnHelper();
    }

    this.send('play');
    this._playing = true;
  }

  async pause(): Promise<void> {
    if (!this._playing || !this.proc) {
      return;
    }
    this.send('pause');
    this._playing = false;
  }

  dispose(): void {
    this._playing = false;
    if (this.proc) {
      this.send('stop');
      this.proc = null;
    }
  }

  private send(cmd: string): void {
    if (this.proc?.stdin?.writable) {
      this.proc.stdin.write(cmd + '\n');
    }
  }

  private spawnHelper(): void {
    this.proc = spawn(
      'osascript',
      ['-l', 'JavaScript', this.helperPath, this.filePath, String(this.volume)],
      { stdio: ['pipe', 'ignore', 'pipe'] }
    );

    this.proc.stderr?.on('data', (data: Buffer) => {
      console.error('[Puzzle audio-helper]', data.toString().trim());
    });

    this.proc.on('exit', () => {
      this.proc = null;
      this._playing = false;
    });

    this.proc.on('error', () => {
      this.proc = null;
      this._playing = false;
    });
  }
}

export function createPlayer(extensionPath: string, volumePercent: number): MusicPlayer {
  const volume = volumePercent / 100;
  return new FilePlayer(extensionPath, volume);
}
