import type { DeviceCategory, DeviceSubtype } from './devices';
import { DEVICE_SUBTYPE_DEFINITIONS } from './devices';
import { SIGNALING_DEVICE_LIBRARY } from './device-library-signaling';

/**
 * Curated catalog of standard devices with manufacturer articles. Symbols are
 * derived from the subtype; this catalog connects them to purchasable products
 * that can be attached to a plan point and printed in the equipment report.
 */
export interface DeviceProduct {
  id: string;
  subtype: DeviceSubtype;
  manufacturer: string;
  series: string;
  name: string;
  /** Manufacturer order code. */
  article: string;
  /** Standard the article is certified against. */
  standard: string;
  /** Human-readable rating, e.g. "16 A · C · 1P". */
  rating: string;
  /** Suggested catalog unit price in the project currency. */
  unitPrice: number | null;
  unit: 'pcs';
  /** Optional code of a matching material catalog entry. */
  materialCode?: string;
  notes?: string;

  /** Discipline this article belongs to. */
  system?: 'security' | 'fire' | 'access' | 'cctv' | 'pa' | 'data';
  /** Supply voltage label, e.g. "12 V DC". */
  voltage?: string;
  /** Quiescent current in amperes (signaling). */
  currentStandbyA?: number;
  /** Alarm current in amperes (signaling). */
  currentAlarmA?: number;
  /** Rated power in watts (sirens, cameras, network gear). */
  powerW?: number;
  /** Detection coverage for smoke/heat detectors, m². */
  coverageAreaM2?: number;
  /** Visual coverage radius for PIR/CCTV/sirens, m. */
  coverageRadiusM?: number;
  /** Supports addressed loops. */
  loopAddressable?: boolean;
  /** Optional catalog grouping code. */
  catalogCode?: string;
  /** Compatible control panel product ids. */
  compatibility?: string[];
  /** Canvas glyph hint for signaling devices. */
  symbol?:
    | 'smoke'
    | 'heat'
    | 'pir'
    | 'door'
    | 'siren'
    | 'camera'
    | 'panel'
    | 'strobe'
    | 'default';
}

export const DEVICE_LIBRARY: readonly DeviceProduct[] = [
  {
    id: 'schneider-ic60n-c16-1p',
    subtype: 'circuit-origin',
    manufacturer: 'Schneider Electric',
    series: 'Acti9 iC60N',
    name: 'Miniature circuit breaker C16 1P',
    article: 'A9F03116',
    standard: 'IEC 60898-1; ДСТУ EN 60898-1',
    rating: '16 A · C · 1P · 6 kA',
    unitPrice: 4.8,
    unit: 'pcs',
    materialCode: 'MCB-C16-1P',
  },
  {
    id: 'schneider-ic60n-c10-1p',
    subtype: 'circuit-origin',
    manufacturer: 'Schneider Electric',
    series: 'Acti9 iC60N',
    name: 'Miniature circuit breaker C10 1P',
    article: 'A9F03110',
    standard: 'IEC 60898-1; ДСТУ EN 60898-1',
    rating: '10 A · C · 1P · 6 kA',
    unitPrice: 4.8,
    unit: 'pcs',
    materialCode: 'MCB-C10-1P',
  },
  {
    id: 'abb-s201-c16',
    subtype: 'circuit-origin',
    manufacturer: 'ABB',
    series: 'System pro M compact S200',
    name: 'Miniature circuit breaker C16 1P',
    article: '2CDS251001R0164',
    standard: 'IEC 60898-1; ДСТУ EN 60898-1',
    rating: '16 A · C · 1P · 6 kA',
    unitPrice: 4.1,
    unit: 'pcs',
    materialCode: 'MCB-C16-1P',
  },
  {
    id: 'hager-mbn116a',
    subtype: 'circuit-origin',
    manufacturer: 'Hager',
    series: 'MBN',
    name: 'Miniature circuit breaker C16 1P',
    article: 'MBN116A',
    standard: 'IEC 60898-1; ДСТУ EN 60898-1',
    rating: '16 A · C · 1P · 6 kA',
    unitPrice: 4.3,
    unit: 'pcs',
    materialCode: 'MCB-C16-1P',
  },
  {
    id: 'schneider-iid-40-30-2p',
    subtype: 'circuit-origin',
    manufacturer: 'Schneider Electric',
    series: 'Acti9 iID',
    name: 'Residual current device 40 A / 30 mA 2P',
    article: 'A9R51240',
    standard: 'IEC 61008-1; ДСТУ EN 61008-1',
    rating: '40 A · 30 mA · 2P · AC',
    unitPrice: 28.5,
    unit: 'pcs',
    materialCode: 'RCD-40-30-2P',
  },
  {
    id: 'abb-f204-40-30',
    subtype: 'circuit-origin',
    manufacturer: 'ABB',
    series: 'F200',
    name: 'Residual current device 40 A / 30 mA 2P',
    article: '2CSF204001R1400',
    standard: 'IEC 61008-1; ДСТУ EN 61008-1',
    rating: '40 A · 30 mA · 2P · AC',
    unitPrice: 26.9,
    unit: 'pcs',
    materialCode: 'RCD-40-30-2P',
  },
  {
    id: 'hager-cdc240j',
    subtype: 'circuit-origin',
    manufacturer: 'Hager',
    series: 'CDC',
    name: 'Residual current device 40 A / 30 mA 2P',
    article: 'CDC240J',
    standard: 'IEC 61008-1; ДСТУ EN 61008-1',
    rating: '40 A · 30 mA · 2P · A',
    unitPrice: 31.2,
    unit: 'pcs',
    materialCode: 'RCD-40-30-2P',
  },
  {
    id: 'schneider-acti9-board-36',
    subtype: 'main-board',
    manufacturer: 'Schneider Electric',
    series: 'Acti9',
    name: 'Distribution board 36 modules, flush',
    article: 'SEA9BN36',
    standard: 'IEC 61439-3; ДСТУ EN 61439-3',
    rating: '36 modules · 3 rows · IP40',
    unitPrice: 96,
    unit: 'pcs',
  },
  {
    id: 'hager-vu12nc',
    subtype: 'sub-board',
    manufacturer: 'Hager',
    series: 'Volta',
    name: 'Distribution board 12 modules, surface',
    article: 'VU12NC',
    standard: 'IEC 61439-3; ДСТУ EN 61439-3',
    rating: '12 modules · 1 row · IP40',
    unitPrice: 24,
    unit: 'pcs',
  },
  {
    id: 'hensel-k9060',
    subtype: 'junction-box',
    manufacturer: 'Hensel',
    series: 'K',
    name: 'Junction box IP65 90 × 90 × 60 mm',
    article: 'K 9060',
    standard: 'IEC 60670-22; ДСТУ EN 60670-22',
    rating: 'IP65 · 5 terminals',
    unitPrice: 3.2,
    unit: 'pcs',
    materialCode: 'BOX-IP65-90',
  },
  {
    id: 'kopos-kpr-100',
    subtype: 'ceiling-junction-box',
    manufacturer: 'Kopos',
    series: 'KPR',
    name: 'Ceiling junction box 100 × 100 mm',
    article: 'KPR 100',
    standard: 'IEC 60670-22',
    rating: 'IP40 · 100 × 100 mm',
    unitPrice: 1.1,
    unit: 'pcs',
  },
  {
    id: 'legrand-batibox-floor',
    subtype: 'floor-box',
    manufacturer: 'Legrand',
    series: 'Batibox',
    name: 'Floor box 2-gang with lid',
    article: '089661',
    standard: 'IEC 60670-23',
    rating: '2-gang · IP20',
    unitPrice: 19,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-single',
    subtype: 'socket-single',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Single socket 16 A, white',
    article: 'SDN3001171',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '16 A · 250 V · IP20',
    unitPrice: 3.6,
    unit: 'pcs',
    materialCode: 'SOCKET-1-WHITE',
  },
  {
    id: 'schneider-sedna-double',
    subtype: 'socket-double',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Double socket 16 A, white',
    article: 'SDN3002171',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '2 × 16 A · 250 V · IP20',
    unitPrice: 5.4,
    unit: 'pcs',
    materialCode: 'SOCKET-2-WHITE',
  },
  {
    id: 'legrand-valena-double',
    subtype: 'socket-double',
    manufacturer: 'Legrand',
    series: 'Valena Life',
    name: 'Double socket 16 A with shutter, white',
    article: '753124',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '2 × 16 A · 250 V · IP20',
    unitPrice: 6.2,
    unit: 'pcs',
    materialCode: 'SOCKET-2-WHITE',
  },
  {
    id: 'schneider-sedna-triple',
    subtype: 'socket-triple',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Triple socket 16 A, white',
    article: 'SDN3003171',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '3 × 16 A · 250 V · IP20',
    unitPrice: 7.8,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-kitchen',
    subtype: 'socket-kitchen',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Kitchen socket 16 A with cover',
    article: 'SDN3011171',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '16 A · 250 V · IP44',
    unitPrice: 6.9,
    unit: 'pcs',
  },
  {
    id: 'hensel-outdoor-socket',
    subtype: 'socket-outdoor',
    manufacturer: 'Hensel',
    series: 'ENY',
    name: 'Outdoor socket 16 A IP54',
    article: 'ENY 213',
    standard: 'IEC 60884-1; ДСТУ EN 60884-1',
    rating: '16 A · 250 V · IP54',
    unitPrice: 7.5,
    unit: 'pcs',
  },
  {
    id: 'legrand-three-phase-socket',
    subtype: 'socket-three-phase',
    manufacturer: 'Legrand',
    series: 'P17',
    name: 'Three-phase socket 16 A 5P IP44',
    article: '555229',
    standard: 'IEC 60309-2',
    rating: '16 A · 400 V · 3P+N+E · IP44',
    unitPrice: 11.4,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-switch-single',
    subtype: 'switch-single',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Single switch 10 AX, white',
    article: 'SDN0100121',
    standard: 'IEC 60669-1; ДСТУ EN 60669-1',
    rating: '10 AX · 250 V',
    unitPrice: 3.1,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-switch-double',
    subtype: 'switch-double',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Double switch 10 AX, white',
    article: 'SDN0100221',
    standard: 'IEC 60669-1; ДСТУ EN 60669-1',
    rating: '2 × 10 AX · 250 V',
    unitPrice: 4.2,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-two-way',
    subtype: 'switch-two-way',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Two-way switch 10 AX, white',
    article: 'SDN0100321',
    standard: 'IEC 60669-1; ДСТУ EN 60669-1',
    rating: '10 AX · 250 V',
    unitPrice: 3.6,
    unit: 'pcs',
  },
  {
    id: 'schneider-sedna-dimmer',
    subtype: 'dimmer',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'Rotary dimmer 300 W, white',
    article: 'SDN0600121',
    standard: 'IEC 60669-2-1; ДСТУ EN 60669-2-1',
    rating: '300 W · 230 V',
    unitPrice: 18.5,
    unit: 'pcs',
  },
  {
    id: 'schneider-argus-motion',
    subtype: 'motion-sensor',
    manufacturer: 'Schneider Electric',
    series: 'Argus',
    name: 'Motion sensor 180°, flush',
    article: 'MTN630819',
    standard: 'IEC 60669-2-1',
    rating: '180° · 8 m · 1000 W',
    unitPrice: 34,
    unit: 'pcs',
  },
  {
    id: 'schneider-wiser-thermostat',
    subtype: 'thermostat',
    manufacturer: 'Schneider Electric',
    series: 'Wiser',
    name: 'Room thermostat, white',
    article: 'CCTFR6400',
    standard: 'IEC 60730-1',
    rating: '230 V · 5–30 °C',
    unitPrice: 62,
    unit: 'pcs',
  },
  {
    id: 'schneider-odin-ceiling',
    subtype: 'light-ceiling',
    manufacturer: 'Schneider Electric',
    series: 'Odin',
    name: 'LED ceiling luminaire 18 W',
    article: 'ODIN18WH',
    standard: 'IEC 60598-1; ДСТУ EN 60598-1',
    rating: '18 W · 4000 K · 1800 lm',
    unitPrice: 21,
    unit: 'pcs',
  },
  {
    id: 'schneider-emergency-light',
    subtype: 'light-emergency',
    manufacturer: 'Schneider Electric',
    series: 'Exiway',
    name: 'Emergency luminaire 3 h, maintained',
    article: 'EXIWAY-POWER',
    standard: 'IEC 60598-2-22; ДСТУ EN 60598-2-22',
    rating: '3 h · 300 lm',
    unitPrice: 48,
    unit: 'pcs',
  },
  {
    id: 'schneider-rj45-socket',
    subtype: 'data-lan',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'RJ45 Cat.6 UTP socket, white',
    article: 'SDN4100121',
    standard: 'IEC 60603-7-4',
    rating: 'Cat.6 UTP · 1 port',
    unitPrice: 8.4,
    unit: 'pcs',
  },
  {
    id: 'schneider-tv-socket',
    subtype: 'data-tv',
    manufacturer: 'Schneider Electric',
    series: 'Sedna',
    name: 'TV socket, shielded, white',
    article: 'SDN4500121',
    standard: 'IEC 61169-2',
    rating: 'TV/R · 1 port',
    unitPrice: 6.1,
    unit: 'pcs',
  },
  {
    id: 'hikvision-camera-point',
    subtype: 'data-camera',
    manufacturer: 'Hikvision',
    series: 'AcuSense',
    name: 'IP camera connection point',
    article: 'DS-2CD1043G2-I',
    standard: 'IEC 62676-1-1',
    rating: '4 MP · PoE · IP67',
    unitPrice: 96,
    unit: 'pcs',
  },
  ...SIGNALING_DEVICE_LIBRARY,
];

const PRODUCTS_BY_ID = new Map(
  DEVICE_LIBRARY.map((product) => [product.id, product]),
);

export function deviceProduct(id: string | null | undefined): DeviceProduct | null {
  return id ? (PRODUCTS_BY_ID.get(id) ?? null) : null;
}

export function deviceProductsForSubtype(
  subtype: DeviceSubtype,
): DeviceProduct[] {
  return DEVICE_LIBRARY.filter((product) => product.subtype === subtype);
}

export function deviceProductsForCategory(
  category: DeviceCategory,
): DeviceProduct[] {
  return DEVICE_LIBRARY.filter(
    (product) => DEVICE_SUBTYPE_DEFINITIONS[product.subtype].category === category,
  );
}

export function libraryManufacturers(): string[] {
  return [...new Set(DEVICE_LIBRARY.map((product) => product.manufacturer))].sort(
    (a, b) => a.localeCompare(b),
  );
}

/** Case-insensitive search across name, series, article, manufacturer and rating. */
export function searchDeviceProducts(
  query: string,
  options: {
    category?: DeviceCategory | null;
    subtype?: DeviceSubtype | null;
    system?: DeviceProduct['system'] | null;
  } = {},
): DeviceProduct[] {
  const needle = query.trim().toLowerCase();

  return DEVICE_LIBRARY.filter((product) => {
    if (options.category) {
      if (DEVICE_SUBTYPE_DEFINITIONS[product.subtype].category !== options.category) {
        return false;
      }
    }
    if (options.subtype && product.subtype !== options.subtype) return false;
    if (options.system && product.system !== options.system) return false;
    if (!needle) return true;

    return [
      product.name,
      product.series,
      product.article,
      product.manufacturer,
      product.rating,
      product.standard,
    ]
      .join(' ')
      .toLowerCase()
      .includes(needle);
  });
}
