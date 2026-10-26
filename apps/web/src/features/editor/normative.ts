import type {
  ElectricalIssueCode,
  PanelIssueCode,
} from '@drawmyplace/calculations';

/** Normative references shown next to validation rows. */
export const NORM_REFERENCES: Partial<
  Record<ElectricalIssueCode | PanelIssueCode, string>
> = {
  breakerExceedsCable: 'ПУЭ 3.1.4; ДБН В.2.5-23:2010, п. 8.2',
  currentExceedsBreaker: 'ПУЭ 3.1.4; ДБН В.2.5-23:2010, п. 8.2',
  unknownCableSection: 'ПУЭ 3.1.4',
  voltageDropExceeded: 'ДБН В.2.5-23:2010, п. 8.7',
  faultCurrentLow: 'ПУЭ 1.7.79; ДБН В.2.5-23:2010, п. 8.6',
  breakingCapacityExceeded: 'ПУЭ 3.1.4; ДБН В.2.5-23:2010, п. 8.2',
  rcdMissing: 'ПУЭ 7.1.79; ДБН В.2.5-23:2010, п. 8.5',
  rcdSensitivityHigh: 'ПУЭ 7.1.79',
  rcdRatingLow: 'ПУЭ 7.1.79',
  panelOverflow: 'ДБН В.2.5-23:2010, п. 8.9',
  panelNearlyFull: 'ДБН В.2.5-23:2010, п. 8.9',
  mainBreakerUndersized: 'ДБН В.2.5-23:2010, п. 8.2',
};

const WET_ROOM_WORDS = [
  'bath',
  'shower',
  'wc',
  'toilet',
  'laundry',
  'sauna',
  'steam',
  'pool',
  'вулич',
  'ванн',
  'душ',
  'санвузол',
  'туалет',
  'пральн',
  'саун',
  'басейн',
  'ванная',
  'санузел',
  'прачечн',
];

/**
 * Conservative wet-room detection by name. The editor has no dedicated room
 * climate field yet, so bathroom/laundry/etc. names drive the extra checks.
 */
export function isWetRoomName(name: string): boolean {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return false;
  return WET_ROOM_WORDS.some((word) => normalized.includes(word));
}

export function pointInPolygon(
  point: { x: number; y: number },
  polygon: readonly { x: number; y: number }[],
): boolean {
  if (polygon.length < 3) return false;

  let inside = false;
  for (let index = 0; index < polygon.length; index += 1) {
    const a = polygon[index];
    const b = polygon[(index + 1) % polygon.length];
    if (!a || !b) continue;

    const intersects =
      a.y > point.y !== b.y > point.y &&
      point.x <
        ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y || 1e-12) + a.x;

    if (intersects) inside = !inside;
  }

  return inside;
}
