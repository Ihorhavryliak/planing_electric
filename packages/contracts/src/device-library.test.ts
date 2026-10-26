import { describe, expect, it } from 'vitest';
import {
  DEVICE_LIBRARY,
  DEVICE_SUBTYPE_DEFINITIONS,
  deviceProduct,
  deviceProductsForCategory,
  deviceProductsForSubtype,
  libraryManufacturers,
  searchDeviceProducts,
} from './index';

describe('standard device library', () => {
  it('contains unique ids and valid subtypes', () => {
    const ids = new Set<string>();

    for (const product of DEVICE_LIBRARY) {
      expect(ids.has(product.id)).toBe(false);
      ids.add(product.id);
      expect(DEVICE_SUBTYPE_DEFINITIONS[product.subtype]).toBeDefined();
      expect(product.standard.length).toBeGreaterThan(3);
      expect(product.article.length).toBeGreaterThan(1);
      expect(product.unitPrice === null || product.unitPrice > 0).toBe(true);
    }

    expect(DEVICE_LIBRARY.length).toBeGreaterThanOrEqual(25);
  });

  it('covers breakers, RCDs, sockets and junction boxes', () => {
    expect(deviceProductsForSubtype('circuit-origin').length).toBeGreaterThan(2);
    expect(deviceProductsForSubtype('socket-double').length).toBeGreaterThan(1);
    expect(deviceProductsForSubtype('junction-box').length).toBeGreaterThan(0);
    expect(deviceProductsForCategory('power').length).toBeGreaterThan(4);
  });

  it('finds products by article, manufacturer and name', () => {
    expect(searchDeviceProducts('A9F03116')[0]?.manufacturer).toBe(
      'Schneider Electric',
    );
    expect(searchDeviceProducts('abb').length).toBeGreaterThan(0);
    expect(searchDeviceProducts('double socket').length).toBeGreaterThan(0);
    expect(searchDeviceProducts('неіснуючий').length).toBe(0);
    expect(searchDeviceProducts('', { category: 'lighting' }).length).toBeGreaterThan(
      0,
    );
  });

  it('resolves products by id and lists manufacturers', () => {
    expect(deviceProduct('schneider-ic60n-c16-1p')?.article).toBe('A9F03116');
    expect(deviceProduct('missing')).toBeNull();
    expect(deviceProduct(null)).toBeNull();
    expect(libraryManufacturers()).toContain('ABB');
  });
});
