import { asinCsv, detailCsv, locationStatusCsv, query, rollupCsv, sortMatch, STATUS_LABEL, thresholdStatus, valueAt } from "./engine.js";

const PAGE_SIZE = 50;
const FILTER_COLUMNS = [
  "Owner",
  "Disposition",
  "Outer Location",
  "Warehouse",
  "Region",
  "Amazon Device Flag",
];

const dropPanel = document.getElementById("drop-panel");
const dropTarget = document.getElementById("drop-target");
const fileInput = document.getElementById("file-input");
const loading = document.getElementById("loading");
const loadingTitle = document.getElementById("loading-title");
const loadingStat = document.getElementById("loading-stat");
const loadingBar = document.getElementById("loading-bar");
const errorBox = document.getElementById("error");
const errorText = document.getElementById("error-text");
const workspace = document.getElementById("workspace");
const fileName = document.getElementById("file-name");
const fileMeta = document.getElementById("file-meta");
const badNumbers = document.getElementById("bad-numbers");
const kpis = document.getElementById("kpis");
const charts = document.getElementById("charts");
const filterGroups = document.getElementById("filter-groups");
const tableBody = document.getElementById("table-body");
const tableCount = document.getElementById("table-count");
const pageLabel = document.getElementById("page-label");
const exportStatus = document.getElementById("export-status");
const clearButton = document.getElementById("clear-filters");

let dataset = null;
let sourceFile = null;
let catalog = null;
let view = null;
let matchIndex = null;
let page = 0;
let sortMode = "before";
let worker = null;
let filterTimer = 0;
let textTimer = 0;

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (file) openFile(file);
});

dropTarget.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropTarget.classList.add("dragover");
});
dropTarget.addEventListener("dragleave", () => dropTarget.classList.remove("dragover"));
dropTarget.addEventListener("drop", (event) => {
  event.preventDefault();
  dropTarget.classList.remove("dragover");
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) openFile(file);
});

document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
  event.preventDefault();
  if (event.target.closest("#drop-target")) return;
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) openFile(file);
});

document.getElementById("replace-file").addEventListener("click", () => fileInput.click());
document.getElementById("error-retry").addEventListener("click", () => fileInput.click());
clearButton.addEventListener("click", clearFilters);
document.getElementById("sort-mode").addEventListener("change", (event) => {
  sortMode = event.target.value;
  page = 0;
  applySort();
  renderTable();
});
document.getElementById("page-first").addEventListener("click", () => goPage(0));
document.getElementById("page-prev").addEventListener("click", () => goPage(page - 1));
document.getElementById("page-next").addEventListener("click", () => goPage(page + 1));
document.getElementById("page-last").addEventListener("click", () => goPage(pageCount() - 1));

for (const box of document.querySelectorAll("[data-status]")) {
  box.addEventListener("change", () => {
    clearTimeout(filterTimer);
    filterTimer = setTimeout(applyFilters, 0);
  });
}

for (const id of ["filter-asin", "filter-bin", "filter-age-min", "filter-age-max", "filter-qty-min"]) {
  document.getElementById(id).addEventListener("input", () => {
    clearTimeout(textTimer);
    textTimer = setTimeout(applyFilters, 200);
  });
}

for (const button of document.querySelectorAll("[data-export]")) {
  button.addEventListener("click", () => exportFile(button.dataset.export, button));
}

function openFile(file) {
  sourceFile = file;
  fileInput.value = "";
  showLoading(file);
  if (worker) {
    worker.terminate();
    worker = null;
  }
  try {
    worker = new Worker(new URL("./parse-worker.js", import.meta.url), { type: "module" });
  } catch (error) {
    parseOnPage(file);
    return;
  }
  worker.onmessage = (event) => {
    const message = event.data;
    if (message.type === "progress") {
      setProgress(message.rows || 0, message.bytes || 0, message.size || file.size);
      return;
    }
    if (message.type === "error") {
      fail(message.message);
      return;
    }
    if (message.type === "done") {
      worker.terminate();
      worker = null;
      acceptDataset(message.dataset, file);
    }
  };
  worker.onerror = (event) => {
    fail(event.message || "The parser stopped unexpectedly.");
  };
  worker.postMessage({ file });
}

async function parseOnPage(file) {
  const { createDatasetParser } = await import("./engine.js");
  const parser = createDatasetParser({
    onProgress(rows) {
      setProgress(rows, file.size, file.size);
    },
  });
  try {
    const reader = file.stream().getReader();
    const decoder = new TextDecoder("utf-8");
    let bytes = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      parser.push(decoder.decode(value, { stream: true }));
      setProgress(parser.rowCount, bytes, file.size);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    parser.push(decoder.decode());
    acceptDataset(parser.finish(), file);
  } catch (error) {
    fail(error && error.message ? error.message : String(error));
  }
}

function showLoading(file) {
  dropPanel.classList.add("hidden");
  workspace.classList.add("hidden");
  errorBox.classList.add("hidden");
  loading.classList.remove("hidden");
  loadingTitle.textContent = "Reading " + file.name;
  loadingStat.textContent = formatBytes(file.size);
  loadingBar.style.width = "0%";
}

function setProgress(rows, bytes, size) {
  const pct = size ? Math.min(100, Math.round((bytes / size) * 100)) : 0;
  loadingBar.style.width = pct + "%";
  loadingStat.textContent = formatInt(rows) + " lines · " + formatBytes(bytes) + " of " + formatBytes(size);
}

function fail(message) {
  if (worker) worker.terminate();
  worker = null;
  loading.classList.add("hidden");
  workspace.classList.add("hidden");
  dropPanel.classList.remove("hidden");
  errorBox.classList.remove("hidden");
  errorText.textContent = message;
}

async function acceptDataset(next, file) {
  dataset = next;
  loadingTitle.textContent = "Summarizing " + formatInt(dataset.rowCount) + " lines";
  await new Promise((resolve) => setTimeout(resolve, 0));
  catalog = query(dataset, {});
  sortMode = "before";
  document.getElementById("sort-mode").value = "before";
  clearFilters(false);
  loading.classList.add("hidden");
  errorBox.classList.add("hidden");
  dropPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  fileName.textContent = file.name;
  const places = placeSummary(catalog);
  fileMeta.textContent =
    formatBytes(file.size) +
    " · " +
    formatInt(dataset.rowCount) +
    " lines in the file · " +
    places +
    " · stays in this browser";
  if (dataset.badNumbers) {
    badNumbers.hidden = false;
    badNumbers.classList.remove("hidden");
    badNumbers.textContent =
      formatInt(dataset.badNumbers) +
      " quantity, age, or threshold values were not numbers. They count as zero in the totals and stay unchanged in the line export.";
  } else {
    badNumbers.classList.add("hidden");
  }
  buildFilterGroups();
  applyFilters();
}

function placeSummary(summary) {
  const warehouses = summary.warehouse.map(displayName);
  const regions = summary.region.map(displayName);
  if (warehouses.length === 1 && regions.length === 1) return warehouses[0] + " · " + regions[0];
  return formatInt(warehouses.length) + " warehouses · " + formatInt(regions.length) + " regions";
}

function buildFilterGroups() {
  filterGroups.replaceChildren();
  for (const name of FILTER_COLUMNS) {
    const series = catalog[seriesKey(name)];
    if (!series || series.length < 2) continue;
    const group = document.createElement("div");
    group.className = "inv-group";
    const title = document.createElement("h3");
    title.textContent = name;
    group.appendChild(title);
    if (series.length > 8) {
      const find = document.createElement("input");
      find.className = "inv-group-find";
      find.type = "search";
      find.placeholder = "Find";
      find.addEventListener("input", () => {
        const needle = find.value.trim().toLowerCase();
        group.querySelectorAll(".inv-check").forEach((label) => {
          const text = label.dataset.label || "";
          label.classList.toggle("hidden", needle && !text.includes(needle));
        });
      });
      group.appendChild(find);
    }
    const list = document.createElement("div");
    list.className = "inv-checks";
    list.dataset.column = name;
    for (const item of series) {
      const label = document.createElement("label");
      label.className = "inv-check";
      label.dataset.label = displayName(item).toLowerCase();
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = true;
      box.dataset.filter = name;
      box.dataset.id = String(item.id);
      box.addEventListener("change", () => {
        clearTimeout(filterTimer);
        filterTimer = setTimeout(applyFilters, 0);
      });
      const text = document.createElement("span");
      text.className = "inv-check-label";
      text.dataset.countFor = name + ":" + item.id;
      const nameNode = document.createElement("b");
      nameNode.textContent = displayName(item);
      nameNode.style.fontWeight = "700";
      nameNode.style.color = "var(--text)";
      text.appendChild(nameNode);
      text.appendChild(document.createTextNode(" · "));
      const count = document.createElement("span");
      count.dataset.count = name + ":" + item.id;
      count.textContent = formatInt(item.units);
      text.appendChild(count);
      label.appendChild(box);
      label.appendChild(text);
      list.appendChild(label);
    }
    group.appendChild(list);
    filterGroups.appendChild(group);
  }
}

function readFilter() {
  const allow = {};
  for (const name of FILTER_COLUMNS) {
    const boxes = filterGroups.querySelectorAll('input[data-filter="' + name + '"]');
    if (!boxes.length) continue;
    const selected = new Set();
    let checked = 0;
    boxes.forEach((box) => {
      if (box.checked) {
        checked += 1;
        selected.add(Number(box.dataset.id));
      }
    });
    if (checked === 0) allow[name] = new Set();
    else if (checked < boxes.length) allow[name] = selected;
  }
  return {
    asin: document.getElementById("filter-asin").value,
    bin: document.getElementById("filter-bin").value,
    ageMin: document.getElementById("filter-age-min").value,
    ageMax: document.getElementById("filter-age-max").value,
    qtyMin: document.getElementById("filter-qty-min").value,
    allow,
    statuses: readStatuses(),
  };
}

function readStatuses() {
  const statuses = new Set();
  document.querySelectorAll("[data-status]").forEach((box) => {
    if (box.checked) statuses.add(box.dataset.status);
  });
  return statuses;
}

function isDefaultStatus(statuses) {
  return statuses.size === 3 && statuses.has("approaching") && statuses.has("at") && statuses.has("diot");
}

function filtersActive(filter) {
  if (filter.asin.trim() || filter.bin.trim()) return true;
  if (filter.ageMin !== "" || filter.ageMax !== "" || filter.qtyMin !== "") return true;
  if (!isDefaultStatus(filter.statuses)) return true;
  return Object.keys(filter.allow).length > 0;
}

function applyFilters() {
  if (!dataset) return;
  const filter = readFilter();
  view = query(dataset, filter);
  page = 0;
  applySort();
  clearButton.classList.toggle("hidden", !filtersActive(filter));
  renderSummary();
  renderLocations();
  renderCharts();
  renderTable();
  updateCounts();
}

function applySort() {
  if (!view) return;
  matchIndex = sortMatch(dataset, view.matchIndex, sortMode);
}

function clearFilters(rerun) {
  for (const id of ["filter-asin", "filter-bin", "filter-age-min", "filter-age-max", "filter-qty-min"]) {
    document.getElementById(id).value = "";
  }
  filterGroups.querySelectorAll("input[type=checkbox]").forEach((box) => {
    box.checked = true;
  });
  document.querySelectorAll("[data-status]").forEach((box) => {
    box.checked = box.dataset.status !== "early";
  });
  filterGroups.querySelectorAll(".inv-check").forEach((label) => label.classList.remove("hidden"));
  filterGroups.querySelectorAll(".inv-group-find").forEach((input) => {
    input.value = "";
  });
  if (rerun !== false && dataset) applyFilters();
}

function isolate(columnName, id) {
  const boxes = filterGroups.querySelectorAll('input[data-filter="' + columnName + '"]');
  const onlyThis =
    Array.from(boxes).every((box) => (Number(box.dataset.id) === id ? box.checked : !box.checked));
  boxes.forEach((box) => {
    box.checked = onlyThis ? true : Number(box.dataset.id) === id;
  });
  applyFilters();
}

function isolateAge(bucket) {
  const min = document.getElementById("filter-age-min");
  const max = document.getElementById("filter-age-max");
  const minText = bucket.min == null ? "" : String(bucket.min);
  const maxText = bucket.max == null ? "" : String(bucket.max);
  const already = min.value === minText && max.value === maxText;
  min.value = already ? "" : minText;
  max.value = already ? "" : maxText;
  applyFilters();
}

function renderSummary() {
  const selected = readStatuses();
  const cards = [
    ["diot", "DIOT", "Past the threshold"],
    ["at", "At", "Less than 1 day before"],
    ["approaching", "Approaching", "1–2 days before"],
  ];
  kpis.replaceChildren();
  for (const [id, label, detail] of cards) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "inv-kpi " + id;
    card.setAttribute("aria-pressed", selected.size === 1 && selected.has(id) ? "true" : "false");
    const strong = document.createElement("b");
    strong.textContent = formatInt(view.status[id].lines);
    const caption = document.createElement("span");
    caption.textContent = label + " · " + formatQty(view.status[id].units) + " units · " + detail;
    card.appendChild(strong);
    card.appendChild(caption);
    card.addEventListener("click", () => setOnlyStatus(id));
    kpis.appendChild(card);
  }
}

function setOnlyStatus(statusId) {
  const boxes = Array.from(document.querySelectorAll("[data-status]"));
  const onlyThis = boxes.every((box) => (box.dataset.status === statusId ? box.checked : !box.checked));
  boxes.forEach((box) => {
    box.checked = onlyThis ? box.dataset.status !== "early" : box.dataset.status === statusId;
  });
  applyFilters();
}

function renderLocations() {
  const body = document.getElementById("location-body");
  const rows = view.locations;
  body.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "inv-empty";
    cell.textContent = "No outer locations in this view.";
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  for (const item of rows) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "inv-loc-name";
    nameButton.textContent = item.name || "(blank)";
    nameButton.addEventListener("click", () => isolate("Outer Location", item.id));
    nameCell.appendChild(nameButton);
    row.appendChild(nameCell);
    for (const key of ["approaching", "at", "diot", "early"]) {
      const cell = document.createElement("td");
      cell.className = "num";
      const button = document.createElement("button");
      button.type = "button";
      button.className = "inv-count";
      button.textContent = formatInt(item[key]);
      button.addEventListener("click", () => focusLocationStatus(item.id, key));
      cell.appendChild(button);
      row.appendChild(cell);
    }
    body.appendChild(row);
  }
}

function focusLocationStatus(outerId, statusId) {
  filterGroups.querySelectorAll('input[data-filter="Outer Location"]').forEach((box) => {
    box.checked = Number(box.dataset.id) === outerId;
  });
  document.querySelectorAll("[data-status]").forEach((box) => {
    box.checked = box.dataset.status === statusId;
  });
  applyFilters();
}

function renderCharts() {
  charts.replaceChildren();
  charts.appendChild(barChart("Disposition", "Disposition", view.disposition));
  charts.appendChild(barChart("Owner", "Owner", view.owner));
  charts.appendChild(barChart("Outer location", "Outer Location", view.outer, 12));
  charts.appendChild(ageChart());
  if (view.device.some((item) => item.name)) {
    charts.appendChild(barChart("Device flag", "Amazon Device Flag", view.device));
  }
}

function barChart(title, columnName, series, limit) {
  const card = document.createElement("section");
  card.className = "inv-chart";
  const heading = document.createElement("h3");
  heading.textContent = title;
  card.appendChild(heading);
  const shown = limit ? series.slice(0, limit) : series;
  const rest = limit ? series.slice(limit) : [];
  const restUnits = rest.reduce((sum, item) => sum + item.units, 0);
  const max = Math.max(shown.reduce((peak, item) => Math.max(peak, item.units), 0), restUnits, 1);
  const active = activeIds(columnName);
  if (!shown.length) {
    const empty = document.createElement("p");
    empty.className = "inv-empty";
    empty.textContent = "No lines.";
    card.appendChild(empty);
    return card;
  }
  for (const item of shown) {
    const pressed = active ? active.has(item.id) && active.size === 1 : false;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inv-bar";
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.appendChild(barName(displayName(item)));
    button.appendChild(barTrack(item.units / max));
    button.appendChild(barValue(formatQty(item.units)));
    button.addEventListener("click", () => isolate(columnName, item.id));
    card.appendChild(button);
  }
  if (rest.length) {
    const row = document.createElement("div");
    row.className = "inv-bar-static";
    row.appendChild(barName("Other (" + formatInt(rest.length) + ")"));
    row.appendChild(barTrack(restUnits / max));
    row.appendChild(barValue(formatQty(restUnits)));
    card.appendChild(row);
  }
  return card;
}

function ageChart() {
  const card = document.createElement("section");
  card.className = "inv-chart";
  const heading = document.createElement("h3");
  heading.textContent = "Average age";
  card.appendChild(heading);
  const max = view.ageBuckets.reduce((peak, bucket) => Math.max(peak, bucket.units), 0) || 1;
  const min = document.getElementById("filter-age-min").value;
  const maxAge = document.getElementById("filter-age-max").value;
  for (const bucket of view.ageBuckets) {
    const minText = String(bucket.min);
    const maxText = bucket.max == null ? "" : String(bucket.max);
    const pressed = min === minText && maxAge === maxText;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inv-bar";
    button.setAttribute("aria-pressed", pressed ? "true" : "false");
    button.appendChild(barName(bucket.label));
    button.appendChild(barTrack(bucket.units / max));
    button.appendChild(barValue(formatQty(bucket.units)));
    button.addEventListener("click", () => isolateAge(bucket));
    card.appendChild(button);
  }
  return card;
}

function barName(text) {
  const node = document.createElement("span");
  node.className = "inv-bar-name";
  node.textContent = text;
  return node;
}
function barTrack(ratio) {
  const track = document.createElement("span");
  track.className = "inv-track";
  const fill = document.createElement("span");
  fill.style.width = Math.max(0, Math.min(100, ratio * 100)) + "%";
  track.appendChild(fill);
  return track;
}
function barValue(text) {
  const node = document.createElement("span");
  node.className = "inv-bar-val";
  node.textContent = text;
  return node;
}

function activeIds(columnName) {
  const boxes = filterGroups.querySelectorAll('input[data-filter="' + columnName + '"]');
  if (!boxes.length) return null;
  const selected = new Set();
  let checked = 0;
  boxes.forEach((box) => {
    if (box.checked) {
      checked += 1;
      selected.add(Number(box.dataset.id));
    }
  });
  if (checked === boxes.length) return null;
  return selected;
}

function updateCounts() {
  const groups = {
    Owner: view.owner,
    Disposition: view.disposition,
    "Outer Location": view.outer,
    Warehouse: view.warehouse,
    Region: view.region,
    "Amazon Device Flag": view.device,
  };
  for (const [name, series] of Object.entries(groups)) {
    const counts = new Map(series.map((item) => [item.id, item.units]));
    document.querySelectorAll('[data-count="' + name + ':"], [data-count^="' + name + ':"]').forEach((node) => {
      const id = Number(node.dataset.count.slice(name.length + 1));
      node.textContent = formatQty(counts.get(id) || 0);
    });
  }
}

function renderTable() {
  const total = matchIndex ? matchIndex.length : 0;
  const pages = pageCount();
  if (page >= pages) page = pages - 1;
  if (page < 0) page = 0;
  const start = total ? page * PAGE_SIZE : 0;
  const end = Math.min(total, start + PAGE_SIZE);
  tableCount.textContent = total
    ? "Showing " + formatInt(start + 1) + "–" + formatInt(end) + " of " + formatInt(total)
    : "No lines match these filters.";
  pageLabel.textContent = "Page " + formatInt(page + 1) + " of " + formatInt(pages);
  tableBody.replaceChildren();
  if (!total) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 10;
    cell.className = "inv-empty";
    cell.textContent = "Nothing to show.";
    row.appendChild(cell);
    tableBody.appendChild(row);
    return;
  }
  const columns = {
    ASIN: dataset.byName.ASIN,
    "Outer Location": dataset.byName["Outer Location"],
    Bin: dataset.byName.Bin,
    Owner: dataset.byName.Owner,
    Disposition: dataset.byName.Disposition,
    Quantity: dataset.byName.Quantity,
    "Average Age": dataset.byName["Average Age"],
    "Average Threshold": dataset.byName["Average Threshold"],
    "Amazon Device Flag": dataset.byName["Amazon Device Flag"],
  };
  for (let slot = start; slot < end; slot++) {
    const index = matchIndex[slot];
    const age = columns["Average Age"].values[index];
    const threshold = columns["Average Threshold"].values[index];
    const row = document.createElement("tr");
    addCell(row, STATUS_LABEL[thresholdStatus(age, threshold)]);
    addCell(row, formatDays(threshold - age), true);
    addCell(row, valueAt(columns["Outer Location"], index));
    addCell(row, valueAt(columns.Bin, index));
    addCell(row, valueAt(columns.ASIN, index));
    addCell(row, valueAt(columns["Average Age"], index), true);
    addCell(row, valueAt(columns["Average Threshold"], index), true);
    addCell(row, valueAt(columns.Quantity, index), true);
    addCell(row, valueAt(columns.Owner, index));
    addCell(row, valueAt(columns.Disposition, index));
    tableBody.appendChild(row);
  }
}

function addCell(row, value, numeric) {
  const cell = document.createElement("td");
  if (numeric) cell.className = "num";
  cell.textContent = value;
  row.appendChild(cell);
}

function goPage(next) {
  const pages = pageCount();
  page = Math.max(0, Math.min(pages - 1, next));
  renderTable();
}

function pageCount() {
  const total = matchIndex ? matchIndex.length : 0;
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

async function exportFile(kind, button) {
  const locationExport = kind === "locations";
  if (!dataset || (locationExport ? !view || !view.locations.length : !matchIndex || !matchIndex.length)) {
    exportStatus.textContent = "Nothing to export for the current filters.";
    return;
  }
  const base = sourceName();
  const names = {
    lines: base + "-filtered.csv",
    rollup: base + "-rollup.csv",
    asin: base + "-by-asin.csv",
    locations: base + "-by-location.csv",
  };
  const filename = names[kind];
  let writable = null;
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "CSV", accept: { "text/csv": [".csv"] } }],
      });
      writable = await handle.createWritable();
    } catch (error) {
      if (error && error.name === "AbortError") {
        exportStatus.textContent = "Download canceled.";
        return;
      }
    }
  }
  const builders = {
    lines: () => detailCsv(dataset, view.matchIndex),
    rollup: () => rollupCsv(dataset, view.matchIndex),
    asin: () => asinCsv(dataset, view.matchIndex),
    locations: () => locationStatusCsv(view.locations),
  };
  button.disabled = true;
  exportStatus.textContent = "Building " + filename + "…";
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const chunks = builders[kind]();
    if (writable) {
      await writable.write("\uFEFF");
      for (const chunk of chunks) await writable.write(chunk);
      await writable.close();
    } else {
      downloadBlob(filename, chunks);
    }
    exportStatus.textContent = "Saved " + filename + " (" + formatInt(view.lines) + " source lines).";
  } catch (error) {
    if (writable) {
      try { await writable.abort(); } catch (abortError) { /* already closed */ }
    }
    exportStatus.textContent = error && error.message ? error.message : String(error);
  } finally {
    button.disabled = false;
  }
}

function downloadBlob(filename, chunks) {
  const blob = new Blob(["\uFEFF"].concat(chunks), { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
}

function sourceName() {
  const name = sourceFile && sourceFile.name ? sourceFile.name : "inventory.csv";
  return name.replace(/\.csv$/i, "") || "inventory";
}

function seriesKey(name) {
  if (name === "Outer Location") return "outer";
  if (name === "Amazon Device Flag") return "device";
  if (name === "Warehouse") return "warehouse";
  if (name === "Region") return "region";
  if (name === "Owner") return "owner";
  return "disposition";
}

function displayName(item) {
  return item.name ? item.name : "(blank)";
}

function formatInt(value) {
  return Math.round(Number(value) || 0).toLocaleString("en-US");
}
function formatQty(value) {
  const number = Number(value) || 0;
  if (Math.abs(number - Math.round(number)) < 1e-6) return Math.round(number).toLocaleString("en-US");
  return number.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function formatAvg(value) {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}
function formatDays(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-6) return String(Math.round(value));
  return String(Math.round(value * 100) / 100);
}
function formatBytes(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return size + " B";
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + " KB";
  return (size / (1024 * 1024)).toFixed(1) + " MB";
}
