import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { setErrorLocale } from './error-messages';
import {
  formatLocale,
  readLocale,
  translate,
  writeLocale,
  type Locale,
} from './i18n';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (value: string | Date) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    readLocale(typeof window === 'undefined' ? null : window.localStorage),
  );

  useEffect(() => {
    setErrorLocale(locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    writeLocale(window.localStorage, next);
    document.documentElement.lang = next;
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const intlLocale = formatLocale(locale);
    return {
      locale,
      setLocale,
      t: (key, params) => translate(locale, key, params),
      formatDate: (input) =>
        new Intl.DateTimeFormat(intlLocale, {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(typeof input === 'string' ? new Date(input) : input),
      formatNumber: (input, options) =>
        new Intl.NumberFormat(intlLocale, options).format(input),
    };
  }, [locale, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used inside an I18nProvider');
  }
  return context;
}
