export type ParsedOptionalNumber =
  | { ok: true; value: number | null }
  | { ok: false; error: string };

interface NumberRules {
  label: string;
  min: number;
  max: number;
}

/**
 * Parses a form field. An empty string means "no value" (null). A decimal
 * comma is accepted because many users type `1,5`.
 */
export function parseOptionalNumber(
  raw: string,
  rules: NumberRules,
): ParsedOptionalNumber {
  const text = raw.trim().replace(',', '.');

  if (text === '') {
    return { ok: true, value: null };
  }

  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(text)) {
    return { ok: false, error: `${rules.label} must be a number.` };
  }

  const value = Number(text);

  if (!Number.isFinite(value) || value < rules.min || value > rules.max) {
    return {
      ok: false,
      error: `${rules.label} must be between ${rules.min} and ${rules.max}.`,
    };
  }

  return { ok: true, value };
}

/** Number as shown in an input: no trailing zeros, null as an empty string. */
export function formatFieldNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '';
  }

  return String(Math.round(value * 1000) / 1000);
}
