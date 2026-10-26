/**
 * Minimal XLSX writer: a ZIP archive with stored (uncompressed) entries and
 * SpreadsheetML worksheets. Writing XML directly avoids a third-party
 * dependency while still producing a real Excel workbook with styled headers,
 * frozen panes, column widths, autofilter and typed numeric cells.
 */

export type XlsxCell = string | number | null | undefined;

export interface XlsxColumn {
  label: string;
  /** Column width in Excel character units. */
  width?: number;
}

export interface XlsxSheet {
  name: string;
  columns: readonly XlsxColumn[];
  rows: readonly (readonly XlsxCell[])[];
  /** Optional bold row rendered after the data (e.g. totals). */
  total?: readonly XlsxCell[];
}

export interface XlsxWorkbookMeta {
  title?: string;
  creator?: string;
  createdAt?: Date;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);

  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }

  return table;
})();

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index] ?? 0;
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function stripInvalidXmlChars(value: string): string {
  let result = '';

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const valid =
      code === 0x09 ||
      code === 0x0a ||
      code === 0x0d ||
      (code >= 0x20 && code <= 0xd7ff) ||
      (code >= 0xe000 && code <= 0xfffd) ||
      code >= 0x10000;

    if (valid) result += char;
  }

  return result;
}

function xmlEscape(value: string): string {
  return stripInvalidXmlChars(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Excel columns use A..Z, AA..AZ, ... */
export function columnLetter(index: number): string {
  let value = Math.max(0, Math.floor(index));
  let result = '';

  do {
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26) - 1;
  } while (value >= 0);

  return result;
}

function safeSheetName(name: string, used: Set<string>): string {
  const base =
    name
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 31) || 'Sheet';

  let candidate = base;
  let suffix = 2;

  while (used.has(candidate.toLowerCase())) {
    const tail = ` (${suffix})`;
    candidate = `${base.slice(0, 31 - tail.length)}${tail}`;
    suffix += 1;
  }

  used.add(candidate.toLowerCase());
  return candidate;
}

function cellXml(
  reference: string,
  value: XlsxCell,
  styleIndex: number | null,
): string {
  const style = styleIndex === null ? '' : ` s="${styleIndex}"`;

  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${style}><v>${value}</v></c>`;
  }

  const text = value === null || value === undefined ? '' : String(value);

  if (!text) return styleIndex === null ? '' : `<c r="${reference}"${style}/>`;

  return `<c r="${reference}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(
    text.slice(0, 32_767),
  )}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const columns = sheet.columns.length > 0 ? sheet.columns : [{ label: 'Value' }];
  const rows = sheet.rows;
  const lastColumn = columnLetter(columns.length - 1);
  const lastRow = Math.max(1, rows.length + 1 + (sheet.total ? 1 : 0));

  const cols = columns
    .map((column, index) => {
      const width = Math.min(80, Math.max(8, column.width ?? 16));
      return `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`;
    })
    .join('');

  const header = `<row r="1">${columns
    .map((column, index) =>
      cellXml(`${columnLetter(index)}1`, column.label, 1),
    )
    .join('')}</row>`;

  const body = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 2;
      const cells = columns
        .map((_, columnIndex) =>
          cellXml(
            `${columnLetter(columnIndex)}${rowNumber}`,
            row[columnIndex],
            null,
          ),
        )
        .join('');

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join('');

  const total = sheet.total
    ? `<row r="${lastRow}">${columns
        .map((_, index) =>
          cellXml(`${columnLetter(index)}${lastRow}`, sheet.total?.[index], 2),
        )
        .join('')}</row>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastColumn}${lastRow}"/>
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${header}${body}${total}</sheetData>
<autoFilter ref="A1:${lastColumn}${Math.max(1, rows.length + 1)}"/>
</worksheet>`;
}

function contentTypesXml(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheets}
</Types>`;
}

function rootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function workbookXml(names: readonly string[]): string {
  const sheets = names
    .map(
      (name, index) =>
        `<sheet name="${xmlEscape(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`,
    )
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheets}</sheets>
</workbook>`;
}

function workbookRelsXml(sheetCount: number): string {
  const sheets = Array.from(
    { length: sheetCount },
    (_, index) =>
      `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${sheets}
<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function stylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/></font>
<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="FFF1F5F9"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="3">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

function dosDateTime(date: Date): { time: number; date: number } {
  const year = Math.max(1980, date.getFullYear());

  return {
    time:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

interface ZipEntry {
  name: string;
  bytes: Uint8Array;
}

/** Builds a ZIP container using the store method (no compression). */
export function zipStore(entries: readonly ZipEntry[], date = new Date()): Uint8Array {
  const encoder = new TextEncoder();
  const stamp = dosDateTime(date);
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const crc = crc32(entry.bytes);
    const local = new Uint8Array(30 + nameBytes.length + entry.bytes.length);
    const view = new DataView(local.buffer);

    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, stamp.time, true);
    view.setUint16(12, stamp.date, true);
    view.setUint32(14, crc, true);
    view.setUint32(18, entry.bytes.length, true);
    view.setUint32(22, entry.bytes.length, true);
    view.setUint16(26, nameBytes.length, true);
    view.setUint16(28, 0, true);
    local.set(nameBytes, 30);
    local.set(entry.bytes, 30 + nameBytes.length);
    localParts.push(local);

    const central = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, stamp.time, true);
    centralView.setUint16(14, stamp.date, true);
    centralView.setUint32(16, crc, true);
    centralView.setUint32(20, entry.bytes.length, true);
    centralView.setUint32(24, entry.bytes.length, true);
    centralView.setUint16(28, nameBytes.length, true);
    centralView.setUint16(30, 0, true);
    centralView.setUint16(32, 0, true);
    centralView.setUint16(34, 0, true);
    centralView.setUint16(36, 0, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(nameBytes, 46);
    centralParts.push(central);

    offset += local.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(4, 0, true);
  endView.setUint16(6, 0, true);
  endView.setUint16(8, entries.length, true);
  endView.setUint16(10, entries.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  endView.setUint16(20, 0, true);

  const total =
    offset + centralSize + end.length;
  const output = new Uint8Array(total);
  let cursor = 0;

  for (const part of [...localParts, ...centralParts, end]) {
    output.set(part, cursor);
    cursor += part.length;
  }

  return output;
}

function withDefaults(sheet: XlsxSheet): XlsxSheet {
  return {
    name: sheet.name,
    columns: sheet.columns.length > 0 ? sheet.columns : [{ label: 'Value' }],
    rows: sheet.rows,
    total: sheet.total,
  };
}

/** Builds a complete XLSX workbook as bytes. */
export function buildXlsx(
  sheets: readonly XlsxSheet[],
  meta: XlsxWorkbookMeta = {},
): Uint8Array {
  const encoder = new TextEncoder();
  const usedNames = new Set<string>();
  const normalized = sheets.map((sheet) => {
    const copy = withDefaults(sheet);
    return { ...copy, name: safeSheetName(copy.name, usedNames) };
  });

  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', bytes: encoder.encode(contentTypesXml(normalized.length)) },
    { name: '_rels/.rels', bytes: encoder.encode(rootRelsXml()) },
    { name: 'xl/workbook.xml', bytes: encoder.encode(workbookXml(normalized.map((sheet) => sheet.name))) },
    { name: 'xl/_rels/workbook.xml.rels', bytes: encoder.encode(workbookRelsXml(normalized.length)) },
    { name: 'xl/styles.xml', bytes: encoder.encode(stylesXml()) },
    ...normalized.map((sheet, index) => ({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      bytes: encoder.encode(sheetXml(sheet)),
    })),
  ];

  return zipStore(entries, meta.createdAt ?? new Date());
}

export const XLSX_MIME =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
