import type { Circuit } from '@drawmyplace/contracts';

/** Palette used for circuits that still keep the historical default colour. */
export const CIRCUIT_PALETTE = [
  '#38bdf8',
  '#a78bfa',
  '#34d399',
  '#f472b6',
  '#facc15',
  '#fb7185',
  '#22d3ee',
  '#84cc16',
  '#e879f9',
  '#f59e0b',
  '#60a5fa',
  '#f97316',
] as const;

export const DEFAULT_CIRCUIT_COLOR = '#f59e0b';

export function paletteColor(index: number): string {
  const safe = Math.abs(Math.trunc(index)) % CIRCUIT_PALETTE.length;

  return CIRCUIT_PALETTE[safe] ?? CIRCUIT_PALETTE[0];
}

/** Default colour for a newly created circuit, so new circuits differ. */
export function nextCircuitColor(
  used: number | readonly Pick<Circuit, 'color'>[],
): string {
  if (typeof used === 'number') return paletteColor(used);

  const taken = new Set(used.map((circuit) => circuit.color.toLowerCase()));

  for (let index = 0; index < CIRCUIT_PALETTE.length; index += 1) {
    const color = paletteColor(index);

    if (!taken.has(color.toLowerCase())) return color;
  }

  return paletteColor(used.length);
}

/**
 * Circuit colours used on the canvas. Circuits that still use the old shared
 * amber default get a stable palette colour by their position, so several
 * circuits are distinguishable without editing every circuit first. A colour
 * chosen by the user always wins.
 */
export function effectiveCircuitColors(
  circuits: readonly Pick<Circuit, 'id' | 'color'>[] | undefined,
): Map<string, string> {
  const list = circuits ?? [];
  const used = new Set(
    list
      .filter(
        (circuit) =>
          circuit.color.toLowerCase() !== DEFAULT_CIRCUIT_COLOR.toLowerCase(),
      )
      .map((circuit) => circuit.color.toLowerCase()),
  );
  const result = new Map<string, string>();
  let paletteIndex = 0;

  for (const circuit of list) {
    if (circuit.color.toLowerCase() !== DEFAULT_CIRCUIT_COLOR.toLowerCase()) {
      result.set(circuit.id, circuit.color);
      continue;
    }

    let color = paletteColor(paletteIndex);
    let guard = 0;

    while (used.has(color.toLowerCase()) && guard < CIRCUIT_PALETTE.length) {
      paletteIndex += 1;
      color = paletteColor(paletteIndex);
      guard += 1;
    }

    used.add(color.toLowerCase());
    paletteIndex += 1;
    result.set(circuit.id, color);
  }

  return result;
}

/** `#rrggbb` to the integer used by three.js materials. */
export function colorToHex(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = /^#([0-9a-f]{6})$/i.exec(value.trim());

  if (!match?.[1]) return null;

  return Number.parseInt(match[1], 16);
}
