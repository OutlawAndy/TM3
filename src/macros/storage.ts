import * as vscode from "vscode";
import { PersistedMacro, MACRO_SCHEMA_VERSION } from "./types";

const KEY_CURRENT = "tm3.macros.current";
const KEY_NAMED = "tm3.macros.named";

type NamedMap = Record<string, PersistedMacro>;

export class MacroStorage {
  constructor(private readonly state: vscode.Memento) {}

  getCurrent(): PersistedMacro | null {
    const raw = this.state.get<PersistedMacro>(KEY_CURRENT);
    return this.validate(raw, "current");
  }

  async setCurrent(macro: PersistedMacro): Promise<void> {
    await this.state.update(KEY_CURRENT, macro);
  }

  async clearCurrent(): Promise<void> {
    await this.state.update(KEY_CURRENT, undefined);
  }

  listNamed(): string[] {
    const map = this.state.get<NamedMap>(KEY_NAMED) ?? {};
    return Object.keys(map).sort((a, b) => a.localeCompare(b));
  }

  hasNamed(name: string): boolean {
    const map = this.state.get<NamedMap>(KEY_NAMED) ?? {};
    return Object.prototype.hasOwnProperty.call(map, name);
  }

  getNamed(name: string): PersistedMacro | null {
    const map = this.state.get<NamedMap>(KEY_NAMED) ?? {};
    const raw = map[name];
    return this.validate(raw, `named:${name}`);
  }

  async saveNamed(name: string, macro: PersistedMacro): Promise<void> {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("Macro name must not be empty.");
    }
    const map = { ...(this.state.get<NamedMap>(KEY_NAMED) ?? {}) };
    map[trimmed] = macro;
    await this.state.update(KEY_NAMED, map);
  }

  private validate(raw: PersistedMacro | undefined, label: string): PersistedMacro | null {
    if (!raw) {
      return null;
    }
    if (raw.version !== MACRO_SCHEMA_VERSION) {
      void vscode.window.showWarningMessage(
        `TM3: stored macro "${label}" has unsupported version ${raw.version}; ignoring.`,
      );
      return null;
    }
    if (!Array.isArray(raw.events) || typeof raw.anchorOffset !== "number") {
      void vscode.window.showWarningMessage(
        `TM3: stored macro "${label}" is malformed; ignoring.`,
      );
      return null;
    }
    return raw;
  }
}
