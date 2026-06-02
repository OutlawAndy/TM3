import * as vscode from "vscode";
import { Recorder, RecorderConfig } from "./macros/recorder";
import { MacroStorage } from "./macros/storage";
import { play } from "./macros/player";
import {
  toggleHashSyntax,
  toggleStringSymbol,
  toggleQuoteStyle,
  toggleCamelSnake,
  toggleBlockStyle,
  toggleArrayLiteral,
  sortCollection,
} from "./ruby/transforms";

let currentRecorder: Recorder | null = null;
let storage: MacroStorage | null = null;
let statusBarItem: vscode.StatusBarItem | null = null;

function readRecorderConfig(): RecorderConfig {
  const cfg = vscode.workspace.getConfiguration("tm3.macros");
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
  statusBarItem.tooltip = "TM3 macro recording in progress";
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
    vscode.commands.registerCommand("tm3.helloWorld", () => {
      const greeting = vscode.workspace
        .getConfiguration("tm3")
        .get<string>("greeting", "Hello");
      void vscode.window.showInformationMessage(`${greeting} from TM3!`);
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tm3.macros.toggleRecord", () => {
      if (currentRecorder) {
        finishRecording("toggle");
      } else {
        startRecording();
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("tm3.macros.replay", async () => {
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
    vscode.commands.registerCommand("tm3.macros.saveAs", async () => {
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
    vscode.commands.registerCommand("tm3.macros.loadNamed", async () => {
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

  // --- Ruby / Source text-transform commands ---

  function tabStr(editor: vscode.TextEditor): string {
    const opts = editor.options;
    if (opts.insertSpaces) {
      return " ".repeat(typeof opts.tabSize === "number" ? opts.tabSize : 2);
    }
    return "\t";
  }

  // Iteratively expands selection from the cursor using VSCode's grammar-aware
  // smart-select until `transform` produces a change. Returns the matching range,
  // or null if no expansion (up to maxExpansions) yields one.
  async function findTransformScope(
    editor: vscode.TextEditor,
    apply: (text: string) => string,
    maxExpansions = 5,
  ): Promise<vscode.Range | null> {
    if (!editor.selection.isEmpty) {
      return editor.selection;
    }

    const cursorPos = editor.selection.active;

    // Try the word at cursor first — permissive regex covers :symbol, @ivar, snake_case.
    const wordRange = editor.document.getWordRangeAtPosition(
      cursorPos,
      /[:@$]?[A-Za-z_][A-Za-z0-9_]*/,
    );
    if (wordRange) {
      const wordText = editor.document.getText(wordRange);
      if (apply(wordText) !== wordText) {
        return wordRange;
      }
    }

    // Ensure smart-select starts from the bare cursor, not the word range we just probed.
    editor.selection = new vscode.Selection(cursorPos, cursorPos);

    let lastRange: vscode.Range = editor.selection;
    for (let i = 0; i < maxExpansions; i++) {
      await vscode.commands.executeCommand("editor.action.smartSelect.expand");
      const expanded = editor.selection;
      if (expanded.isEqual(lastRange)) {
        // smart-select didn't move; give up.
        break;
      }
      lastRange = expanded;
      const text = editor.document.getText(expanded);
      if (apply(text) !== text) {
        return expanded;
      }
    }

    // No scope matched — restore cursor.
    editor.selection = new vscode.Selection(cursorPos, cursorPos);
    return null;
  }

  function registerTransform(
    id: string,
    transform: (text: string, tab: string) => string,
    selectionRequired = false,
  ): void {
    context.subscriptions.push(
      vscode.commands.registerCommand(id, async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) return;
        if (selectionRequired && editor.selection.isEmpty) {
          void vscode.window.showInformationMessage(
            "Select the text to transform first.",
          );
          return;
        }
        const tab = tabStr(editor);
        const range = await findTransformScope(editor, (t) => transform(t, tab));
        if (!range) {
          void vscode.window.showInformationMessage(
            "Could not find a matching scope at the cursor — try making a selection.",
          );
          return;
        }
        const text = editor.document.getText(range);
        const result = transform(text, tab);
        if (result !== text) {
          await editor.edit((b) => b.replace(range, result));
        }
      }),
    );
  }

  // Selection-or-line commands (R1–R4)
  registerTransform("tm3.ruby.toggleHashSyntax", (t) =>
    toggleHashSyntax(t),
  );
  registerTransform("tm3.ruby.toggleStringSymbol", (t) =>
    toggleStringSymbol(t),
  );
  registerTransform("tm3.ruby.toggleQuoteStyle", (t) =>
    toggleQuoteStyle(t),
  );
  registerTransform("tm3.ruby.toggleCamelSnake", (t) =>
    toggleCamelSnake(t),
  );

  // wrapInBraces still requires a selection — there's nothing meaningful to wrap otherwise.
  registerTransform(
    "tm3.source.wrapInBraces",
    (t, tab) => wrapInBraces(t, tab),
    true,
  );
  registerTransform("tm3.source.unwrapBraces", (t, tab) =>
    unwrapBraces(t, tab),
  );
  registerTransform("tm3.ruby.toggleBlockStyle", (t, tab) =>
    toggleBlockStyle(t, tab),
  );
  registerTransform("tm3.ruby.toggleArrayLiteral", (t) =>
    toggleArrayLiteral(t),
  );
  registerTransform("tm3.source.sortCollection", (t) =>
    sortCollection(t),
  );

  // context.subscriptions.push(
  //   vscode.languages.registerHoverProvider(
  //     { language: "markdown" },
  //     {
  //       provideHover() {
  //         return new vscode.Hover(
  //           new vscode.MarkdownString(
  //             "**TM3** hover stub — replace me with a real provider.",
  //           ),
  //         );
  //       },
  //     },
  //   ),
  // );
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
