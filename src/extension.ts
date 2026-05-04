import * as vscode from "vscode";
import { Recorder, RecorderConfig } from "./macros/recorder";
import { MacroStorage } from "./macros/storage";
import { play } from "./macros/player";

let currentRecorder: Recorder | null = null;
let storage: MacroStorage | null = null;
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
  if (storage) {
    void storage.setCurrent(macro);
  }

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
  storage = new MacroStorage(context.globalState);

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
    vscode.commands.registerCommand("textMate3.macros.replay", async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        void vscode.window.showInformationMessage("Open a text editor to replay a macro.");
        return;
      }
      const macro = storage?.getCurrent() ?? null;
      if (!macro) {
        void vscode.window.showInformationMessage("No macro recorded yet.");
        return;
      }
      if (macro.events.length === 0) {
        void vscode.window.showInformationMessage("Recorded macro is empty.");
        return;
      }
      const result = await play(editor, macro);
      switch (result.kind) {
        case "ok":
          void vscode.window.showInformationMessage(
            `Macro replayed (${result.appliedEdits} edits).`,
          );
          break;
        case "empty":
          void vscode.window.showInformationMessage("Recorded macro is empty.");
          break;
        case "out-of-bounds":
          void vscode.window.showWarningMessage(
            "Macro replay applied partial edits — some offsets fell outside the document.",
          );
          break;
        case "edit-failed":
          void vscode.window.showErrorMessage("Macro replay failed — try again.");
          break;
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("textMate3.macros.saveAs", async () => {
      if (!storage) {
        return;
      }
      const macro = storage.getCurrent();
      if (!macro || macro.events.length === 0) {
        void vscode.window.showInformationMessage("No current macro to save.");
        return;
      }
      const name = await vscode.window.showInputBox({
        prompt: "Macro name",
        placeHolder: "e.g. wrap-with-todo",
        validateInput: (value) =>
          value.trim().length === 0 ? "Name must not be empty." : undefined,
      });
      if (name === undefined) {
        return;
      }
      const trimmed = name.trim();
      if (storage.hasNamed(trimmed)) {
        const choice = await vscode.window.showInformationMessage(
          `A macro named "${trimmed}" already exists. Overwrite?`,
          { modal: true },
          "Overwrite",
        );
        if (choice !== "Overwrite") {
          return;
        }
      }
      await storage.saveNamed(trimmed, macro);
      void vscode.window.showInformationMessage(
        `Saved macro "${trimmed}" (${macro.events.length} events).`,
      );
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("textMate3.macros.loadNamed", async () => {
      if (!storage) {
        return;
      }
      const names = storage.listNamed();
      if (names.length === 0) {
        void vscode.window.showInformationMessage("No saved macros.");
        return;
      }
      const picked = await vscode.window.showQuickPick(names, {
        placeHolder: "Pick a macro to make current",
      });
      if (picked === undefined) {
        return;
      }
      const macro = storage.getNamed(picked);
      if (!macro) {
        void vscode.window.showWarningMessage(
          `Macro "${picked}" could not be loaded (storage validation failed).`,
        );
        return;
      }
      await storage.setCurrent(macro);
      void vscode.window.showInformationMessage(`Loaded "${picked}" as current macro.`);
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
  storage = null;
}
