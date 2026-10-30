import { styles_xml, theme1_xml, vbaProject_bin, vmlDrawing1_vml } from "./template-parts.js";

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

function decodeBase64(value) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
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

function xmlNumber(value) {
  const number = Number(value) || 0;
  if (!Number.isFinite(number)) return "0";
  if (Math.abs(number - Math.round(number)) < 1e-9) return String(Math.round(number));
  return String(Math.round(number * 1e10) / 1e10);
}

export function sheetTitle(name, used) {
  const reserved = new Set(["assignment summaries", "import scan history"]);
  let base = String(name || "Responder").replace(/[\\/*?:\[\]]/g, " ").replace(/\s+/g, " ").trim() || "Responder";
  if (reserved.has(base.toLowerCase())) base = base + " responder";
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

function worksheet(body, extras) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${body}${extras || ""}</worksheet>`;
}

function cell(col, row, options) {
  const ref = colLetters(col) + row;
  const style = options.style ? ` s="${options.style}"` : "";
  if (options.formula) return `<c r="${ref}"${style}><f>${xmlEscape(options.formula)}</f></c>`;
  if (options.number != null) return `<c r="${ref}"${style}><v>${xmlNumber(options.number)}</v></c>`;
  if (options.text == null || options.text === "") {
    return options.style ? `<c r="${ref}"${style}/>` : "";
  }
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(options.text)}</t></is></c>`;
}

function rowXml(number, cells, height) {
  const heightAttr = height ? ` ht="${height}" customHeight="1"` : "";
  return `<row r="${number}"${heightAttr}>${cells.filter(Boolean).join("")}</row>`;
}

function importSheetXml() {
  const rows = [
    rowXml(1, [cell(0, 1, { style: 8, text: "Import Scan-History Sheets" })]),
    rowXml(3, [cell(0, 3, { style: 9, text: "1. Click the button below." })]),
    rowXml(4, [cell(0, 4, { style: 9, text: "2. Choose the source workbook from your computer." })]),
    rowXml(5, [cell(0, 5, { style: 9, text: "3. Excel will copy every worksheet whose name contains 'scan-history' into this exported workbook." })]),
    rowXml(6, [cell(0, 6, { style: 9, text: "4. Save the workbook after import if you want to keep the copied sheets." })]),
  ];
  return worksheet(
    `<sheetPr codeName="Sheet2"/><dimension ref="A1:A6"/><sheetViews><sheetView workbookViewId="0"/></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="92.7109375" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/><legacyDrawing r:id="rId1"/>`
  );
}

function summarySheetXml(responders) {
  const rows = [];
  const merges = ["A1:G1"];
  rows.push(rowXml(1, [cell(0, 1, { style: 1, text: "Assignment Summaries" })]));
  const headers = ["Responder", "Assignments", "Unique Containers", "Quantity", "Approaching units", "At units", "DIOT units"];
  rows.push(rowXml(3, headers.map((label, index) => cell(index, 3, { style: 2, text: label }))));
  responders.forEach((person, index) => {
    const line = 4 + index;
    rows.push(rowXml(line, [
      cell(0, line, { style: 3, text: person.name }),
      cell(1, line, { style: 4, number: person.assignments }),
      cell(2, line, { style: 4, number: person.uniqueContainers }),
      cell(3, line, { style: 5, number: person.quantity }),
      cell(4, line, { style: 5, number: person.approachingUnits }),
      cell(5, line, { style: 5, number: person.atUnits }),
      cell(6, line, { style: 5, number: person.diotUnits }),
    ]));
  });
  let cursor = 4 + responders.length + 1;
  for (const person of responders) {
    merges.push(`A${cursor}:G${cursor}`);
    rows.push(rowXml(cursor, [cell(0, cursor, { style: 6, text: person.name })]));
    cursor += 1;
    rows.push(rowXml(cursor, [
      cell(0, cursor, { style: 2, text: "Assignments" }),
      cell(1, cursor, { style: 4, number: person.assignments }),
      cell(2, cursor, { style: 2, text: "Unique Containers" }),
      cell(3, cursor, { style: 4, number: person.uniqueContainers }),
      cell(4, cursor, { style: 2, text: "Quantity" }),
      cell(5, cursor, { style: 5, number: person.quantity }),
    ]));
    cursor += 1;
    rows.push(rowXml(cursor, [
      cell(0, cursor, { style: 2, text: "Approaching units" }),
      cell(1, cursor, { style: 5, number: person.approachingUnits }),
      cell(2, cursor, { style: 2, text: "At units" }),
      cell(3, cursor, { style: 5, number: person.atUnits }),
      cell(4, cursor, { style: 2, text: "DIOT units" }),
      cell(5, cursor, { style: 5, number: person.diotUnits }),
    ]));
    cursor += 2;
    merges.push(`A${cursor}:C${cursor}`, `E${cursor}:G${cursor}`);
    rows.push(rowXml(cursor, [
      cell(0, cursor, { style: 6, text: "Outerlocation Distribution" }),
      cell(4, cursor, { style: 6, text: "Bin Type Distribution" }),
    ]));
    cursor += 1;
    rows.push(rowXml(cursor, [
      cell(0, cursor, { style: 2, text: "Type" }),
      cell(1, cursor, { style: 2, text: "Quantity" }),
      cell(2, cursor, { style: 2, text: "%" }),
      cell(4, cursor, { style: 2, text: "Type" }),
      cell(5, cursor, { style: 2, text: "Quantity" }),
      cell(6, cursor, { style: 2, text: "%" }),
    ]));
    cursor += 1;
    const count = Math.max(person.locations.length, person.types.length);
    const total = person.quantity;
    for (let i = 0; i < count; i++) {
      const location = person.locations[i];
      const type = person.types[i];
      const cells = [];
      if (location) {
        cells.push(
          cell(0, cursor, { style: 3, text: location.name }),
          cell(1, cursor, { style: 5, number: location.quantity }),
          cell(2, cursor, { style: 7, number: total ? location.quantity / total : 0 })
        );
      }
      if (type) {
        cells.push(
          cell(4, cursor, { style: 3, text: type.name }),
          cell(5, cursor, { style: 5, number: type.quantity }),
          cell(6, cursor, { style: 7, number: total ? type.quantity / total : 0 })
        );
      }
      rows.push(rowXml(cursor, cells));
      cursor += 1;
    }
    cursor += 1;
  }
  const last = Math.max(3, cursor - 1);
  return worksheet(
    `<sheetPr codeName="Sheet1"/><dimension ref="A1:G${last}"/><sheetViews><sheetView tabSelected="1" workbookViewId="0"><pane ySplit="2" topLeftCell="A3" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="1" width="26.7109375" customWidth="1"/><col min="2" max="4" width="20" customWidth="1"/><col min="5" max="7" width="20" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>`
  );
}

function responderSheetXml(person, codeName) {
  const last = Math.max(6, 5 + person.containers.length);
  const rows = [
    rowXml(1, [cell(0, 1, { style: 10, text: person.name })]),
    rowXml(2, [
      cell(0, 2, { style: 11, formula: `"Unique Containers Assigned"&CHAR(10)&COUNTA(I6:I${last})` }),
      cell(1, 2, { style: 11, formula: `"Unique Container Completed"&CHAR(10)&COUNTIF(I6:I${last},"Completed")` }),
      cell(2, 2, { style: 11, formula: `"Completed %"&CHAR(10)&TEXT(IF(COUNTA(I6:I${last})=0,0,COUNTIF(I6:I${last},"Completed")/COUNTA(I6:I${last})),"0.00%")` }),
    ], 38),
    rowXml(3, [
      cell(0, 3, { style: 11, formula: `"Units Assigned"&CHAR(10)&TEXT(SUM(E6:E${last}),"0.####")` }),
      cell(1, 3, { style: 11, formula: `"Units Completed"&CHAR(10)&TEXT(SUMIF(I6:I${last},"Completed",E6:E${last}),"0.####")` }),
      cell(2, 3, { style: 11, formula: `"Completed %"&CHAR(10)&TEXT(IF(SUM(E6:E${last})=0,0,SUMIF(I6:I${last},"Completed",E6:E${last})/SUM(E6:E${last})),"0.00%")` }),
    ], 38),
    rowXml(4, [
      cell(0, 4, { style: 2, text: "Approaching units" }),
      cell(1, 4, { style: 5, number: person.approachingUnits }),
      cell(2, 4, { style: 2, text: "At units" }),
      cell(3, 4, { style: 5, number: person.atUnits }),
      cell(4, 4, { style: 2, text: "DIOT units" }),
      cell(5, 4, { style: 5, number: person.diotUnits }),
    ]),
    rowXml(5, ["Outer Location", "Bin", "Owner", "Primary Disposition", "Quantity", "Average Age", "Average Threshold", "Comment", "Status"].map((label, index) => cell(index, 5, { style: 2, text: label }))),
  ];
  person.containers.forEach((item, index) => {
    const line = 6 + index;
    rows.push(rowXml(line, [
      cell(0, line, { style: 3, text: item.outer }),
      cell(1, line, { style: 3, text: item.bin }),
      cell(2, line, { style: 3, text: item.owner }),
      cell(3, line, { style: 3, text: item.disposition }),
      cell(4, line, { style: 5, number: item.quantity }),
      cell(5, line, { style: 5, number: item.age }),
      cell(6, line, { style: 5, number: item.threshold }),
      cell(7, line, { style: 3, text: "" }),
      cell(8, line, { style: 3, text: "Uncompleted" }),
    ]));
  });
  return worksheet(
    `<sheetPr codeName="${codeName}"/><dimension ref="A1:I${last}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="5" topLeftCell="A6" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols><col min="1" max="3" width="28.7109375" customWidth="1"/><col min="4" max="7" width="18.7109375" customWidth="1"/><col min="8" max="8" width="24.7109375" customWidth="1"/><col min="9" max="9" width="18.7109375" customWidth="1"/></cols><sheetData>${rows.join("")}</sheetData><dataValidations count="1"><dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="I6:I${last}"><formula1>"Completed,Uncompleted"</formula1></dataValidation></dataValidations>`
  );
}

export function assignmentWorkbook(pack) {
  const responders = (pack && pack.responders) || [];
  const used = new Set(["assignment summaries", "import scan history"]);
  const named = responders.map((person) => ({ person, title: sheetTitle(person.name, used) }));
  const sheets = [
    { name: "Assignment Summaries", xml: summarySheetXml(responders) },
    { name: "Import Scan History", xml: importSheetXml() },
    ...named.map((item, index) => ({
      name: item.title,
      xml: responderSheetXml(item.person, "Sheet" + (index + 3)),
    })),
  ];
  const sheetTags = sheets
    .map((sheet, index) => `<sheet name="${xmlEscape(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`)
    .join("");
  const sheetRels = sheets
    .map(
      (_, index) =>
        `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    )
    .join("");
  const overrides = sheets
    .map(
      (_, index) =>
        `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    )
    .join("");
  const themeId = sheets.length + 1;
  const styleId = sheets.length + 2;
  const vbaId = sheets.length + 3;
  const files = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="vml" ContentType="application/vnd.openxmlformats-officedocument.vmlDrawing"/><Default Extension="bin" ContentType="application/vnd.ms-office.vbaProject"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.ms-excel.sheet.macroEnabled.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>${overrides}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: "xl/workbook.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr codeName="ThisWorkbook"/><sheets>${sheetTags}</sheets><calcPr calcId="124519" fullCalcOnLoad="1"/></workbook>`,
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetRels}<Relationship Id="rId${themeId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="theme/theme1.xml"/><Relationship Id="rId${styleId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${vbaId}" Type="http://schemas.microsoft.com/office/2006/relationships/vbaProject" Target="vbaProject.bin"/></Relationships>`,
    },
    { name: "xl/styles.xml", data: decodeBase64(styles_xml) },
    { name: "xl/theme/theme1.xml", data: decodeBase64(theme1_xml) },
    { name: "xl/vbaProject.bin", data: decodeBase64(vbaProject_bin) },
    { name: "xl/drawings/vmlDrawing1.vml", data: decodeBase64(vmlDrawing1_vml) },
    {
      name: "xl/worksheets/_rels/sheet2.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing" Target="../drawings/vmlDrawing1.vml"/></Relationships>`,
    },
    ...sheets.map((sheet, index) => ({ name: `xl/worksheets/sheet${index + 1}.xml`, data: sheet.xml })),
  ];
  return zipStore(files);
}
