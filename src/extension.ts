import * as vscode from "vscode";
import { Recorder, RecorderConfig } from "./macros/recorder";
import { PersistedMacro } from "./macros/types";

let currentRecorder: Recorder | null = null;
let lastMacro: PersistedMacro | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

function readRecorderConfig(): RecorderConfig {
  const cfg = vscode.workspace.getConfiguration("textMate3.macros");
  return {
    maxEvents: cfg.get<number>("maxEvents", 10000),
    filterMouseSelection: cfg.get<boolean>("filterMouseSelection", true),
  };
}

function showRecordingIndicator(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.text = "$(record) Recording macro";
  statusBarItem.backgroundColor = new vscode.ThemeColor("statusBarItem.errorBackground");
  statusBarItem.tooltip = "TextMate3 macro recording in progress";
  statusBarItem.show();
}

function hideRecordingIndicator(): void {
  if (!statusBarItem) {
    return;
  }
  statusBarItem.hide();
  statusBarItem.backgroundColor = undefined;
}

function finishRecording(reason: "toggle" | "cap" | "editorSwitch", capCount?: number): void {
  if (!currentRecorder) {
    return;
  }
  const macro = currentRecorder.stop();
  currentRecorder = null;
  hideRecordingIndicator();
  lastMacro = macro;

  switch (reason) {
    case "toggle":
      void vscode.window.showInformationMessage(
        `Macro recording stopped (${macro.events.length} events captured).`,
      );
      break;
    case "cap":
      void vscode.window.showWarningMessage(
        `Macro recording auto-stopped at ${capCount ?? macro.events.length} events (configured cap).`,
      );
      break;
    case "editorSwitch":
      void vscode.window.showWarningMessage(
        `Macro recording stopped because the active editor changed (${macro.events.length} events captured).`,
      );
      break;
  }
}

function startRecording(): void {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    void vscode.window.showInformationMessage("Open a text editor to record a macro.");
    return;
  }
  const config = readRecorderConfig();
  currentRecorder = new Recorder(editor, config, {
    onCapReached: (count) => finishRecording("cap", count),
  });
  showRecordingIndicator();
  void vscode.window.showInformationMessage("Macro recording started.");
}

export function activate(context: vscode.ExtensionContext): void {
  statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
  context.subscriptions.push(statusBarItem);

  context.subscriptions.push(
    vscode.commands.registerCommand("textMate3.helloWorld", () => {
      const greeting = vscode.workspace
        .getConfiguration("textMate3")
        .get<string>("greeting", "Hello");
      void vscode.window.showInformationMessage(`${greeting} from TextMate3!`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("textMate3.macros.toggleRecord", () => {
      if (currentRecorder) {
        finishRecording("toggle");
      } else {
        startRecording();
      }
    }),
  );

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (currentRecorder && editor !== currentRecorder.targetEditor) {
        finishRecording("editorSwitch");
      }
    }),
  );

  context.subscriptions.push(
    vscode.languages.registerHoverProvider(
      { language: "markdown" },
      {
        provideHover() {
          return new vscode.Hover(
            new vscode.MarkdownString(
              "**TextMate3** hover stub — replace me with a real provider.",
            ),
          );
        },
      },
    ),
  );
}

export function deactivate(): void {
  if (currentRecorder) {
    currentRecorder.stop();
    currentRecorder = null;
  }
  hideRecordingIndicator();
  statusBarItem = null;
}
