import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

const MARKER = 'cursor-puzzle-signal';

interface HookEntry {
  command: string;
  [key: string]: unknown;
}

interface HooksFile {
  version: number;
  hooks: Record<string, HookEntry[]>;
}

export class HookManager {
  constructor(private readonly signalPath: string) {}

  /** Check whether our hooks are already present in the workspace */
  hasHooks(): boolean {
    const hooksFile = this.hooksFilePath();
    if (!hooksFile || !fs.existsSync(hooksFile)) {
      return false;
    }
    try {
      const raw = fs.readFileSync(hooksFile, 'utf-8');
      return raw.includes(MARKER);
    } catch {
      return false;
    }
  }

  /** Add puzzle hooks to .cursor/hooks.json, merging with existing hooks */
  async setupHooks(): Promise<void> {
    const workspaceRoot = this.workspaceRoot();
    if (!workspaceRoot) {
      vscode.window.showErrorMessage('Puzzle: No workspace folder open.');
      return;
    }

    const cursorDir = path.join(workspaceRoot, '.cursor');
    const hooksFile = path.join(cursorDir, 'hooks.json');

    if (!fs.existsSync(cursorDir)) {
      fs.mkdirSync(cursorDir, { recursive: true });
    }

    const existing = this.readHooksFile(hooksFile);

    const startCmd = `echo start > ${this.signalPath}`;
    const stopCmd = `echo stop > ${this.signalPath}`;

    this.addHook(existing, 'beforeSubmitPrompt', { command: startCmd });
    this.addHook(existing, 'stop', { command: stopCmd });
    this.addHook(existing, 'sessionEnd', { command: stopCmd });

    fs.writeFileSync(hooksFile, JSON.stringify(existing, null, 2), 'utf-8');
    vscode.window.showInformationMessage('Puzzle: Agent hooks installed.');
  }

  /** Remove puzzle hooks from .cursor/hooks.json */
  async removeHooks(): Promise<void> {
    const hooksFile = this.hooksFilePath();
    if (!hooksFile || !fs.existsSync(hooksFile)) {
      vscode.window.showInformationMessage('Puzzle: No hooks to remove.');
      return;
    }

    const data = this.readHooksFile(hooksFile);

    for (const key of Object.keys(data.hooks)) {
      data.hooks[key] = data.hooks[key].filter(
        (h) => !h.command.includes(MARKER)
      );
      if (data.hooks[key].length === 0) {
        delete data.hooks[key];
      }
    }

    if (Object.keys(data.hooks).length === 0) {
      fs.unlinkSync(hooksFile);
      vscode.window.showInformationMessage('Puzzle: Hooks removed (file deleted).');
    } else {
      fs.writeFileSync(hooksFile, JSON.stringify(data, null, 2), 'utf-8');
      vscode.window.showInformationMessage('Puzzle: Puzzle hooks removed.');
    }
  }

  // ── private ────────────────────────────────────────────────────

  private addHook(data: HooksFile, hookType: string, entry: HookEntry): void {
    if (!data.hooks[hookType]) {
      data.hooks[hookType] = [];
    }
    const alreadyExists = data.hooks[hookType].some((h) =>
      h.command.includes(MARKER)
    );
    if (!alreadyExists) {
      data.hooks[hookType].push(entry);
    }
  }

  private readHooksFile(filePath: string): HooksFile {
    if (fs.existsSync(filePath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (raw && typeof raw === 'object') {
          return { version: raw.version ?? 1, hooks: raw.hooks ?? {} };
        }
      } catch {
        // Corrupted file — start fresh
      }
    }
    return { version: 1, hooks: {} };
  }

  private hooksFilePath(): string | null {
    const root = this.workspaceRoot();
    return root ? path.join(root, '.cursor', 'hooks.json') : null;
  }

  private workspaceRoot(): string | null {
    const folders = vscode.workspace.workspaceFolders;
    return folders && folders.length > 0 ? folders[0].uri.fsPath : null;
  }
}
