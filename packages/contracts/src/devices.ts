import { z } from 'zod';
import type { ElectricalPointType } from './drawing';

export const deviceCategorySchema = z.enum([
  'distribution',
  'boxes',
  'power',
  'control',
  'lighting',
  'lowVoltage',
]);

export type DeviceCategory = z.infer<typeof deviceCategorySchema>;

export const DEVICE_SUBTYPE_IDS = [
  'main-board',
  'sub-board',
  'circuit-origin',
  'junction-box',
  'ceiling-junction-box',
  'floor-box',
  'socket-single',
  'socket-double',
  'socket-triple',
  'socket-kitchen',
  'socket-dedicated',
  'socket-three-phase',
  'socket-floor',
  'socket-outdoor',
  'switch-single',
  'switch-double',
  'switch-two-way',
  'switch-intermediate',
  'dimmer',
  'motion-sensor',
  'blind-controller',
  'thermostat',
  'smart-switch',
  'light-ceiling',
  'light-wall',
  'light-pendant',
  'light-led-strip',
  'light-emergency',
  'light-outdoor',
  'data-lan',
  'data-tv',
  'data-satellite',
  'data-intercom',
  'data-alarm',
  'data-camera',
  'data-speaker',
  'data-smart-home',
] as const;

export const deviceSubtypeSchema = z.enum(DEVICE_SUBTYPE_IDS);

export type DeviceSubtype = z.infer<typeof deviceSubtypeSchema>;

export interface DeviceSubtypeDefinition {
  id: DeviceSubtype;
  category: DeviceCategory;
  /** Base point type used by the 2D canvas and calculations. */
  type: ElectricalPointType;
}

export const DEVICE_SUBTYPE_DEFINITIONS: Readonly<
  Record<DeviceSubtype, Omit<DeviceSubtypeDefinition, 'id'>>
> = {
  'main-board': { category: 'distribution', type: 'panel' },
  'sub-board': { category: 'distribution', type: 'panel' },
  'circuit-origin': { category: 'distribution', type: 'panel' },

  'junction-box': { category: 'boxes', type: 'junction' },
  'ceiling-junction-box': { category: 'boxes', type: 'junction' },
  'floor-box': { category: 'boxes', type: 'junction' },

  'socket-single': { category: 'power', type: 'socket' },
  'socket-double': { category: 'power', type: 'socket' },
  'socket-triple': { category: 'power', type: 'socket' },
  'socket-kitchen': { category: 'power', type: 'socket' },
  'socket-dedicated': { category: 'power', type: 'socket' },
  'socket-three-phase': { category: 'power', type: 'socket' },
  'socket-floor': { category: 'power', type: 'socket' },
  'socket-outdoor': { category: 'power', type: 'socket' },

  'switch-single': { category: 'control', type: 'switch' },
  'switch-double': { category: 'control', type: 'switch' },
  'switch-two-way': { category: 'control', type: 'switch' },
  'switch-intermediate': { category: 'control', type: 'switch' },
  dimmer: { category: 'control', type: 'switch' },
  'motion-sensor': { category: 'control', type: 'switch' },
  'blind-controller': { category: 'control', type: 'switch' },
  thermostat: { category: 'control', type: 'switch' },
  'smart-switch': { category: 'control', type: 'switch' },

  'light-ceiling': { category: 'lighting', type: 'light' },
  'light-wall': { category: 'lighting', type: 'light' },
  'light-pendant': { category: 'lighting', type: 'light' },
  'light-led-strip': { category: 'lighting', type: 'light' },
  'light-emergency': { category: 'lighting', type: 'light' },
  'light-outdoor': { category: 'lighting', type: 'light' },

  'data-lan': { category: 'lowVoltage', type: 'custom' },
  'data-tv': { category: 'lowVoltage', type: 'custom' },
  'data-satellite': { category: 'lowVoltage', type: 'custom' },
  'data-intercom': { category: 'lowVoltage', type: 'custom' },
  'data-alarm': { category: 'lowVoltage', type: 'custom' },
  'data-camera': { category: 'lowVoltage', type: 'custom' },
  'data-speaker': { category: 'lowVoltage', type: 'custom' },
  'data-smart-home': { category: 'lowVoltage', type: 'custom' },
};

/** Catalog in palette order. */
export const DEVICE_SUBTYPES: readonly DeviceSubtypeDefinition[] =
  DEVICE_SUBTYPE_IDS.map((id) => ({
    id,
    ...DEVICE_SUBTYPE_DEFINITIONS[id],
  }));

export const DEVICE_CATEGORY_ORDER: readonly DeviceCategory[] = [
  'distribution',
  'boxes',
  'power',
  'control',
  'lighting',
  'lowVoltage',
];

export function deviceSubtype(id: string): DeviceSubtypeDefinition | null {
  return (
    DEVICE_SUBTYPES.find((definition) => definition.id === id) ?? null
  );
}

export function deviceSubtypesForCategory(
  category: DeviceCategory,
): DeviceSubtypeDefinition[] {
  return DEVICE_SUBTYPES.filter(
    (definition) => definition.category === category,
  );
}
