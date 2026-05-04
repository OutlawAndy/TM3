export const MACRO_SCHEMA_VERSION = 1;

export type MacroEvent =
  | { kind: "edit"; offsetDelta: number; rangeLength: number; text: string }
  | { kind: "select"; anchorDelta: number; activeDelta: number };

export interface PersistedMacro {
  version: number;
  anchorOffset: number;
  events: MacroEvent[];
}
