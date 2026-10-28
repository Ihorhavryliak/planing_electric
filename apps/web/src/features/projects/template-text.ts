import type { PublicProjectTemplate } from '@drawmyplace/contracts';
import type { Locale } from '@/features/i18n/i18n';

type Translate = (key: string) => string;

/**
 * UI copy lives in the i18n catalog; the API maps are the fallback for codes
 * whose translation is not shipped yet.
 */
export function templateText(
  template: PublicProjectTemplate,
  field: 'name' | 'description',
  t: Translate,
  locale: Locale,
): string {
  const key = `templates.${template.code}.${field}`;
  const translated = t(key);

  if (translated !== key && translated.length > 0) {
    return translated;
  }

  return (
    template[field][locale] ??
    template[field].en ??
    template[field].ua ??
    ''
  );
}
