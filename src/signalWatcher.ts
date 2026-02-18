import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export type AgentSignal = 'start' | 'stop';

const SIGNAL_FILE = 'cursor-puzzle-signal';
const DEBOUNCE_MS = 80;

export class SignalWatcher implements vscode.Disposable {
  private readonly _onSignal = new vscode.EventEmitter<AgentSignal>();
  readonly onSignal = this._onSignal.event;

  readonly signalPath: string;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.signalPath = path.join(os.tmpdir(), SIGNAL_FILE);
  }

  start(): void {
    if (!fs.existsSync(this.signalPath)) {
      fs.writeFileSync(this.signalPath, '', 'utf-8');
    }

    this.watcher = fs.watch(this.signalPath, () => {
      // Debounce: a single write can trigger multiple events on some OS
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => this.readSignal(), DEBOUNCE_MS);
    });

    this.watcher.on('error', () => {
      // Silently ignore watch errors — file may be temporarily unavailable
    });
  }

  private readSignal(): void {
    try {
      const raw = fs.readFileSync(this.signalPath, 'utf-8').trim();
      if (raw === 'start' || raw === 'stop') {
        this._onSignal.fire(raw);
      }
    } catch {
      // File may not exist momentarily during write
    }
  }

  dispose(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.watcher?.close();
    this._onSignal.dispose();
    try {
      fs.unlinkSync(this.signalPath);
    } catch {
      // Already gone
    }
  }
}
