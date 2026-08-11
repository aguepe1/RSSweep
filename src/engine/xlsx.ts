// XLSX — escritor mínimo de libros Excel SIN dependencias (E4-3). Genera OOXML
// SpreadsheetML y lo empaqueta en un ZIP por método STORE (sin compresión: Excel
// lo acepta y el volumen aquí es pequeño), con CRC32 propio. Se evita SheetJS a
// propósito: duplicaría el tamaño del HTML único offline (requisito duro). Cadenas
// como inlineStr (sin sharedStrings); cabecera en negrita + congelada; anchos de
// columna; relleno rojo opcional para estados. Puro: sin DOM, testeable.

/** Celda: texto/número simple, o con relleno de estado (rojo). */
export type XlsxCell = string | number | { v: string | number; fill?: "red" };
export interface XlsxSheet {
  name: string;
  headers: string[];
  rows: XlsxCell[][];
  /** Anchos de columna (caracteres Excel); opcional. */
  cols?: number[];
}

const enc = new TextEncoder();

// ------------------------------------------------------------------- CRC32
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// -------------------------------------------------------------------- XML
const xmlEsc = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );

/** Referencia A1 de una celda (col 0-based, row 0-based). */
function ref(col: number, row: number): string {
  let s = "";
  let n = col;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s + (row + 1);
}

const isNum = (c: XlsxCell): c is number => typeof c === "number";

function cellXml(c: XlsxCell, col: number, row: number): string {
  const r = ref(col, row);
  if (isNum(c)) {
    return Number.isFinite(c) ? `<c r="${r}"><v>${c}</v></c>` : `<c r="${r}"/>`;
  }
  if (typeof c === "string") {
    return `<c r="${r}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c)}</t></is></c>`;
  }
  const style = c.fill === "red" ? ' s="2"' : "";
  if (typeof c.v === "number") {
    return Number.isFinite(c.v) ? `<c r="${r}"${style}><v>${c.v}</v></c>` : `<c r="${r}"${style}/>`;
  }
  return `<c r="${r}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEsc(c.v)}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet): string {
  const cols =
    sheet.cols && sheet.cols.length
      ? `<cols>${sheet.cols
          .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
          .join("")}</cols>`
      : "";
  const headerRow = `<row r="1">${sheet.headers
    .map(
      (h, i) =>
        `<c r="${ref(i, 0)}" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(h)}</t></is></c>`,
    )
    .join("")}</row>`;
  const body = sheet.rows
    .map(
      (cells, ri) =>
        `<row r="${ri + 2}">${cells.map((c, ci) => cellXml(c, ci, ri + 1)).join("")}</row>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    cols +
    `<sheetData>${headerRow}${body}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>` +
  `<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill>` +
  `<fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFFBEAEA"/></patternFill></fill></fills>` +
  `<borders count="1"><border/></borders>` +
  `<cellStyleXfs count="1"><xf/></cellStyleXfs>` +
  `<cellXfs count="3">` +
  `<xf xfId="0"/>` + // 0: default
  `<xf xfId="0" fontId="1" applyFont="1"/>` + // 1: bold (header)
  `<xf xfId="0" fillId="2" applyFill="1"/>` + // 2: red fill (estado)
  `</cellXfs></styleSheet>`;

function workbookXml(sheets: XlsxSheet[]): string {
  const s = sheets
    .map(
      (sh, i) =>
        `<sheet name="${xmlEsc(sh.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${s}</sheets></workbook>`
  );
}

// -------------------------------------------------------------------- ZIP
interface ZipEntry {
  name: string;
  data: Uint8Array;
}
function u16(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff];
}
function u32(n: number): number[] {
  return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
}

/** Empaqueta las entradas en un ZIP (método store, sin compresión). */
function zip(entries: ZipEntry[]): Uint8Array {
  const chunks: number[][] = [];
  const central: number[][] = [];
  let offset = 0;
  for (const e of entries) {
    const nameB = Array.from(enc.encode(e.name));
    const crc = crc32(e.data);
    const sz = e.data.length;
    const local = [
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0), // time/date 0
      ...u32(crc),
      ...u32(sz),
      ...u32(sz),
      ...u16(nameB.length),
      ...u16(0),
      ...nameB,
    ];
    chunks.push(local, Array.from(e.data));
    central.push([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(crc),
      ...u32(sz),
      ...u32(sz),
      ...u16(nameB.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
      ...nameB,
    ]);
    offset += local.length + sz;
  }
  const cdStart = offset;
  let cdLen = 0;
  for (const c of central) cdLen += c.length;
  const end = [
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(cdLen),
    ...u32(cdStart),
    ...u16(0),
  ];
  const total = offset + cdLen + end.length;
  const out = new Uint8Array(total);
  let p = 0;
  const put = (arr: number[] | Uint8Array): void => {
    out.set(arr instanceof Uint8Array ? arr : Uint8Array.from(arr), p);
    p += arr.length;
  };
  for (const c of chunks) put(c);
  for (const c of central) put(c);
  put(end);
  return out;
}

/** Construye un libro .xlsx (bytes) a partir de las hojas dadas. */
export function buildXlsx(sheets: XlsxSheet[]): Uint8Array {
  const files: ZipEntry[] = [];
  const add = (name: string, xml: string): void => {
    files.push({ name, data: enc.encode(xml) });
  };

  add(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
      `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
      `<Default Extension="xml" ContentType="application/xml"/>` +
      `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
      `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
      sheets
        .map(
          (_, i) =>
            `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
        )
        .join("") +
      `</Types>`,
  );
  add(
    "_rels/.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
      `</Relationships>`,
  );
  add("xl/workbook.xml", workbookXml(sheets));
  add(
    "xl/_rels/workbook.xml.rels",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
      `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
      sheets
        .map(
          (_, i) =>
            `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
        )
        .join("") +
      `<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
      `</Relationships>`,
  );
  add("xl/styles.xml", STYLES_XML);
  sheets.forEach((sh, i) => add(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(sh)));
  return zip(files);
}
