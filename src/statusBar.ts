import * as vscode from 'vscode';

export type PuzzleState = 'playing' | 'paused' | 'idle';

export class StatusBar implements vscode.Disposable {
  private readonly item: vscode.StatusBarItem;

  constructor() {
    this.item = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.item.command = 'puzzle.toggle';
    this.update('idle');
    this.item.show();
  }

  update(state: PuzzleState): void {
    switch (state) {
      case 'playing':
        this.item.text = '$(unmute) Puzzle';
        this.item.tooltip = 'Agent is thinking — music playing. Click to pause.';
        break;
      case 'paused':
        this.item.text = '$(mute) Puzzle';
        this.item.tooltip = 'Music paused. Click to play.';
        break;
      case 'idle':
        this.item.text = '$(mute) Puzzle';
        this.item.tooltip = 'Puzzle Agent Music — idle. Click to play.';
        break;
    }
  }

  dispose(): void {
    this.item.dispose();
  }
}
