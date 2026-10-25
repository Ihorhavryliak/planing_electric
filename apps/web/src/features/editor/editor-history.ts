/**
 * Small client-side undo/redo stack for editor drawing mutations.
 *
 * Commands own their server calls; the stack only tracks order and the
 * past/future split. Keeping this pure makes the ordering easy to test.
 */
export interface HistoryCommand {
  /** Short human-readable description, e.g. "Move point". */
  label: string;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

export interface HistoryState {
  /** Oldest first; the last entry is the next undo. */
  past: readonly HistoryCommand[];
  /** Next redo first. */
  future: readonly HistoryCommand[];
}

export const HISTORY_LIMIT = 50;
export const EMPTY_HISTORY: HistoryState = { past: [], future: [] };

/** Records a new action and discards the redo branch. */
export function addHistoryEntry(
  state: HistoryState,
  command: HistoryCommand,
  limit = HISTORY_LIMIT,
): HistoryState {
  return {
    past: [...state.past, command].slice(-limit),
    future: [],
  };
}

/** Command that the next undo would run, or null when there is nothing to undo. */
export function getUndoCommand(state: HistoryState): HistoryCommand | null {
  return state.past[state.past.length - 1] ?? null;
}

/** Command that the next redo would run, or null when there is nothing to redo. */
export function getRedoCommand(state: HistoryState): HistoryCommand | null {
  return state.future[0] ?? null;
}

/** Moves an undone command from the past stack to the redo stack. */
export function markUndone(
  state: HistoryState,
  command: HistoryCommand,
): HistoryState {
  return {
    past: state.past.slice(0, -1),
    future: [command, ...state.future],
  };
}

/** Moves a redone command from the redo stack back to the past stack. */
export function markRedone(
  state: HistoryState,
  command: HistoryCommand,
): HistoryState {
  return {
    past: [...state.past, command],
    future: state.future.slice(1),
  };
}
