import * as vscode from 'vscode';
import { SignalWatcher } from './signalWatcher';
import { createPlayer, MusicPlayer } from './player';
import { HookManager } from './hookManager';
import { StatusBar } from './statusBar';

let player: MusicPlayer;

const log = vscode.window.createOutputChannel('Puzzle');

export function activate(context: vscode.ExtensionContext): void {
  log.appendLine('[Puzzle] Activating…');
  const signalWatcher = new SignalWatcher();
  const hookManager = new HookManager(signalWatcher.signalPath);
  const statusBar = new StatusBar();

  const volume = vscode.workspace
    .getConfiguration('puzzle')
    .get<number>('volume', 50);
  player = createPlayer(context.extensionPath, volume);

  // ── React to agent signals ────────────────────────────────────

  context.subscriptions.push(
    signalWatcher.onSignal(async (signal) => {
      const enabled = vscode.workspace
        .getConfiguration('puzzle')
        .get<boolean>('enabled', true);
      if (!enabled) {
        return;
      }

      log.appendLine(`[Puzzle] Signal received: ${signal}`);
      try {
        if (signal === 'start') {
          await player.play();
          statusBar.update('playing');
          log.appendLine('[Puzzle] Playing');
        } else {
          await player.pause();
          statusBar.update('paused');
          log.appendLine('[Puzzle] Paused');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.appendLine(`[Puzzle] Player error: ${msg}`);
        vscode.window.showWarningMessage(`Puzzle: Player error — ${msg}`);
      }
    })
  );

  // ── Commands ──────────────────────────────────────────────────

  context.subscriptions.push(
    vscode.commands.registerCommand('puzzle.setupHooks', () =>
      hookManager.setupHooks()
    ),

    vscode.commands.registerCommand('puzzle.removeHooks', () =>
      hookManager.removeHooks()
    ),

    vscode.commands.registerCommand('puzzle.play', async () => {
      try {
        await player.play();
        statusBar.update('playing');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.appendLine(`[Puzzle] Play error: ${msg}`);
        vscode.window.showWarningMessage(`Puzzle: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('puzzle.pause', async () => {
      try {
        await player.pause();
        statusBar.update('paused');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.appendLine(`[Puzzle] Pause error: ${msg}`);
        vscode.window.showWarningMessage(`Puzzle: ${msg}`);
      }
    }),

    vscode.commands.registerCommand('puzzle.toggle', async () => {
      try {
        if (player.playing) {
          await player.pause();
          statusBar.update('paused');
        } else {
          await player.play();
          statusBar.update('playing');
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        log.appendLine(`[Puzzle] Toggle error: ${msg}`);
        vscode.window.showWarningMessage(`Puzzle: ${msg}`);
      }
    })
  );

  // ── Recreate player when settings change ──────────────────────

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('puzzle')) {
        player.dispose();
        const vol = vscode.workspace
          .getConfiguration('puzzle')
          .get<number>('volume', 50);
        player = createPlayer(context.extensionPath, vol);
        statusBar.update('idle');
      }
    })
  );

  // ── Start watcher & prompt for hooks ──────────────────────────

  signalWatcher.start();
  log.appendLine(`[Puzzle] Watching signal file: ${signalWatcher.signalPath}`);
  promptHookSetup(context, hookManager);

  // ── Cleanup ───────────────────────────────────────────────────

  context.subscriptions.push(signalWatcher, statusBar, {
    dispose: () => player.dispose(),
  });
}

export function deactivate(): void {
  // context.subscriptions handles disposal
}

// ── Helpers ───────────────────────────────────────────────────────

async function promptHookSetup(
  context: vscode.ExtensionContext,
  hookManager: HookManager
): Promise<void> {
  if (!vscode.workspace.workspaceFolders?.length) {
    log.appendLine('[Puzzle] No workspace folder — skipping hook prompt');
    return;
  }

  if (hookManager.hasHooks()) {
    log.appendLine('[Puzzle] Hooks already installed');
    return;
  }

  const declined = context.workspaceState.get<boolean>(
    'puzzle.hookSetupDeclined',
    false
  );
  if (declined) {
    return;
  }

  const choice = await vscode.window.showInformationMessage(
    'Puzzle: Set up agent music hooks for this workspace?',
    'Yes',
    'Not now',
    'Never'
  );

  if (choice === 'Yes') {
    await hookManager.setupHooks();
  } else if (choice === 'Never') {
    await context.workspaceState.update('puzzle.hookSetupDeclined', true);
  }
}
