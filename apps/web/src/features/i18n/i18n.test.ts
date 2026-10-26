import { describe, expect, it } from 'vitest';
import { localizeMessage, setErrorLocale } from './error-messages';
import {
  LOCALE_STORAGE_KEY,
  currencyFor,
  formatLocale,
  isLocale,
  readLocale,
  translate,
  translateUnit,
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
    expect(isLocale('ua')).toBe(true);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('pl')).toBe(false);
    expect(isLocale('de')).toBe(false);
  });

  it('reads and persists the locale, migrating the legacy uk value', () => {
    expect(readLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'ua' }))).toBe(
      'ua',
    );
    expect(readLocale(memoryStorage({ [LOCALE_STORAGE_KEY]: 'uk' }))).toBe(
      'ua',
    );
    expect(readLocale(null)).toBe('en');
    const storage = memoryStorage();
    writeLocale(storage, 'ru');
    expect(storage.data[LOCALE_STORAGE_KEY]).toBe('ru');
  });

  it('translates and interpolates params', () => {
    expect(translate('ua', 'nav.materials')).toBe('Матеріали');
    expect(translate('ru', 'nav.materials')).toBe('Материалы');
    expect(translate('en', 'nav.materials')).toBe('Materials');
    expect(translate('en', 'missing.key')).toBe('missing.key');
  });

  it('maps locales to Intl tags', () => {
    expect(formatLocale('ua')).toBe('uk-UA');
    expect(formatLocale('ru')).toBe('ru-RU');
    expect(formatLocale('en')).toBe('en-US');
  });

  it('maps locales to currencies and translated units', () => {
    expect(currencyFor('ua')).toBe('UAH');
    expect(currencyFor('ru')).toBe('RUB');
    expect(translateUnit('ua', 'm')).toBe('м');
    expect(translateUnit('ru', 'm2')).toBe('м²');
    expect(translateUnit('en', 'pcs')).toBe('pcs');
  });

  it('localizes known API errors in Ukrainian and Russian', () => {
    setErrorLocale('ua');
    expect(localizeMessage('Project not found')).toBe('Проєкт не знайдено');
    setErrorLocale('ru');
    expect(localizeMessage('Project not found')).toBe('Проект не найден');
    expect(localizeMessage('Unknown server message')).toBe(
      'Unknown server message',
    );
    setErrorLocale('en');
    expect(localizeMessage('Project not found')).toBe('Project not found');
  });
});
