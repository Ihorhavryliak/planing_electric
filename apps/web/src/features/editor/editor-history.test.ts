import { describe, expect, it } from 'vitest';
import {
  EMPTY_HISTORY,
  addHistoryEntry,
  getRedoCommand,
  getUndoCommand,
  markRedone,
  markUndone,
  type HistoryCommand,
  type HistoryState,
} from './editor-history';

function command(label: string): HistoryCommand {
  return {
    label,
    undo: async () => undefined,
    redo: async () => undefined,
  };
}

describe('editor history stack', () => {
  it('starts empty', () => {
    expect(getUndoCommand(EMPTY_HISTORY)).toBeNull();
    expect(getRedoCommand(EMPTY_HISTORY)).toBeNull();
  });

  it('returns the latest action as the next undo', () => {
    const first = command('first');
    const second = command('second');
    const state = addHistoryEntry(addHistoryEntry(EMPTY_HISTORY, first), second);

    expect(getUndoCommand(state)).toBe(second);
    expect(state.past).toEqual([first, second]);
  });

  it('clears the redo branch when a new action is recorded', () => {
    const first = command('first');
    const second = command('second');
    const undone = markUndone(addHistoryEntry(EMPTY_HISTORY, first), first);

    expect(getRedoCommand(undone)).toBe(first);

    const next = addHistoryEntry(undone, second);

    expect(next.future).toEqual([]);
    expect(getRedoCommand(next)).toBeNull();
    expect(getUndoCommand(next)).toBe(second);
  });

  it('moves an undone command to the redo stack', () => {
    const first = command('first');
    const second = command('second');
    const state = addHistoryEntry(addHistoryEntry(EMPTY_HISTORY, first), second);
    const undone = markUndone(state, second);

    expect(undone.past).toEqual([first]);
    expect(undone.future).toEqual([second]);
    expect(getRedoCommand(undone)).toBe(second);
  });

  it('moves a redone command back to the past stack', () => {
    const first = command('first');
    const second = command('second');
    const state = addHistoryEntry(addHistoryEntry(EMPTY_HISTORY, first), second);
    const undone = markUndone(state, second);
    const redone = markRedone(undone, second);

    expect(redone.past).toEqual([first, second]);
    expect(redone.future).toEqual([]);
    expect(getUndoCommand(redone)).toBe(second);
  });

  it('keeps multiple undos in reverse order for redo', () => {
    const first = command('first');
    const second = command('second');
    const third = command('third');
    let state: HistoryState = EMPTY_HISTORY;

    for (const entry of [first, second, third]) {
      state = addHistoryEntry(state, entry);
    }

    state = markUndone(state, third);
    state = markUndone(state, second);

    expect(state.future).toEqual([second, third]);

    state = markRedone(state, second);
    expect(state.future).toEqual([third]);
    expect(getUndoCommand(state)).toBe(second);
  });

  it('caps the undo stack at the configured limit', () => {
    let state: HistoryState = EMPTY_HISTORY;

    for (let index = 0; index < 5; index += 1) {
      state = addHistoryEntry(state, command(`action-${index}`), 3);
    }

    expect(state.past.map((entry) => entry.label)).toEqual([
      'action-2',
      'action-3',
      'action-4',
    ]);
  });
});
