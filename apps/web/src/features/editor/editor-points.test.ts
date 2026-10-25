import { describe, expect, it } from 'vitest';
import {
  findPointAt,
  gridStep,
  niceStep,
  snapToStep,
  worldToScreen,
} from './editor-geometry';
import { formatFieldNumber, parseOptionalNumber } from './point-fields';
import {
  POINT_SYMBOL_LIST,
  countByType,
  symbolForShortcut,
} from './point-symbols';

const size = { width: 800, height: 600 };
const rules = { label: 'Height', min: 0, max: 100 };

describe('grid snapping', () => {
  it('rounds to the nearest step and never returns -0', () => {
    expect(snapToStep({ x: 12.4, y: 17.6 }, 5)).toEqual({ x: 10, y: 20 });
    expect(Object.is(snapToStep({ x: -0.4, y: 0 }, 5).x, 0)).toBe(true);
  });

  it('ignores an invalid step', () => {
    expect(snapToStep({ x: 3.3, y: 4.4 }, 0)).toEqual({ x: 3.3, y: 4.4 });
    expect(snapToStep({ x: 3.3, y: 4.4 }, Number.NaN)).toEqual({ x: 3.3, y: 4.4 });
  });

  it('uses the 1-2-5 grid and a minor step of one fifth of the major step', () => {
    expect(niceStep(90)).toBe(100);
    expect(niceStep(1.4)).toBe(2);
    expect(gridStep(1)).toBe(20);
    expect(gridStep(10)).toBeCloseTo(2, 9);
  });
});

describe('point hit testing', () => {
  const points = [
    { id: 'a', x: 0, y: 0 },
    { id: 'b', x: 100, y: 0 },
  ];

  it('finds a point within the pixel radius at any zoom', () => {
    for (const zoom of [0.1, 1, 6]) {
      const viewport = { x: 0, y: 0, zoom };
      const screen = worldToScreen({ x: 100, y: 0 }, viewport, size);
      expect(findPointAt(points, { x: screen.x + 5, y: screen.y }, viewport, size)).toBe('b');
    }
  });

  it('returns null outside the radius', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };
    const screen = worldToScreen({ x: 50, y: 0 }, viewport, size);
    expect(findPointAt(points, screen, viewport, size)).toBeNull();
  });

  it('prefers the nearest point and the later one on a tie', () => {
    const viewport = { x: 0, y: 0, zoom: 1 };
    const stacked = [
      { id: 'under', x: 10, y: 10 },
      { id: 'over', x: 10, y: 10 },
    ];
    const screen = worldToScreen({ x: 10, y: 10 }, viewport, size);
    expect(findPointAt(stacked, screen, viewport, size)).toBe('over');
  });
});

describe('point field parsing', () => {
  it('treats an empty field as no value', () => {
    expect(parseOptionalNumber('  ', rules)).toEqual({ ok: true, value: null });
  });

  it('accepts a decimal comma', () => {
    expect(parseOptionalNumber('1,5', rules)).toEqual({ ok: true, value: 1.5 });
  });

  it('rejects text, out-of-range values and non-finite numbers', () => {
    expect(parseOptionalNumber('abc', rules).ok).toBe(false);
    expect(parseOptionalNumber('1e3', rules).ok).toBe(false);
    expect(parseOptionalNumber('-1', rules).ok).toBe(false);
    expect(parseOptionalNumber('100.5', rules).ok).toBe(false);
    expect(parseOptionalNumber('Infinity', rules).ok).toBe(false);
  });

  it('formats numbers without noise', () => {
    expect(formatFieldNumber(1.5)).toBe('1.5');
    expect(formatFieldNumber(0.1 + 0.2)).toBe('0.3');
    expect(formatFieldNumber(null)).toBe('');
  });
});

describe('symbol registry', () => {
  it('has unique shortcuts and covers every point type once', () => {
    const shortcuts = POINT_SYMBOL_LIST.map((s) => s.shortcut).filter(Boolean);
    expect(new Set(shortcuts).size).toBe(shortcuts.length);
    expect(new Set(POINT_SYMBOL_LIST.map((s) => s.type)).size).toBe(6);
  });

  it('does not use keys the editor already owns (V H C G 0 1)', () => {
    for (const key of ['V', 'H', 'C', 'G', '0', '1']) {
      expect(symbolForShortcut(key)).toBeNull();
    }
  });

  it('resolves shortcuts case-insensitively and counts by type', () => {
    expect(symbolForShortcut('s')?.type).toBe('socket');
    expect(countByType([{ type: 'light' }, { type: 'light' }, { type: 'panel' }])).toMatchObject({
      light: 2,
      panel: 1,
      socket: 0,
    });
  });
});
