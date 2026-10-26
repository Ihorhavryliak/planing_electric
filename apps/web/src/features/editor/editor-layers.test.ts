import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_LAYERS,
  EDITOR_LAYER_KEYS,
  normalizeEditorLayers,
  parseEditorLayers,
} from './editor-layers';

describe('editor layers', () => {
  it('starts with every layer visible', () => {
    expect(parseEditorLayers(null)).toEqual(DEFAULT_EDITOR_LAYERS);
    expect(EDITOR_LAYER_KEYS).toHaveLength(
      Object.keys(DEFAULT_EDITOR_LAYERS).length,
    );
  });

  it('restores stored visibility per layer', () => {
    const parsed = parseEditorLayers(
      JSON.stringify({ ...DEFAULT_EDITOR_LAYERS, labels: false, walls: false }),
    );

    expect(parsed).toMatchObject({ labels: false, walls: false });
    expect(parsed.routes).toBe(true);
  });

  it('ignores corrupt or partial storage', () => {
    expect(parseEditorLayers('not-json')).toEqual(DEFAULT_EDITOR_LAYERS);
    expect(
      normalizeEditorLayers({ points: false, routes: 'no' }),
    ).toMatchObject({ points: false, routes: true });
    expect(normalizeEditorLayers(null)).toEqual(DEFAULT_EDITOR_LAYERS);
  });
});
