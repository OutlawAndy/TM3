import * as vscode from "vscode";
import { MacroEvent, PersistedMacro, MACRO_SCHEMA_VERSION } from "./types";

export interface RecorderConfig {
  maxEvents: number;
  filterMouseSelection: boolean;
}

export interface RecorderHooks {
  onCapReached: (eventCount: number) => void;
}

export class Recorder {
  private readonly editor: vscode.TextEditor;
  private readonly anchorOffset: number;
  private readonly events: MacroEvent[] = [];
  private readonly disposables: vscode.Disposable[] = [];
  private readonly config: RecorderConfig;
  private readonly hooks: RecorderHooks;
  private stopped = false;

  constructor(editor: vscode.TextEditor, config: RecorderConfig, hooks: RecorderHooks) {
    this.editor = editor;
    this.anchorOffset = editor.document.offsetAt(editor.selection.active);
    this.config = config;
    this.hooks = hooks;

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => this.onDocumentChange(event)),
      vscode.window.onDidChangeTextEditorSelection((event) => this.onSelectionChange(event)),
    );
  }

  get targetEditor(): vscode.TextEditor {
    return this.editor;
  }

  get eventCount(): number {
    return this.events.length;
  }

  stop(): PersistedMacro {
    if (!this.stopped) {
      this.stopped = true;
      for (const d of this.disposables) {
        d.dispose();
      }
      this.disposables.length = 0;
    }
    return {
      version: MACRO_SCHEMA_VERSION,
      anchorOffset: this.anchorOffset,
      events: this.events.slice(),
    };
  }

  private onDocumentChange(event: vscode.TextDocumentChangeEvent): void {
    if (this.stopped || event.document !== this.editor.document) {
      return;
    }
    for (const change of event.contentChanges) {
      this.events.push({
        kind: "edit",
        offsetDelta: change.rangeOffset - this.anchorOffset,
        rangeLength: change.rangeLength,
        text: change.text,
      });
      if (this.events.length >= this.config.maxEvents) {
        this.hooks.onCapReached(this.events.length);
        return;
      }
    }
  }

  private onSelectionChange(event: vscode.TextEditorSelectionChangeEvent): void {
    if (this.stopped || event.textEditor !== this.editor) {
      return;
    }
    if (
      this.config.filterMouseSelection &&
      event.kind === vscode.TextEditorSelectionChangeKind.Mouse
    ) {
      return;
    }
    const primary = event.selections[0];
    if (!primary) {
      return;
    }
    const doc = this.editor.document;
    this.events.push({
      kind: "select",
      anchorDelta: doc.offsetAt(primary.anchor) - this.anchorOffset,
      activeDelta: doc.offsetAt(primary.active) - this.anchorOffset,
    });
    if (this.events.length >= this.config.maxEvents) {
      this.hooks.onCapReached(this.events.length);
    }
  }
}
