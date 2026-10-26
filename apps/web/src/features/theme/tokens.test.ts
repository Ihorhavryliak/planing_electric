import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(
  new URL('../../../../../packages/ui/tokens.css', import.meta.url),
  'utf8',
);

function block(selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`Missing selector ${selector}`);
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);

  return css.slice(open + 1, close);
}

function token(source: string, name: string): string {
  const match = source.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Missing token ${name}`);

  return match[1].trim();
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  if (value.length !== 6) throw new Error(`Expected 6-digit hex, got ${hex}`);
  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return (
    (channels[0] ?? 0) * 0.2126 +
    (channels[1] ?? 0) * 0.7152 +
    (channels[2] ?? 0) * 0.0722
  );
}

function contrast(a: string, b: string): number {
  const first = luminance(a);
  const second = luminance(b);
  const light = Math.max(first, second);
  const dark = Math.min(first, second);

  return (light + 0.05) / (dark + 0.05);
}

describe('design tokens', () => {
  const dark = block(':root');
  const light = block("[data-theme='light']");

  it('defines the complete semantic token groups', () => {
    for (const name of [
      '--dmp-color-brand',
      '--dmp-color-surface',
      '--dmp-color-border',
      '--dmp-color-text',
      '--dmp-color-success',
      '--dmp-color-warning',
      '--dmp-color-danger',
      '--dmp-color-info',
    ]) {
      expect(token(dark, name)).toBeTruthy();
      expect(token(light, name)).toBeTruthy();
    }

    for (const name of [
      '--dmp-text-2xs',
      '--dmp-text-2xl',
      '--dmp-space-1',
      '--dmp-space-12',
      '--dmp-radius-sm',
      '--dmp-radius-2xl',
      '--dmp-shadow-0',
      '--dmp-shadow-4',
      '--dmp-duration-fast',
      '--dmp-duration-slow',
      '--dmp-ease-standard',
      '--dmp-ease-emphasized',
    ]) {
      expect(token(dark, name)).toBeTruthy();
    }
  });

  it('remaps surfaces, text and brand for the light theme', () => {
    expect(token(dark, '--dmp-color-surface')).not.toBe(
      token(light, '--dmp-color-surface'),
    );
    expect(token(dark, '--dmp-color-text')).not.toBe(
      token(light, '--dmp-color-text'),
    );
    expect(token(dark, '--dmp-color-brand')).not.toBe(
      token(light, '--dmp-color-brand'),
    );
  });

  it('meets WCAG AA for all text tiers on their surfaces', () => {
    for (const source of [dark, light]) {
      const surface = token(source, '--dmp-color-surface');

      for (const name of [
        '--dmp-color-text',
        '--dmp-color-text-muted',
        '--dmp-color-text-subtle',
      ]) {
        expect(contrast(token(source, name), surface)).toBeGreaterThanOrEqual(
          4.5,
        );
      }
    }
  });

  it('meets 3:1 for status colors on surfaces', () => {
    for (const source of [dark, light]) {
      const surface = token(source, '--dmp-color-surface');

      for (const name of [
        '--dmp-color-success',
        '--dmp-color-warning',
        '--dmp-color-danger',
        '--dmp-color-info',
      ]) {
        expect(contrast(token(source, name), surface)).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('disables motion durations for reduced motion', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('--dmp-duration-base: 0.01ms;');
  });
});
