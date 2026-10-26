import { describe, expect, it } from 'vitest';
import { localizeMessage, setErrorLocale } from './error-messages';
import {
  LOCALE_STORAGE_KEY,
  formatLocale,
  isLocale,
  readLocale,
  translate,
  writeLocale,
} from './i18n';

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

describe('i18n', () => {
  it('accepts only supported locales', () => {
    expect(isLocale('uk')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(true);
    expect(isLocale('de')).toBe(false);
  });

  it('reads and persists the locale', () => {
    expect(readLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'uk' }))).toBe('uk');
    expect(readLocale(null)).toBe('en');
    const storage = memoryStorage();
    writeLocale(storage, 'pl');
    expect(storage.data[LOCALE_STORAGE_KEY]).toBe('pl');
  });

  it('translates and interpolates params', () => {
    expect(translate('uk', 'nav.materials')).toBe('Матеріали');
    expect(translate('en', 'nav.materials')).toBe('Materials');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });

  it('falls back to English for missing Polish keys', () => {
    expect(translate('pl', 'nav.settings')).toBe('Settings');
  });

  it('maps locales to Intl tags', () => {
    expect(formatLocale('uk')).toBe('uk-UA');
    expect(formatLocale('pl')).toBe('pl-PL');
    expect(formatLocale('en')).toBe('en-US');
  });

  it('localizes known API errors and leaves unknown ones intact', () => {
    setErrorLocale('uk');
    expect(localizeMessage('Project not found')).toBe('Проєкт не знайдено');
    expect(localizeMessage('Unknown server message')).toBe(
      'Unknown server message',
    );
    setErrorLocale('en');
    expect(localizeMessage('Project not found')).toBe('Project not found');
  });
});
