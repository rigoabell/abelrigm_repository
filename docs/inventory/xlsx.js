const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(view, offset, value) {
  view.setUint16(offset, value, true);
}

function u32(view, offset, value) {
  view.setUint32(offset, value, true);
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = file.data instanceof Uint8Array ? file.data : encoder.encode(String(file.data));
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 8, 0);
    u32(localView, 14, crc);
    u32(localView, 18, data.length);
    u32(localView, 22, data.length);
    u16(localView, 26, name.length);
    local.set(name, 30);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u32(centralView, 16, crc);
    u32(centralView, 20, data.length);
    u32(centralView, 24, data.length);
    u16(centralView, 28, name.length);
    u32(centralView, 42, offset);
    central.set(name, 46);
    locals.push(local, data);
    centrals.push(central);
    offset += local.length + data.length;
  }
  const centralBytes = concatBytes(centrals);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, files.length);
  u16(endView, 10, files.length);
  u32(endView, 12, centralBytes.length);
  u32(endView, 16, offset);
  return concatBytes([...locals, centralBytes, end]);
}

function xmlEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetters(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function numberText(value) {
  const number = Number(value) || 0;
  if (Math.abs(number - Math.round(number)) < 1e-6) return String(Math.round(number));
  return String(Math.round(number * 1000) / 1000);
}

function sheetXml(rows) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((cell, col) => {
          if (cell == null || cell.value == null || cell.value === "") return "";
          const ref = colLetters(col) + (rowIndex + 1);
          const style = cell.header ? ' s="1"' : "";
          if (cell.number) return `<c r="${ref}"${style}><v>${numberText(cell.value)}</v></c>`;
          return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(cell.value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

function textCell(value, header) {
  return { value, header: Boolean(header) };
}

function numberCell(value) {
  return { value, number: true };
}

function headerRow(labels) {
  return labels.map((label) => textCell(label, true));
}

export function sheetTitle(name, used) {
  let base = String(name || "Responder").replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim() || "Responder";
  if (base.toLowerCase() === "assignments") base = "Responder";
  base = base.slice(0, 31);
  let title = base;
  let n = 2;
  while (used.has(title.toLowerCase())) {
    const suffix = " " + n;
    title = base.slice(0, Math.max(1, 31 - suffix.length)) + suffix;
    n += 1;
  }
  used.add(title.toLowerCase());
  return title;
}

const MASTER_HEADERS = ["IOL Responder", "Kind", "Name", "Approaching units", "At units", "DIOT units"];
const PERSON_HEADERS = ["Kind", "Name", "Approaching units", "At units", "DIOT units"];

export function assignmentSheets(rows) {
  const list = Array.isArray(rows) ? rows.slice() : [];
  list.sort((a, b) =>
    String(a.responder).localeCompare(String(b.responder)) ||
    String(a.kind).localeCompare(String(b.kind)) ||
    String(a.name).localeCompare(String(b.name))
  );
  const master = [headerRow(MASTER_HEADERS)];
  for (const row of list) {
    master.push([
      textCell(row.responder),
      textCell(row.kind),
      textCell(row.name),
      numberCell(row.approachingUnits),
      numberCell(row.atUnits),
      numberCell(row.diotUnits),
    ]);
  }
  const sheets = [{ name: "Assignments", rows: master }];
  const used = new Set(["assignments"]);
  const byPerson = new Map();
  for (const row of list) {
    const name = String(row.responder || "");
    if (!byPerson.has(name)) byPerson.set(name, []);
    byPerson.get(name).push(row);
  }
  for (const [name, assigned] of byPerson) {
    const rowsForPerson = [headerRow(PERSON_HEADERS)];
    let approaching = 0;
    let at = 0;
    let diot = 0;
    for (const row of assigned) {
      approaching += Number(row.approachingUnits) || 0;
      at += Number(row.atUnits) || 0;
      diot += Number(row.diotUnits) || 0;
      rowsForPerson.push([
        textCell(row.kind),
        textCell(row.name),
        numberCell(row.approachingUnits),
        numberCell(row.atUnits),
        numberCell(row.diotUnits),
      ]);
    }
    rowsForPerson.push([textCell("Total"), textCell(""), numberCell(approaching), numberCell(at), numberCell(diot)]);
    sheets.push({ name: sheetTitle(name, used), rows: rowsForPerson });
  }
  return sheets;
}

export function workbookBytes(sheets) {
  const book = sheets && sheets.length ? sheets : [{ name: "Assignments", rows: [headerRow(MASTER_HEADERS)] }];
  const sheetFiles = book.map((sheet, index) => ({
    name: "xl/worksheets/sheet" + (index + 1) + ".xml",
    data: sheetXml(sheet.rows),
  }));
  const sheetTags = book
    .map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  const sheetRels = book
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const overrides = book
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${overrides}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetTags}</sheets></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    },
    {
      name: "xl/styles.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF232F3E"/></patternFill></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs></styleSheet>`,
    },
    ...sheetFiles,
  ];
  return zipStore(files);
}

export function assignmentWorkbook(rows) {
  return workbookBytes(assignmentSheets(rows));
}
