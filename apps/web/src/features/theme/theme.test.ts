import { describe, expect, it } from 'vitest';
import {
  THEME_STORAGE_KEY,
  isThemePreference,
  nextThemePreference,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
} from './theme';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data,
  };
}

describe('theme preferences', () => {
  it('accepts only known preferences', () => {
    expect(isThemePreference('system')).toBe(true);
    expect(isThemePreference('light')).toBe(true);
    expect(isThemePreference('dark')).toBe(true);
    expect(isThemePreference('blue')).toBe(false);
    expect(isThemePreference(null)).toBe(false);
  });

  it('reads a stored preference and falls back to light', () => {
    expect(readThemePreference(memoryStorage({ [THEME_STORAGE_KEY]: 'dark' }))).toBe(
      'dark',
    );
    expect(readThemePreference(memoryStorage())).toBe('light');
    expect(readThemePreference(null)).toBe('light');
  });

  it('persists the preference', () => {
    const storage = memoryStorage();
    writeThemePreference(storage, 'light');
    expect(storage.data[THEME_STORAGE_KEY]).toBe('light');
  });

  it('resolves the system preference', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('cycles through system, light, dark', () => {
    expect(nextThemePreference('system')).toBe('light');
    expect(nextThemePreference('light')).toBe('dark');
    expect(nextThemePreference('dark')).toBe('system');
  });
});
