import * as vscode from "vscode";
import { PersistedMacro } from "./types";

export type PlayResult =
  | { kind: "ok"; appliedEdits: number }
  | { kind: "empty" }
  | { kind: "out-of-bounds" }
  | { kind: "edit-failed" };

export async function play(
  editor: vscode.TextEditor,
  macro: PersistedMacro,
): Promise<PlayResult> {
  if (macro.events.length === 0) {
    return { kind: "empty" };
  }

  const doc = editor.document;
  const newAnchor = doc.offsetAt(editor.selection.active);

  let lastSelectActiveDelta: number | null = null;
  let appliedEdits = 0;
  let outOfBounds = false;

  const ok = await editor.edit((builder) => {
    for (const event of macro.events) {
      if (event.kind === "edit") {
        const startOffset = newAnchor + event.offsetDelta;
        const endOffset = startOffset + event.rangeLength;
        if (startOffset < 0 || endOffset > doc.getText().length) {
          outOfBounds = true;
          continue;
        }
        const range = new vscode.Range(
          doc.positionAt(startOffset),
          doc.positionAt(endOffset),
        );
        builder.replace(range, event.text);
        appliedEdits++;
      } else {
        lastSelectActiveDelta = event.activeDelta;
      }
    }
  });

  if (!ok) {
    return { kind: "edit-failed" };
  }

  if (lastSelectActiveDelta !== null) {
    const finalOffset = newAnchor + lastSelectActiveDelta;
    const clamped = Math.max(0, Math.min(finalOffset, editor.document.getText().length));
    const pos = editor.document.positionAt(clamped);
    editor.selection = new vscode.Selection(pos, pos);
  }

  return outOfBounds ? { kind: "out-of-bounds" } : { kind: "ok", appliedEdits };
}
