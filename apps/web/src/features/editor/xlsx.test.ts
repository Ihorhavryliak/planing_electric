import { describe, expect, it } from 'vitest';
import { buildXlsx, columnLetter, crc32, zipStore } from './xlsx';

function decode(bytes: Uint8Array): string {
  return new TextDecoder('latin1').decode(bytes);
}

describe('xlsx writer', () => {
  it('computes the standard CRC-32 checksum', () => {
    const bytes = new TextEncoder().encode('123456789');
    expect(crc32(bytes)).toBe(0xcbf43926);
  });

  it('builds column letters past Z', () => {
    expect(columnLetter(0)).toBe('A');
    expect(columnLetter(25)).toBe('Z');
    expect(columnLetter(26)).toBe('AA');
    expect(columnLetter(701)).toBe('ZZ');
    expect(columnLetter(702)).toBe('AAA');
  });

  it('writes a ZIP with stored entries', () => {
    const bytes = zipStore([
      { name: 'a.txt', bytes: new TextEncoder().encode('hello') },
    ]);
    const text = decode(bytes);

    expect(String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!)).toBe(
      'PK\u0003\u0004',
    );
    expect(text).toContain('a.txt');
    expect(text).toContain('hello');
    expect(text).toContain('PK\u0001\u0002');
    expect(text).toContain('PK\u0005\u0006');
  });

  it('builds a workbook with typed cells, a bold total and multiple sheets', () => {
    const bytes = buildXlsx(
      [
        {
          name: 'Equipment',
          columns: [
            { label: 'Item', width: 24 },
            { label: 'Qty', width: 8 },
          ],
          rows: [
            ['Cable <A&B>', 12],
            ['Socket "double"', 4],
          ],
          total: ['Total', 16],
        },
        {
          name: 'Panel schedule',
          columns: [{ label: 'Way' }],
          rows: [[1]],
        },
      ],
      { title: 'Test workbook' },
    );
    const text = decode(bytes);

    expect(text).toContain('[Content_Types].xml');
    expect(text).toContain('xl/workbook.xml');
    expect(text).toContain('xl/worksheets/sheet1.xml');
    expect(text).toContain('xl/worksheets/sheet2.xml');
    expect(text).toContain('Cable &lt;A&amp;B&gt;');
    expect(text).toContain('<v>12</v>');
    expect(text).toContain('state="frozen"');
    expect(text).toContain('<autoFilter ref="A1:B3"/>');
    expect(text).toContain('s="2"');
  });

  it('sanitizes duplicate and invalid sheet names', () => {
    const bytes = buildXlsx([
      {
        name: 'Bad/name[1]',
        columns: [{ label: 'A' }],
        rows: [],
      },
      {
        name: 'Bad/name[1]',
        columns: [{ label: 'A' }],
        rows: [],
      },
    ]);
    const text = decode(bytes);

    expect(text).toContain('name="Bad name 1"');
    expect(text).toContain('name="Bad name 1 (2)"');
  });
});
