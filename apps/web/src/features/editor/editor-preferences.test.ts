import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_PREFERENCES,
  normalizeEditorPreferences,
  parseEditorPreferences,
} from './editor-preferences';

describe('editor preferences', () => {
  it('falls back to defaults', () => {
    expect(parseEditorPreferences(null)).toEqual(DEFAULT_EDITOR_PREFERENCES);
    expect(parseEditorPreferences('{')).toEqual(DEFAULT_EDITOR_PREFERENCES);
  });

  it('restores supported zoom levels and sidebar state', () => {
    expect(
      parseEditorPreferences(
        JSON.stringify({ uiScale: 1.1, sidebarCollapsed: true }),
      ),
    ).toEqual({ uiScale: 1.1, sidebarCollapsed: true });
  });

  it('rejects unsupported zoom levels', () => {
    expect(normalizeEditorPreferences({ uiScale: 3 })).toEqual(
      DEFAULT_EDITOR_PREFERENCES,
    );
  });
});
