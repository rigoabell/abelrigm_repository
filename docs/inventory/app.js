import { asinCsv, containerTypeCsv, detailCsv, locationStatusCsv, query, rollupCsv, sortMatch, STATUS_LABEL, thresholdStatus, valueAt, normalizeGroupings } from "./engine.js";
import { forgetToken, loadSavedFile, readToken, saveDataFile, saveInventoryFile, writeToken } from "./github-save.js";

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
const saveStatus = document.getElementById("save-status");
const saveNote = document.getElementById("save-note");
const tokenInput = document.getElementById("github-token");
const saveButton = document.getElementById("save-now");

let dataset = null;
let sourceFile = null;
let publicFile = null;
let savedManifest = null;
let catalog = null;
let view = null;
let matchIndex = null;
let page = 0;
let sortMode = "before";
let worker = null;
let filterTimer = 0;
let textTimer = 0;
let loadGeneration = 0;
let saving = false;
let placeMode = "location";
let containerType = "";
let groupings = [];
let editingGroup = -1;
const GROUP_KEY = "inventory.containerGroups";

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

saveButton.addEventListener("click", () => saveNow());
document.getElementById("forget-token").addEventListener("click", () => {
  forgetToken();
  tokenInput.value = "";
  saveNote.textContent = "The token was removed from this browser. The public file is unchanged.";
});
if (readToken()) tokenInput.value = readToken();
document.getElementById("mode-location").addEventListener("click", () => setPlaceMode("location"));
document.getElementById("mode-type").addEventListener("click", () => setPlaceMode("type"));
document.getElementById("group-form").addEventListener("submit", (event) => {
  event.preventDefault();
  addGrouping();
});
document.getElementById("save-groupings").addEventListener("click", () => saveGroupingsToSite());
document.getElementById("group-help").textContent =
  "Optional. A bin uses the longest grouping it starts with. Otherwise it is grouped by the letters before the first number. Saved groupings stay in this browser until you save them to the site.";

function openFile(file, kind) {
  const generation = ++loadGeneration;
  startParse(file, kind || "upload", generation);
}

function startParse(file, kind, generation) {
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
    parseOnPage(file, kind, generation);
    return;
  }
  worker.onmessage = (event) => {
    if (generation !== loadGeneration) return;
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
      acceptDataset(message.dataset, file, kind, generation);
    }
  };
  worker.onerror = (event) => {
    if (generation !== loadGeneration) return;
    fail(event.message || "The parser stopped unexpectedly.");
  };
  worker.postMessage({ file });
}

async function parseOnPage(file, kind, generation) {
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
    if (generation !== loadGeneration) return;
    acceptDataset(parser.finish(), file, kind, generation);
  } catch (error) {
    if (generation !== loadGeneration) return;
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

async function acceptDataset(next, file, kind, generation) {
  await groupingsReady;
  if (generation !== loadGeneration) return;
  dataset = next;
  loadingTitle.textContent = "Summarizing " + formatInt(dataset.rowCount) + " lines";
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (generation !== loadGeneration) return;
  catalog = query(dataset, {});
  sortMode = "before";
  document.getElementById("sort-mode").value = "before";
  clearFilters(false);
  loading.classList.add("hidden");
  errorBox.classList.add("hidden");
  dropPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  fileName.textContent = file.name;
  updateFileMeta();
  updateSavePanel();
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
  if (kind === "upload" && readToken()) saveNow();
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
    containerType,
    groupings,
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
  if (filter.containerType) return true;
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
  renderPlace();
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
  containerType = "";
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

function renderPlace() {
  const typeMode = placeMode === "type";
  document.getElementById("place-title").textContent = typeMode ? "Container type" : "Outer locations";
  document.getElementById("mode-location").setAttribute("aria-pressed", typeMode ? "false" : "true");
  document.getElementById("mode-type").setAttribute("aria-pressed", typeMode ? "true" : "false");
  document.getElementById("group-editor").classList.toggle("hidden", !typeMode);
  const note = document.getElementById("location-count");
  if (typeMode) {
    note.textContent = containerType
      ? "Filtered to " + containerType + ". Click it again to show every type. Grouped by the letters before the first number, unless a grouping matches."
      : "Grouped by the letters before the first number. tsX27482942 is tsX, and tsTDST34394839 is tsTDST. Click a type to filter to it.";
    renderContainerTypes();
    renderGroupEditor();
    return;
  }
  note.textContent = "Containers and units for the threshold states that are checked. Click a location to filter to it.";
  renderLocations();
}

function renderLocations() {
  const head = document.getElementById("location-head");
  const body = document.getElementById("location-body");
  const rows = view.locations;
  head.replaceChildren();
  const headRow = document.createElement("tr");
  appendHeader(headRow, "Outer location", false);
  appendHeader(headRow, "Containers", true);
  appendHeader(headRow, "Units", true);
  head.appendChild(headRow);
  body.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
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
    appendCount(row, formatInt(item.containers), () => isolate("Outer Location", item.id));
    appendCount(row, formatQty(item.units), () => isolate("Outer Location", item.id));
    body.appendChild(row);
  }
}

function renderContainerTypes() {
  const head = document.getElementById("location-head");
  const body = document.getElementById("location-body");
  const rows = view.containerTypes || [];
  head.replaceChildren();
  const headRow = document.createElement("tr");
  appendHeader(headRow, "Container type", false);
  appendHeader(headRow, "Containers", true);
  appendHeader(headRow, "Units", true);
  head.appendChild(headRow);
  body.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 3;
    cell.className = "inv-empty";
    cell.textContent = "No container types in this view.";
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
    nameButton.setAttribute("aria-pressed", containerType === item.name ? "true" : "false");
    nameButton.addEventListener("click", () => toggleContainerType(item.name));
    nameCell.appendChild(nameButton);
    row.appendChild(nameCell);
    appendCount(row, formatInt(item.containers), () => toggleContainerType(item.name));
    appendCount(row, formatQty(item.units), () => toggleContainerType(item.name));
    body.appendChild(row);
  }
}

function toggleContainerType(name) {
  containerType = containerType === name ? "" : name;
  applyFilters();
}

function appendCount(row, text, onClick) {
  const cell = document.createElement("td");
  cell.className = "num";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "inv-count";
  button.textContent = text;
  button.addEventListener("click", onClick);
  cell.appendChild(button);
  row.appendChild(cell);
}

function appendHeader(row, text, numeric) {
  const cell = document.createElement("th");
  if (numeric) cell.className = "num";
  cell.textContent = text;
  row.appendChild(cell);
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
  const summaryExport = kind === "locations" || kind === "types";
  const summaryRows = kind === "types" ? view && view.containerTypes : view && view.locations;
  if (!dataset || (summaryExport ? !summaryRows || !summaryRows.length : !matchIndex || !matchIndex.length)) {
    exportStatus.textContent = "Nothing to export for the current filters.";
    return;
  }
  const base = sourceName();
  const names = {
    lines: base + "-filtered.csv",
    rollup: base + "-rollup.csv",
    asin: base + "-by-asin.csv",
    locations: base + "-by-location.csv",
    types: base + "-by-type.csv",
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
    types: () => containerTypeCsv(view.containerTypes),
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

function updateFileMeta() {
  const places = placeSummary(catalog);
  const where = sourceFile === publicFile ? "public copy" : "only in this browser until you save it";
  fileMeta.textContent =
    formatBytes(sourceFile.size) +
    " · " +
    formatInt(dataset.rowCount) +
    " lines in the file · " +
    places +
    " · " +
    where;
}

function updateSavePanel(result) {
  if (sourceFile === publicFile && savedManifest) {
    saveStatus.textContent =
      "Public copy on the site. Saved " +
      formatChicago(savedManifest.savedAt) +
      ". Anyone who can open this site can read the file.";
  } else {
    saveStatus.textContent = "This file is only in this browser until you save it. The saved copy is public.";
  }
  if (!result) return;
  if (result.direct) {
    saveNote.textContent = "Saved. Other machines see this file after GitHub Pages deploys, usually within a few minutes.";
    return;
  }
  const link = result.prUrl ? " Merge " + result.prUrl + "." : " Open a pull request from inventory-saved into main.";
  saveNote.textContent = "Main is protected, so the file is on branch inventory-saved." + link + " Other machines see it after that merge and the Pages deploy.";
}

function formatChicago(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso || "");
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date) + " CT";
}

async function saveNow() {
  if (!sourceFile || !dataset || saving) return;
  const token = tokenInput.value.trim();
  if (!token) {
    saveNote.textContent = "Paste a GitHub token with Contents access to this repository, then save.";
    return;
  }
  writeToken(token);
  const generation = loadGeneration;
  const file = sourceFile;
  saving = true;
  saveButton.disabled = true;
  saveNote.textContent = "Saving the public copy…";
  try {
    const result = await saveInventoryFile(file, token, (message) => {
      if (generation === loadGeneration) saveNote.textContent = message;
    });
    if (generation !== loadGeneration) return;
    savedManifest = result.manifest;
    publicFile = file;
    updateFileMeta();
    updateSavePanel(result);
  } catch (error) {
    if (generation !== loadGeneration) return;
    saveNote.textContent = error && error.message ? error.message : String(error);
  } finally {
    saving = false;
    saveButton.disabled = false;
    if (generation !== loadGeneration && sourceFile && sourceFile !== publicFile && readToken()) saveNow();
  }
}

function setPlaceMode(mode) {
  placeMode = mode === "type" ? "type" : "location";
  if (view) renderPlace();
}

function addGrouping() {
  const name = document.getElementById("group-name").value.trim();
  const prefix = document.getElementById("group-prefix").value.trim();
  if (!name || !prefix) {
    document.getElementById("group-note").textContent = "Enter a group name and the letters it starts with.";
    return;
  }
  const next = groupings.slice();
  if (editingGroup >= 0 && editingGroup < next.length) next[editingGroup] = { name, prefix };
  else next.push({ name, prefix });
  groupings = normalizeGroupings(next);
  editingGroup = -1;
  document.getElementById("group-name").value = "";
  document.getElementById("group-prefix").value = "";
  document.getElementById("group-submit").textContent = "Add grouping";
  storeGroupings();
  document.getElementById("group-note").textContent = "Saved in this browser.";
  if (dataset) applyFilters();
  else renderGroupEditor();
}

function storeGroupings() {
  localStorage.setItem(GROUP_KEY, JSON.stringify(groupings));
}

function renderGroupEditor() {
  const list = document.getElementById("group-list");
  list.replaceChildren();
  if (!groupings.length) {
    const item = document.createElement("li");
    item.textContent = "No groupings yet. Letter prefixes are used on their own.";
    list.appendChild(item);
    return;
  }
  groupings.forEach((group, index) => {
    const item = document.createElement("li");
    const name = document.createElement("b");
    name.textContent = group.name;
    const prefix = document.createElement("span");
    prefix.textContent = "starts with " + group.prefix;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn btn-outline btn-sm";
    edit.textContent = "Edit";
    edit.addEventListener("click", () => {
      editingGroup = index;
      document.getElementById("group-name").value = group.name;
      document.getElementById("group-prefix").value = group.prefix;
      document.getElementById("group-submit").textContent = "Update grouping";
    });
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-outline btn-sm";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      groupings = groupings.filter((_, itemIndex) => itemIndex !== index);
      if (editingGroup === index) editingGroup = -1;
      storeGroupings();
      document.getElementById("group-note").textContent = "Saved in this browser.";
      if (dataset) applyFilters();
      else renderGroupEditor();
    });
    item.appendChild(name);
    item.appendChild(prefix);
    item.appendChild(edit);
    item.appendChild(remove);
    list.appendChild(item);
  });
}

async function saveGroupingsToSite() {
  const note = document.getElementById("group-note");
  const token = (tokenInput.value || readToken()).trim();
  if (!token) {
    note.textContent = "Paste a GitHub token in Saved copy, then save. The groupings are already kept in this browser.";
    return;
  }
  writeToken(token);
  note.textContent = "Saving groupings…";
  try {
    const result = await saveDataFile(
      "groupings.json",
      JSON.stringify(groupings, null, 2) + "\n",
      token,
      "Save container groupings"
    );
    note.textContent = result.direct
      ? "Saved. Other machines see these groupings after GitHub Pages deploys, usually within a few minutes."
      : "Main is protected, so the groupings are on branch inventory-saved." + (result.prUrl ? " Merge " + result.prUrl + "." : "");
  } catch (error) {
    note.textContent = error && error.message ? error.message : String(error);
  }
}

async function loadGroupings() {
  try {
    const stored = localStorage.getItem(GROUP_KEY);
    if (stored != null) {
      groupings = normalizeGroupings(JSON.parse(stored));
      return;
    }
  } catch (error) {
    groupings = [];
  }
  try {
    const response = await fetch(new URL("data/groupings.json", import.meta.url), { cache: "no-store" });
    if (!response.ok) return;
    groupings = normalizeGroupings(await response.json());
  } catch (error) {
    groupings = [];
  }
}

const groupingsReady = loadGroupings();

async function loadSavedOnStart() {
  const generation = ++loadGeneration;
  dropPanel.classList.add("hidden");
  errorBox.classList.add("hidden");
  loading.classList.remove("hidden");
  loadingTitle.textContent = "Looking for the saved inventory";
  loadingStat.textContent = "";
  loadingBar.style.width = "0%";
  try {
    const saved = await loadSavedFile();
    if (generation !== loadGeneration) return;
    if (!saved) {
      loading.classList.add("hidden");
      dropPanel.classList.remove("hidden");
      return;
    }
    savedManifest = saved.manifest;
    publicFile = saved.file;
    startParse(saved.file, "saved", generation);
  } catch (error) {
    if (generation !== loadGeneration) return;
    loading.classList.add("hidden");
    dropPanel.classList.remove("hidden");
    const note = document.getElementById("saved-note");
    note.classList.remove("hidden");
    note.textContent =
      "The saved inventory could not be loaded (" +
      (error && error.message ? error.message : "error") +
      "). You can still open a file from this machine.";
  }
}

loadSavedOnStart();
