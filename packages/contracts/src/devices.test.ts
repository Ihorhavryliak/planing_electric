import { describe, expect, it } from 'vitest';
import {
  DEVICE_CATEGORY_ORDER,
  DEVICE_SUBTYPE_IDS,
  DEVICE_SUBTYPES,
  deviceSubtype,
  deviceSubtypeSchema,
  deviceSubtypesForCategory,
} from './devices';

describe('device catalog', () => {
  it('has unique ids and a definition for every id', () => {
    expect(new Set(DEVICE_SUBTYPE_IDS).size).toBe(DEVICE_SUBTYPE_IDS.length);
    expect(DEVICE_SUBTYPES).toHaveLength(DEVICE_SUBTYPE_IDS.length);
    expect(deviceSubtype('socket-double')).toMatchObject({
      category: 'power',
      type: 'socket',
    });
    expect(deviceSubtype('unknown-device')).toBeNull();
  });

  it('groups every subtype under a category', () => {
    const grouped = DEVICE_CATEGORY_ORDER.flatMap((category) =>
      deviceSubtypesForCategory(category),
    );
    expect(grouped).toHaveLength(DEVICE_SUBTYPES.length);
    for (const category of DEVICE_CATEGORY_ORDER) {
      expect(deviceSubtypesForCategory(category).length).toBeGreaterThan(0);
    }
  });

  it('validates subtype ids', () => {
    expect(deviceSubtypeSchema.parse('data-lan')).toBe('data-lan');
    expect(() => deviceSubtypeSchema.parse('data-unknown')).toThrow();
  });
});
