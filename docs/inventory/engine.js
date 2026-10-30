// Columnar CSV engine for large inventory files.
// Parsing is streaming. Low-cardinality fields are dictionary-coded.
// High-cardinality text is packed as UTF-8. Numbers keep their original
// text so a filtered export matches the source file.

const utf8Encoder = new TextEncoder();
const utf8Decoder = new TextDecoder();

export const REQUIRED_COLUMNS = [
  "Region",
  "Warehouse",
  "Outer Location",
  "Bin",
  "ASIN",
  "Owner",
  "Disposition",
  "Amazon Device Flag",
  "Quantity",
  "Average Age",
  "Average Threshold",
];

const DICT_COLUMNS = new Set([
  "Region",
  "Warehouse",
  "Outer Location",
  "Bin",
  "Owner",
  "Disposition",
  "Amazon Device Flag",
]);

const NUMBER_COLUMNS = new Set(["Quantity", "Average Age", "Average Threshold"]);

const AGE_BUCKETS = [
  { label: "0–6 days", min: 0, max: 6.999 },
  { label: "7–29 days", min: 7, max: 29.999 },
  { label: "30–89 days", min: 30, max: 89.999 },
  { label: "90–179 days", min: 90, max: 179.999 },
  { label: "180+ days", min: 180, max: null },
];

export function createCsvParser(onRow) {
  let inQuotes = false;
  let quoteAtEnd = false;
  let pendingCR = false;
  let needBomCheck = true;
  let parts = [];
  let row = [];

  function takeField() {
    let field;
    if (parts.length === 0) field = "";
    else if (parts.length === 1) field = parts[0];
    else field = parts.join("");
    parts = [];
    return field;
  }

  function endRecord() {
    const blank = row.every((field) => field === "");
    if (!blank) onRow(row);
    row = [];
  }

  return {
    push(input) {
      let chunk = input == null ? "" : String(input);
      if (needBomCheck) {
        if (!chunk) return;
        needBomCheck = false;
        if (chunk.charCodeAt(0) === 0xfeff) chunk = chunk.slice(1);
      }
      const n = chunk.length;
      let i = 0;
      let start = 0;
      if (pendingCR) {
        pendingCR = false;
        if (n && chunk.charCodeAt(0) === 10) {
          i = 1;
          start = 1;
        }
      }
      if (quoteAtEnd) {
        quoteAtEnd = false;
        if (i < n && chunk.charCodeAt(i) === 34) {
          parts.push('"');
          i += 1;
          start = i;
        } else {
          inQuotes = false;
          start = i;
        }
      }

      let halt = false;
      while (i < n) {
        const code = chunk.charCodeAt(i);
        if (inQuotes) {
          if (code === 34) {
            if (i + 1 >= n) {
              if (start < i) parts.push(chunk.slice(start, i));
              quoteAtEnd = true;
              halt = true;
              break;
            }
            if (chunk.charCodeAt(i + 1) === 34) {
              if (start < i) parts.push(chunk.slice(start, i));
              parts.push('"');
              i += 2;
              start = i;
              continue;
            }
            if (start < i) parts.push(chunk.slice(start, i));
            inQuotes = false;
            i += 1;
            start = i;
            continue;
          }
          i += 1;
          continue;
        }
        if (code === 34) {
          if (start < i) parts.push(chunk.slice(start, i));
          inQuotes = true;
          i += 1;
          start = i;
          continue;
        }
        if (code === 44) {
          if (start < i) parts.push(chunk.slice(start, i));
          row.push(takeField());
          i += 1;
          start = i;
          continue;
        }
        if (code === 13 || code === 10) {
          if (start < i) parts.push(chunk.slice(start, i));
          row.push(takeField());
          endRecord();
          if (code === 13) {
            if (i + 1 >= n) {
              pendingCR = true;
              halt = true;
              break;
            }
            if (chunk.charCodeAt(i + 1) === 10) i += 1;
          }
          i += 1;
          start = i;
          continue;
        }
        i += 1;
      }
      if (!halt && start < n) parts.push(chunk.slice(start));
    },
    finish() {
      if (quoteAtEnd) {
        quoteAtEnd = false;
        inQuotes = false;
      }
      if (inQuotes) throw new Error("The file ended inside a quoted field.");
      pendingCR = false;
      if (parts.length || row.length) {
        row.push(takeField());
        endRecord();
      }
    },
  };
}

function createGrow(Ctor, initial) {
  const chunks = [];
  let buf = new Ctor(initial);
  let n = 0;
  let total = 0;
  return {
    push(value) {
      if (n === buf.length) {
        chunks.push(buf);
        total += n;
        buf = new Ctor(buf.length * 2);
        n = 0;
      }
      buf[n++] = value;
    },
    finish() {
      total += n;
      const out = new Ctor(total);
      let offset = 0;
      for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
      }
      if (n) out.set(buf.subarray(0, n), offset);
      return out;
    },
  };
}

function createPacker() {
  const chunks = [];
  let buf = new Uint8Array(65536);
  let used = 0;
  let committed = 0;
  const offsets = createGrow(Uint32Array, 8192);
  const lengths = createGrow(Uint32Array, 8192);

  function ensure(extra) {
    if (used + extra <= buf.length) return;
    if (used) {
      const copy = new Uint8Array(used);
      copy.set(buf.subarray(0, used));
      chunks.push(copy);
      committed += used;
      used = 0;
    }
    if (extra > buf.length) buf = new Uint8Array(Math.max(65536, extra));
  }

  return {
    push(value) {
      const text = value == null ? "" : String(value);
      const charLength = text.length;
      let wide = false;
      for (let i = 0; i < charLength; i++) {
        if (text.charCodeAt(i) > 127) {
          wide = true;
          break;
        }
      }
      const start = committed + used;
      if (!wide) {
        if (start > 0xffffffff - charLength) throw new Error("A text column is larger than 4 GB.");
        ensure(charLength);
        for (let i = 0; i < charLength; i++) buf[used + i] = text.charCodeAt(i);
        used += charLength;
        offsets.push(start);
        lengths.push(charLength);
        return;
      }
      const encoded = utf8Encoder.encode(text);
      if (start > 0xffffffff - encoded.length) throw new Error("A text column is larger than 4 GB.");
      ensure(encoded.length);
      buf.set(encoded, used);
      used += encoded.length;
      offsets.push(start);
      lengths.push(encoded.length);
    },
    finish() {
      const bytes = new Uint8Array(committed + used);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      if (used) bytes.set(buf.subarray(0, used), offset);
      return { bytes, offsets: offsets.finish(), lengths: lengths.finish() };
    },
  };
}

function createDictColumn(name) {
  const lookup = new Map();
  const dict = [];
  const codes = createGrow(Uint32Array, 8192);
  return {
    name,
    kind: "dict",
    push(value) {
      const text = value == null ? "" : String(value);
      let id = lookup.get(text);
      if (id === undefined) {
        id = dict.length;
        lookup.set(text, id);
        dict.push(text);
      }
      codes.push(id);
    },
    finish() {
      return { name, kind: "dict", dict, codes: codes.finish() };
    },
  };
}

function createNumberColumn(name) {
  const values = createGrow(Float64Array, 8192);
  const text = createPacker();
  let bad = 0;
  return {
    name,
    kind: "number",
    push(value) {
      const raw = value == null ? "" : String(value);
      text.push(raw);
      if (raw === "") {
        values.push(0);
        return;
      }
      const parsed = Number(raw);
      if (!Number.isFinite(parsed)) {
        bad += 1;
        values.push(0);
        return;
      }
      values.push(parsed);
    },
    finish() {
      const packed = text.finish();
      return {
        name,
        kind: "number",
        values: values.finish(),
        bytes: packed.bytes,
        offsets: packed.offsets,
        lengths: packed.lengths,
        bad,
      };
    },
  };
}

function createBytesColumn(name) {
  const packed = createPacker();
  return {
    name,
    kind: "bytes",
    push(value) {
      packed.push(value == null ? "" : String(value));
    },
    finish() {
      const done = packed.finish();
      return { name, kind: "bytes", bytes: done.bytes, offsets: done.offsets, lengths: done.lengths };
    },
  };
}

function columnKind(name) {
  if (DICT_COLUMNS.has(name)) return "dict";
  if (NUMBER_COLUMNS.has(name)) return "number";
  return "bytes";
}

function createColumn(name) {
  const kind = columnKind(name);
  if (kind === "dict") return createDictColumn(name);
  if (kind === "number") return createNumberColumn(name);
  return createBytesColumn(name);
}

export function createDatasetParser(options) {
  const onProgress = options && options.onProgress;
  let header = null;
  let columns = null;
  let byName = null;
  let dataRows = 0;
  let progressMark = 0;

  const csv = createCsvParser((fields) => {
    if (!header) {
      header = fields.map((field) => field.trim());
      const seen = new Set();
      for (const name of header) {
        if (!name) throw new Error("The header has a blank column name.");
        if (seen.has(name)) throw new Error('The header repeats column "' + name + '".');
        seen.add(name);
      }
      const missing = REQUIRED_COLUMNS.filter((name) => !seen.has(name));
      if (missing.length) {
        throw new Error("Missing columns: " + missing.join(", ") + ".");
      }
      columns = header.map((name) => createColumn(name));
      byName = {};
      columns.forEach((column) => {
        byName[column.name] = column;
      });
      return;
    }
    if (fields.length !== header.length) {
      throw new Error(
        "Row " + (dataRows + 1) + " has " + fields.length + " columns; the header has " + header.length + "."
      );
    }
    for (let i = 0; i < columns.length; i++) columns[i].push(fields[i]);
    dataRows += 1;
    if (onProgress && dataRows - progressMark >= 25000) {
      progressMark = dataRows;
      onProgress(dataRows);
    }
  });

  return {
    get rowCount() {
      return dataRows;
    },
    push(chunk) {
      csv.push(chunk);
    },
    finish() {
      csv.finish();
      if (!header) throw new Error("The file has no header row.");
      const finished = columns.map((column) => column.finish());
      const named = {};
      let badNumbers = 0;
      for (const column of finished) {
        named[column.name] = column;
        if (column.bad) badNumbers += column.bad;
      }
      return {
        header,
        columns: finished,
        byName: named,
        rowCount: dataRows,
        badNumbers,
      };
    },
  };
}

export function parseCsvText(text, chunkSize) {
  const parser = createDatasetParser();
  const size = chunkSize || text.length || 1;
  for (let i = 0; i < text.length; i += size) parser.push(text.slice(i, i + size));
  parser.push("");
  return parser.finish();
}

export function column(dataset, name) {
  const found = dataset.byName[name];
  if (!found) throw new Error('Column "' + name + '" is not in this file.');
  return found;
}

export function textAt(col, row) {
  const start = col.offsets[row];
  const len = col.lengths[row];
  if (!len) return "";
  const bytes = col.bytes;
  if (len <= 96) {
    const codes = new Array(len);
    for (let i = 0; i < len; i++) {
      const bite = bytes[start + i];
      if (bite > 127) return utf8Decoder.decode(bytes.subarray(start, start + len));
      codes[i] = bite;
    }
    return String.fromCharCode.apply(null, codes);
  }
  return utf8Decoder.decode(bytes.subarray(start, start + len));
}

export function valueAt(col, row) {
  if (col.kind === "dict") return col.dict[col.codes[row]];
  return textAt(col, row);
}

function includesBytes(col, row, query) {
  const qn = query.length;
  if (!qn) return true;
  const start = col.offsets[row];
  const len = col.lengths[row];
  if (qn > len) return false;
  const bytes = col.bytes;
  const last = len - qn;
  for (let i = 0; i <= last; i++) {
    let matched = true;
    for (let j = 0; j < qn; j++) {
      let bite = bytes[start + i + j];
      if (bite >= 97 && bite <= 122) bite -= 32;
      if (bite !== query.charCodeAt(j)) {
        matched = false;
        break;
      }
    }
    if (matched) return true;
  }
  return false;
}

function ageBucketIndex(age) {
  if (age < 7) return 0;
  if (age < 30) return 1;
  if (age < 90) return 2;
  if (age < 180) return 3;
  return 4;
}

function dictAllow(col, selected) {
  if (!selected) return null;
  const allow = new Uint8Array(col.dict.length);
  selected.forEach((id) => {
    if (id >= 0 && id < allow.length) allow[id] = 1;
  });
  return allow;
}

export function thresholdStatus(age, threshold) {
  const before = threshold - age;
  if (before < 0) return "diot";
  if (before < 1) return "at";
  if (before <= 2) return "approaching";
  return "early";
}

export function letterPrefix(bin) {
  const text = String(bin || "");
  let index = 0;
  while (index < text.length) {
    const code = text.charCodeAt(index);
    if (code >= 48 && code <= 57) break;
    index += 1;
  }
  if (index === 0) return text || "(blank)";
  return text.slice(0, index);
}

export function normalizeGroupings(input) {
  const byPrefix = new Map();
  const source = Array.isArray(input) ? input : [];
  for (const item of source) {
    const name = String((item && item.name) || "").replace(/[\u0000-\u001f]/g, "").trim();
    const prefix = String((item && item.prefix) || "").replace(/[\u0000-\u001f]/g, "").trim();
    if (!name || !prefix) continue;
    byPrefix.set(prefix, { name, prefix });
  }
  return Array.from(byPrefix.values()).sort((a, b) => b.prefix.length - a.prefix.length || a.prefix.localeCompare(b.prefix));
}

export function containerTypeName(bin, groupings) {
  const text = String(bin || "");
  const rules = groupings || [];
  for (let i = 0; i < rules.length; i++) {
    if (rules[i].prefix && text.startsWith(rules[i].prefix)) return rules[i].name;
  }
  return letterPrefix(text);
}

export const INVENTORY_THRESHOLD_RATE = 0.005;

export function formatUnits(value) {
  const number = Number(value) || 0;
  const rounded = Math.abs(number - Math.round(number)) < 1e-6 ? Math.round(number) : Math.round(number * 100) / 100;
  return rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function diotOverageText(diotUnits, threshold) {
  const over = (Number(diotUnits) || 0) - (Number(threshold) || 0);
  const thresholdText = formatUnits(threshold);
  if (Math.abs(over) < 1e-6) return "At the inventory threshold (" + thresholdText + " units)";
  const direction = over > 0 ? "over" : "under";
  return formatUnits(Math.abs(over)) + " units " + direction + " the inventory threshold (" + thresholdText + " units)";
}

export const STATUS_LABEL = {
  approaching: "Approaching",
  at: "At",
  diot: "DIOT",
  early: "More than 2 days out",
};

function emptyFilter(filter) {
  if (!filter) return true;
  if (filter.asin) return false;
  if (filter.bin) return false;
  if (filter.ageMin != null && filter.ageMin !== "") return false;
  if (filter.ageMax != null && filter.ageMax !== "") return false;
  if (filter.qtyMin != null && filter.qtyMin !== "") return false;
  if (filter.statuses && filter.statuses.size !== 4) return false;
  if (filter.containerType) return false;
  if (filter.allow) {
    for (const key of Object.keys(filter.allow)) {
      if (filter.allow[key]) return false;
    }
  }
  return true;
}

function seriesFrom(col, lines, units) {
  const rows = [];
  for (let id = 0; id < col.dict.length; id++) {
    if (!lines[id] && !units[id]) continue;
    rows.push({ id, name: col.dict[id], lines: lines[id], units: units[id] });
  }
  rows.sort((a, b) => b.units - a.units || b.lines - a.lines || a.name.localeCompare(b.name));
  return rows;
}

export function query(dataset, filter) {
  const rowCount = dataset.rowCount;
  const owner = column(dataset, "Owner");
  const disposition = column(dataset, "Disposition");
  const outer = column(dataset, "Outer Location");
  const region = column(dataset, "Region");
  const warehouse = column(dataset, "Warehouse");
  const device = column(dataset, "Amazon Device Flag");
  const bin = column(dataset, "Bin");
  const asin = column(dataset, "ASIN");
  const qty = column(dataset, "Quantity");
  const age = column(dataset, "Average Age");
  const threshold = column(dataset, "Average Threshold");

  const allow = (filter && filter.allow) || {};
  const ownerAllow = dictAllow(owner, allow.Owner);
  const dispositionAllow = dictAllow(disposition, allow.Disposition);
  const outerAllow = dictAllow(outer, allow["Outer Location"]);
  const regionAllow = dictAllow(region, allow.Region);
  const warehouseAllow = dictAllow(warehouse, allow.Warehouse);
  const deviceAllow = dictAllow(device, allow["Amazon Device Flag"]);

  const asinQuery = filter && filter.asin ? String(filter.asin).trim().toUpperCase() : "";
  const binQuery = filter && filter.bin ? String(filter.bin).trim().toUpperCase() : "";
  let binAllow = null;
  if (binQuery) {
    binAllow = new Uint8Array(bin.dict.length);
    for (let id = 0; id < bin.dict.length; id++) {
      if (bin.dict[id].toUpperCase().includes(binQuery)) binAllow[id] = 1;
    }
  }

  const ageMin = filter && filter.ageMin != null && filter.ageMin !== "" ? Number(filter.ageMin) : null;
  const ageMax = filter && filter.ageMax != null && filter.ageMax !== "" ? Number(filter.ageMax) : null;
  const qtyMin = filter && filter.qtyMin != null && filter.qtyMin !== "" ? Number(filter.qtyMin) : null;
  const groupings = normalizeGroupings(filter && filter.groupings);
  const selectedType = filter && filter.containerType ? String(filter.containerType) : "";
  const typeByBin = new Array(bin.dict.length);
  for (let id = 0; id < bin.dict.length; id++) typeByBin[id] = containerTypeName(bin.dict[id], groupings);

  const ownerLines = new Uint32Array(owner.dict.length);
  const ownerUnits = new Float64Array(owner.dict.length);
  const dispositionLines = new Uint32Array(disposition.dict.length);
  const dispositionUnits = new Float64Array(disposition.dict.length);
  const outerLines = new Uint32Array(outer.dict.length);
  const outerUnits = new Float64Array(outer.dict.length);
  const regionLines = new Uint32Array(region.dict.length);
  const regionUnits = new Float64Array(region.dict.length);
  const warehouseLines = new Uint32Array(warehouse.dict.length);
  const warehouseUnits = new Float64Array(warehouse.dict.length);
  const deviceLines = new Uint32Array(device.dict.length);
  const deviceUnits = new Float64Array(device.dict.length);
  const bucketLines = [0, 0, 0, 0, 0];
  const bucketUnits = [0, 0, 0, 0, 0];
  const statusLines = { approaching: 0, at: 0, diot: 0, early: 0 };
  const statusUnits = { approaching: 0, at: 0, diot: 0, early: 0 };
  const typeLines = new Map();
  const typeUnits = new Map();
  const locationStatus = Array.from({ length: outer.dict.length }, () => ({
    approaching: 0,
    at: 0,
    diot: 0,
    early: 0,
    approachingUnits: 0,
    atUnits: 0,
    diotUnits: 0,
    earlyUnits: 0,
  }));
  const statuses = filter && filter.statuses;
  const statusLimited = Boolean(statuses && statuses.size !== 4);

  const match = createGrow(Uint32Array, Math.max(1, Math.min(rowCount || 1, 8192)));
  const asinSet = new Set();
  const binSet = new Set();
  let lines = 0;
  let units = 0;
  let ageWeighted = 0;
  let thresholdWeighted = 0;
  let ageSum = 0;
  let thresholdSum = 0;

  const unfiltered = emptyFilter(filter);

  for (let i = 0; i < rowCount; i++) {
    if (!unfiltered) {
      if (ownerAllow && !ownerAllow[owner.codes[i]]) continue;
      if (dispositionAllow && !dispositionAllow[disposition.codes[i]]) continue;
      if (outerAllow && !outerAllow[outer.codes[i]]) continue;
      if (regionAllow && !regionAllow[region.codes[i]]) continue;
      if (warehouseAllow && !warehouseAllow[warehouse.codes[i]]) continue;
      if (deviceAllow && !deviceAllow[device.codes[i]]) continue;
      if (binAllow && !binAllow[bin.codes[i]]) continue;
      if (selectedType && typeByBin[bin.codes[i]] !== selectedType) continue;
      if (asinQuery && !includesBytes(asin, i, asinQuery)) continue;
      const quantity = qty.values[i];
      if (qtyMin != null && quantity < qtyMin) continue;
      const ageValue = age.values[i];
      if (ageMin != null && ageValue < ageMin) continue;
      if (ageMax != null && ageValue > ageMax) continue;
    }

    const quantity = qty.values[i];
    const ageValue = age.values[i];
    const thresholdValue = threshold.values[i];
    const ownerId = owner.codes[i];
    const dispositionId = disposition.codes[i];
    const outerId = outer.codes[i];
    const regionId = region.codes[i];
    const warehouseId = warehouse.codes[i];
    const deviceId = device.codes[i];
    const bucket = ageBucketIndex(ageValue);
    const status = thresholdStatus(ageValue, thresholdValue);
    statusLines[status] += 1;
    statusUnits[status] += quantity;
    if (statusLimited && !statuses.has(status)) continue;
    const spot = locationStatus[outerId];
    spot[status] += 1;
    spot[status + "Units"] += quantity;
    const typeName = typeByBin[bin.codes[i]];
    typeLines.set(typeName, (typeLines.get(typeName) || 0) + 1);
    typeUnits.set(typeName, (typeUnits.get(typeName) || 0) + quantity);

    lines += 1;
    units += quantity;
    ageSum += ageValue;
    thresholdSum += thresholdValue;
    ageWeighted += ageValue * quantity;
    thresholdWeighted += thresholdValue * quantity;
    ownerLines[ownerId] += 1;
    ownerUnits[ownerId] += quantity;
    dispositionLines[dispositionId] += 1;
    dispositionUnits[dispositionId] += quantity;
    outerLines[outerId] += 1;
    outerUnits[outerId] += quantity;
    regionLines[regionId] += 1;
    regionUnits[regionId] += quantity;
    warehouseLines[warehouseId] += 1;
    warehouseUnits[warehouseId] += quantity;
    deviceLines[deviceId] += 1;
    deviceUnits[deviceId] += quantity;
    bucketLines[bucket] += 1;
    bucketUnits[bucket] += quantity;
    binSet.add(bin.codes[i]);
    asinSet.add(textAt(asin, i));
    match.push(i);
  }

  return {
    lines,
    units,
    uniqueAsins: asinSet.size,
    uniqueBins: binSet.size,
    avgAge: units > 0 ? ageWeighted / units : lines ? ageSum / lines : 0,
    avgThreshold: units > 0 ? thresholdWeighted / units : lines ? thresholdSum / lines : 0,
    owner: seriesFrom(owner, ownerLines, ownerUnits),
    disposition: seriesFrom(disposition, dispositionLines, dispositionUnits),
    outer: seriesFrom(outer, outerLines, outerUnits),
    region: seriesFrom(region, regionLines, regionUnits),
    warehouse: seriesFrom(warehouse, warehouseLines, warehouseUnits),
    device: seriesFrom(device, deviceLines, deviceUnits),
    ageBuckets: AGE_BUCKETS.map((bucket, index) => ({
      label: bucket.label,
      min: bucket.min,
      max: bucket.max,
      lines: bucketLines[index],
      units: bucketUnits[index],
    })),
    matchIndex: match.finish(),
    unfiltered,
    status: {
      approaching: { lines: statusLines.approaching, units: statusUnits.approaching },
      at: { lines: statusLines.at, units: statusUnits.at },
      diot: { lines: statusLines.diot, units: statusUnits.diot },
      early: { lines: statusLines.early, units: statusUnits.early },
    },
    locations: locationRows(outer, locationStatus, statuses),
    containerTypes: containerTypeRows(typeLines, typeUnits),
  };
}

function locationRows(outer, locationStatus, statuses) {
  const rows = [];
  for (let id = 0; id < outer.dict.length; id++) {
    const spot = locationStatus[id];
    const visible = !statuses || statuses.size === 4 || ["approaching", "at", "diot", "early"].some((name) => statuses.has(name) && spot[name] > 0);
    if (!visible) continue;
    const containers = spot.approaching + spot.at + spot.diot + spot.early;
    const units = spot.approachingUnits + spot.atUnits + spot.diotUnits + spot.earlyUnits;
    if (!containers) continue;
    rows.push({
      id,
      name: outer.dict[id],
      containers,
      units,
      approaching: spot.approaching,
      at: spot.at,
      diot: spot.diot,
      early: spot.early,
      approachingUnits: spot.approachingUnits,
      atUnits: spot.atUnits,
      diotUnits: spot.diotUnits,
      earlyUnits: spot.earlyUnits,
    });
  }
  rows.sort((a, b) => b.containers - a.containers || b.units - a.units || a.name.localeCompare(b.name));
  return rows;
}

function containerTypeRows(typeLines, typeUnits) {
  const rows = [];
  for (const [name, containers] of typeLines) {
    rows.push({ name, containers, units: typeUnits.get(name) || 0 });
  }
  rows.sort((a, b) => b.containers - a.containers || b.units - a.units || a.name.localeCompare(b.name));
  return rows;
}

function addStatusUnits(map, name, status, quantity) {
  if (status !== "approaching" && status !== "at" && status !== "diot") return;
  let row = map.get(name);
  if (!row) {
    row = { name, approachingUnits: 0, atUnits: 0, diotUnits: 0 };
    map.set(name, row);
  }
  row[status + "Units"] += quantity;
}

export function placeStatusUnits(dataset, groupings) {
  const outer = column(dataset, "Outer Location");
  const bin = column(dataset, "Bin");
  const qty = column(dataset, "Quantity");
  const age = column(dataset, "Average Age");
  const threshold = column(dataset, "Average Threshold");
  const rules = normalizeGroupings(groupings);
  const locations = new Map();
  const types = new Map();
  for (let i = 0; i < dataset.rowCount; i++) {
    const status = thresholdStatus(age.values[i], threshold.values[i]);
    const quantity = qty.values[i];
    addStatusUnits(locations, outer.dict[outer.codes[i]] || "(blank)", status, quantity);
    addStatusUnits(types, containerTypeName(bin.dict[bin.codes[i]], rules), status, quantity);
  }
  return { locations, types };
}

function primaryByQuantity(counts) {
  let best = "";
  let bestQty = -1;
  for (const [name, quantity] of counts) {
    if (quantity > bestQty || (quantity === bestQty && name.localeCompare(best) < 0)) {
      best = name;
      bestQty = quantity;
    }
  }
  return best;
}

function rankedQuantity(counts) {
  const rows = [];
  for (const [name, quantity] of counts) rows.push({ name, quantity });
  rows.sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name));
  return rows;
}

export function assignmentPackage(dataset, places, groupings) {
  const rules = normalizeGroupings(groupings);
  const peoplePlaces = new Map();
  const maskCache = new Map();
  const prepared = [];
  for (const place of Array.isArray(places) ? places : []) {
    const responder = String((place && place.responder) || "").replace(/[\u0000-\u001f]/g, "").trim();
    const name = String((place && place.name) || "").replace(/[\u0000-\u001f]/g, "").trim();
    if (!responder || !name) continue;
    const kind = place.kind === "type" ? "type" : "location";
    let mask = null;
    if (place.scope) {
      const scopeKey = place.scopeKey || place.scope;
      if (maskCache.has(scopeKey)) mask = maskCache.get(scopeKey);
      else {
        mask = new Uint8Array(dataset.rowCount);
        const match = query(dataset, place.scope).matchIndex;
        for (let n = 0; n < match.length; n++) mask[match[n]] = 1;
        maskCache.set(scopeKey, mask);
      }
    }
    prepared.push({ responder, kind, name, mask });
    if (!peoplePlaces.has(responder)) peoplePlaces.set(responder, new Set());
    peoplePlaces.get(responder).add(kind + "\t" + name + (place.scopeKey ? "\t" + place.scopeKey : ""));
  }

  const outer = column(dataset, "Outer Location");
  const bin = column(dataset, "Bin");
  const owner = column(dataset, "Owner");
  const disposition = column(dataset, "Disposition");
  const qty = column(dataset, "Quantity");
  const age = column(dataset, "Average Age");
  const threshold = column(dataset, "Average Threshold");
  const groups = new Map();
  const scoped = prepared.some((place) => place.mask);

  for (let i = 0; i < dataset.rowCount; i++) {
    const status = thresholdStatus(age.values[i], threshold.values[i]);
    const hot = status === "approaching" || status === "at" || status === "diot";
    if (!hot && !scoped) continue;
    const location = outer.dict[outer.codes[i]] || "(blank)";
    const binName = bin.dict[bin.codes[i]] || "(blank)";
    const typeName = containerTypeName(binName, rules);
    const people = new Set();
    for (const place of prepared) {
      if (place.mask) {
        if (!place.mask[i]) continue;
      } else if (!hot) continue;
      if (place.kind === "type" ? typeName !== place.name : location !== place.name) continue;
      people.add(place.responder);
    }
    if (!people.size) continue;
    const quantity = qty.values[i];
    const ageValue = age.values[i];
    const thresholdValue = threshold.values[i];
    const ownerName = owner.dict[owner.codes[i]] || "";
    const dispositionName = disposition.dict[disposition.codes[i]] || "";
    for (const person of people) {
      const key = person + "\0" + location + "\0" + binName;
      let group = groups.get(key);
      if (!group) {
        group = {
          responder: person,
          outer: location,
          bin: binName,
          type: letterPrefix(binName),
          typeName,
          quantity: 0,
          ageWeighted: 0,
          thresholdWeighted: 0,
          approachingUnits: 0,
          atUnits: 0,
          diotUnits: 0,
          earlyUnits: 0,
          owners: new Map(),
          dispositions: new Map(),
        };
        groups.set(key, group);
      }
      group.quantity += quantity;
      group.ageWeighted += ageValue * quantity;
      group.thresholdWeighted += thresholdValue * quantity;
      if (hot) group[status + "Units"] += quantity;
      else group.earlyUnits += quantity;
      group.owners.set(ownerName, (group.owners.get(ownerName) || 0) + quantity);
      group.dispositions.set(dispositionName, (group.dispositions.get(dispositionName) || 0) + quantity);
    }
  }

  const byPerson = new Map();
  for (const [name, assigned] of peoplePlaces) {
    byPerson.set(name, {
      name,
      assignments: assigned.size,
      containers: [],
      approachingUnits: 0,
      atUnits: 0,
      diotUnits: 0,
      earlyUnits: 0,
    });
  }
  for (const group of groups.values()) {
    const person = byPerson.get(group.responder);
    const quantity = group.quantity;
    person.containers.push({
      outer: group.outer,
      bin: group.bin,
      owner: primaryByQuantity(group.owners),
      disposition: primaryByQuantity(group.dispositions),
      quantity,
      age: quantity ? group.ageWeighted / quantity : 0,
      threshold: quantity ? group.thresholdWeighted / quantity : 0,
      type: group.type,
      typeName: group.typeName,
    });
    person.approachingUnits += group.approachingUnits;
    person.atUnits += group.atUnits;
    person.diotUnits += group.diotUnits;
    person.earlyUnits += group.earlyUnits;
  }

  const responders = Array.from(byPerson.values()).sort((a, b) => a.name.localeCompare(b.name));
  for (const person of responders) {
    person.containers.sort((a, b) => b.quantity - a.quantity || a.outer.localeCompare(b.outer) || a.bin.localeCompare(b.bin));
    const locations = new Map();
    const types = new Map();
    for (const row of person.containers) {
      locations.set(row.outer, (locations.get(row.outer) || 0) + row.quantity);
      types.set(row.type, (types.get(row.type) || 0) + row.quantity);
    }
    person.locations = rankedQuantity(locations);
    person.types = rankedQuantity(types);
    person.quantity = person.approachingUnits + person.atUnits + person.diotUnits + person.earlyUnits;
    person.uniqueContainers = person.containers.length;
  }
  return { responders };
}

export function sortMatch(dataset, matchIndex, mode) {
  const copy = new Uint32Array(matchIndex);
  if (!mode || mode === "file") return copy;
  if (mode === "qty") {
    const values = column(dataset, "Quantity").values;
    copy.sort((a, b) => values[b] - values[a] || a - b);
    return copy;
  }
  if (mode === "age") {
    const values = column(dataset, "Average Age").values;
    copy.sort((a, b) => values[b] - values[a] || a - b);
    return copy;
  }
  if (mode === "asin") {
    const asin = column(dataset, "ASIN");
    copy.sort((a, b) => compareBytes(asin, a, b) || a - b);
    return copy;
  }
  return copy;
}

function compareBytes(col, a, b) {
  const aStart = col.offsets[a];
  const bStart = col.offsets[b];
  const aLen = col.lengths[a];
  const bLen = col.lengths[b];
  const n = Math.min(aLen, bLen);
  const bytes = col.bytes;
  for (let i = 0; i < n; i++) {
    const diff = bytes[aStart + i] - bytes[bStart + i];
    if (diff) return diff;
  }
  return aLen - bLen;
}

export function csvEscape(value) {
  const text = value == null ? "" : String(value);
  if (text.includes('"') || text.includes(",") || text.includes("\n") || text.includes("\r")) {
    return '"' + text.replace(/"/g, '""') + '"';
  }
  return text;
}

function yieldChunks(produce) {
  const chunks = [];
  let buffer = "";
  let pending = 0;
  function pushLine(line) {
    buffer += line;
    pending += 1;
    if (pending >= 2000) {
      chunks.push(buffer);
      buffer = "";
      pending = 0;
    }
  }
  produce(pushLine);
  if (buffer) chunks.push(buffer);
  return chunks;
}

export function detailCsv(dataset, matchIndex) {
  const age = column(dataset, "Average Age");
  const threshold = column(dataset, "Average Threshold");
  return yieldChunks((pushLine) => {
    pushLine(dataset.header.concat(["Status"]).map(csvEscape).join(",") + "\n");
    const columns = dataset.columns;
    const cells = new Array(columns.length + 1);
    for (let p = 0; p < matchIndex.length; p++) {
      const row = matchIndex[p];
      for (let c = 0; c < columns.length; c++) cells[c] = csvEscape(valueAt(columns[c], row));
      cells[columns.length] = csvEscape(STATUS_LABEL[thresholdStatus(age.values[row], threshold.values[row])]);
      pushLine(cells.join(",") + "\n");
    }
  });
}

export function locationStatusCsv(locations) {
  return yieldChunks((pushLine) => {
    pushLine("Outer Location,Containers,Units\n");
    for (const row of locations) {
      pushLine([csvEscape(row.name), String(row.containers), formatExportNumber(row.units)].join(",") + "\n");
    }
  });
}

export function containerTypeCsv(types) {
  return yieldChunks((pushLine) => {
    pushLine("Container type,Containers,Units\n");
    for (const row of types) {
      pushLine([csvEscape(row.name), String(row.containers), formatExportNumber(row.units)].join(",") + "\n");
    }
  });
}

export function rollupCsv(dataset, matchIndex) {
  const outer = column(dataset, "Outer Location");
  const owner = column(dataset, "Owner");
  const disposition = column(dataset, "Disposition");
  const qty = column(dataset, "Quantity");
  const age = column(dataset, "Average Age");
  const asin = column(dataset, "ASIN");
  const groups = new Map();
  for (let p = 0; p < matchIndex.length; p++) {
    const row = matchIndex[p];
    const key = outer.codes[row] + "\t" + owner.codes[row] + "\t" + disposition.codes[row];
    let group = groups.get(key);
    if (!group) {
      group = {
        outer: outer.codes[row],
        owner: owner.codes[row],
        disposition: disposition.codes[row],
        lines: 0,
        units: 0,
        ageWeighted: 0,
        asins: new Set(),
      };
      groups.set(key, group);
    }
    const quantity = qty.values[row];
    group.lines += 1;
    group.units += quantity;
    group.ageWeighted += age.values[row] * quantity;
    group.asins.add(textAt(asin, row));
  }
  const rows = Array.from(groups.values());
  rows.sort((a, b) => b.units - a.units || b.lines - a.lines);
  return yieldChunks((pushLine) => {
    pushLine("Outer Location,Owner,Disposition,Lines,Units,Unique ASINs,Avg Age\n");
    for (const group of rows) {
      const avg = group.units > 0 ? group.ageWeighted / group.units : 0;
      pushLine(
        [
          csvEscape(outer.dict[group.outer]),
          csvEscape(owner.dict[group.owner]),
          csvEscape(disposition.dict[group.disposition]),
          String(group.lines),
          formatExportNumber(group.units),
          String(group.asins.size),
          formatExportNumber(avg),
        ].join(",") + "\n"
      );
    }
  });
}

export function asinCsv(dataset, matchIndex) {
  const asin = column(dataset, "ASIN");
  const qty = column(dataset, "Quantity");
  const age = column(dataset, "Average Age");
  const threshold = column(dataset, "Average Threshold");
  const owner = column(dataset, "Owner");
  const disposition = column(dataset, "Disposition");
  const outer = column(dataset, "Outer Location");
  const warehouse = column(dataset, "Warehouse");
  const groups = new Map();
  for (let p = 0; p < matchIndex.length; p++) {
    const row = matchIndex[p];
    const key = textAt(asin, row);
    let group = groups.get(key);
    if (!group) {
      group = {
        lines: 0,
        units: 0,
        ageWeighted: 0,
        thresholdWeighted: 0,
        owner: -1,
        disposition: -1,
        outer: -1,
        warehouse: -1,
      };
      groups.set(key, group);
    }
    const quantity = qty.values[row];
    group.lines += 1;
    group.units += quantity;
    group.ageWeighted += age.values[row] * quantity;
    group.thresholdWeighted += threshold.values[row] * quantity;
    group.owner = mix(group.owner, owner.codes[row]);
    group.disposition = mix(group.disposition, disposition.codes[row]);
    group.outer = mix(group.outer, outer.codes[row]);
    group.warehouse = mix(group.warehouse, warehouse.codes[row]);
  }
  const rows = Array.from(groups.entries());
  rows.sort((a, b) => b[1].units - a[1].units || b[1].lines - a[1].lines || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return yieldChunks((pushLine) => {
    pushLine("ASIN,Lines,Units,Avg Age,Avg Threshold,Owner,Disposition,Outer Location,Warehouse\n");
    for (const [key, group] of rows) {
      const avgAge = group.units > 0 ? group.ageWeighted / group.units : 0;
      const avgThreshold = group.units > 0 ? group.thresholdWeighted / group.units : 0;
      pushLine(
        [
          csvEscape(key),
          String(group.lines),
          formatExportNumber(group.units),
          formatExportNumber(avgAge),
          formatExportNumber(avgThreshold),
          csvEscape(labelOf(owner, group.owner)),
          csvEscape(labelOf(disposition, group.disposition)),
          csvEscape(labelOf(outer, group.outer)),
          csvEscape(labelOf(warehouse, group.warehouse)),
        ].join(",") + "\n"
      );
    }
  });
}

function mix(current, next) {
  if (current === -1) return next;
  if (current === -2 || current !== next) return -2;
  return current;
}

function labelOf(col, id) {
  if (id === -2) return "MIXED";
  if (id < 0) return "";
  return col.dict[id];
}

function formatExportNumber(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(Math.round(value * 10000) / 10000);
}

export { AGE_BUCKETS };
