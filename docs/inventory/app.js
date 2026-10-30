import { asinCsv, assignmentPackage, containerTypeCsv, detailCsv, diotOverageText, INVENTORY_THRESHOLD_RATE, locationStatusCsv, query, rollupCsv, sortMatch, STATUS_LABEL, thresholdStatus, valueAt, normalizeGroupings } from "./engine.js";
import { forgetToken, loadSavedFile, readToken, saveDataFile, saveInventoryFile, writeToken } from "./github-save.js";
import { assignmentWorkbook } from "./xlsx.js";

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
let sortMode = "file";
let worker = null;
let filterTimer = 0;
let textTimer = 0;
let loadGeneration = 0;
let saving = false;
let placeMode = "location";
let containerType = "";
let groupings = [];
let editingGroup = -1;
let responders = [];
const selectedPlaces = new Set();
const assignments = new Map();
const GROUP_KEY = "inventory.containerGroups";
const RESPONDER_KEY = "inventory.iolResponders";
const ASSIGNMENT_KEY = "inventory.assignments";

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
  button.addEventListener("click", () => {
    if (button.dataset.export === "assignments") exportAssignments(button);
    else exportFile(button.dataset.export, button);
  });
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
document.getElementById("responder-form").addEventListener("submit", (event) => {
  event.preventDefault();
  addResponder();
});
document.getElementById("assign-selected").addEventListener("click", () => assignSelected());
document.getElementById("clear-assignment").addEventListener("click", () => clearSelectedAssignments());
document.getElementById("export-assignments").addEventListener("click", (event) => exportAssignments(event.currentTarget));
document.getElementById("save-responders").addEventListener("click", () => saveRespondersToSite());

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
  await Promise.all([groupingsReady, respondersReady]);
  if (generation !== loadGeneration) return;
  dataset = next;
  loadingTitle.textContent = "Summarizing " + formatInt(dataset.rowCount) + " lines";
  await new Promise((resolve) => setTimeout(resolve, 0));
  if (generation !== loadGeneration) return;
  catalog = query(dataset, {});
  sortMode = "file";
  document.getElementById("sort-mode").value = "file";
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

function inventoryThreshold() {
  return catalog ? catalog.units * INVENTORY_THRESHOLD_RATE : 0;
}

function diotTone(units) {
  const delta = (Number(units) || 0) - inventoryThreshold();
  if (delta > 1e-6) return "over";
  if (delta < -1e-6) return "under";
  return "even";
}

function renderSummary() {
  const selected = readStatuses();
  const cards = [
    ["diot", "DIOT", "Past the threshold"],
    ["at", "At", "Less than 1 day before"],
    ["approaching", "Approaching", "1–2 days before"],
  ];
  const overage = diotOverageText(view.status.diot.units, inventoryThreshold());
  kpis.replaceChildren();
  for (const [id, label, detail] of cards) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "inv-kpi " + id + (id === "diot" ? " " + diotTone(view.status[id].units) : "");
    card.setAttribute("aria-pressed", selected.size === 1 && selected.has(id) ? "true" : "false");
    const strong = document.createElement("b");
    strong.textContent = formatQty(view.status[id].units);
    const caption = document.createElement("span");
    caption.textContent = label + " units · " + detail;
    card.appendChild(strong);
    card.appendChild(caption);
    if (id === "diot") {
      const note = document.createElement("small");
      note.textContent = overage;
      card.appendChild(note);
    }
    card.addEventListener("click", () => setOnlyStatus(id));
    kpis.appendChild(card);
  }
  const filterNote = document.getElementById("diot-overage");
  if (filterNote) filterNote.textContent = overage;
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
  pruneSelection();
  renderAssignControls();
  renderResponderDashboard();
  if (typeMode) {
    note.textContent = containerType
      ? "Filtered to " + containerType + ". Click it again to show every type. Checked rows assign only what this view includes."
      : "Grouped by the letters before the first number. tsX27482942 is tsX, and tsTDST34394839 is tsTDST. Checked rows assign only what this view includes.";
    renderPlaceRows("type", view.containerTypes || [], "Container type", "No container types in this view.", (item) => toggleContainerType(item.name));
    renderGroupEditor();
    return;
  }
  note.textContent = "Containers and units for the threshold states that are checked. Checked rows assign only what this view includes. Click a name to filter to it.";
  renderPlaceRows("location", view.locations, "Outer location", "No outer locations in this view.", (item) => isolate("Outer Location", item.id));
}

function placeKey(kind, name) {
  return kind + "\t" + (name || "(blank)");
}

function renderPlaceRows(kind, rows, nameHeader, emptyText, onOpen) {
  rows = rows || [];
  const head = document.getElementById("location-head");
  const body = document.getElementById("location-body");
  head.replaceChildren();
  const headRow = document.createElement("tr");
  const selectHead = document.createElement("th");
  selectHead.className = "inv-pick";
  const selectAll = document.createElement("input");
  selectAll.type = "checkbox";
  selectAll.title = "Select visible rows";
  const visibleKeys = rows.map((item) => placeKey(kind, item.name));
  const selectedVisible = visibleKeys.filter((key) => selectedPlaces.has(key)).length;
  selectAll.checked = rows.length > 0 && selectedVisible === rows.length;
  selectAll.indeterminate = selectedVisible > 0 && selectedVisible < rows.length;
  selectAll.addEventListener("change", () => {
    for (const key of visibleKeys) {
      if (selectAll.checked) selectedPlaces.add(key);
      else selectedPlaces.delete(key);
    }
    renderPlace();
  });
  selectHead.appendChild(selectAll);
  headRow.appendChild(selectHead);
  appendHeader(headRow, nameHeader, false);
  appendHeader(headRow, "Containers", true);
  appendHeader(headRow, "Units", true);
  appendHeader(headRow, "IOL Responder", false);
  head.appendChild(headRow);
  body.replaceChildren();
  if (!rows.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.className = "inv-empty";
    cell.textContent = emptyText;
    row.appendChild(cell);
    body.appendChild(row);
    return;
  }
  for (const item of rows) {
    const label = item.name || "(blank)";
    const key = placeKey(kind, item.name);
    const row = document.createElement("tr");
    if (selectedPlaces.has(key)) row.className = "inv-picked";
    const pickCell = document.createElement("td");
    pickCell.className = "inv-pick";
    const pick = document.createElement("input");
    pick.type = "checkbox";
    pick.checked = selectedPlaces.has(key);
    pick.setAttribute("aria-label", "Select " + label);
    pick.addEventListener("change", () => {
      if (pick.checked) selectedPlaces.add(key);
      else selectedPlaces.delete(key);
      row.classList.toggle("inv-picked", pick.checked);
      renderAssignControls();
      const boxes = body.querySelectorAll("input[type=checkbox]");
      const checked = Array.from(boxes).filter((box) => box.checked).length;
      selectAll.checked = checked === boxes.length;
      selectAll.indeterminate = checked > 0 && checked < boxes.length;
    });
    pickCell.appendChild(pick);
    row.appendChild(pickCell);
    const nameCell = document.createElement("td");
    const nameButton = document.createElement("button");
    nameButton.type = "button";
    nameButton.className = "inv-loc-name";
    nameButton.textContent = label;
    if (kind === "type") nameButton.setAttribute("aria-pressed", containerType === item.name ? "true" : "false");
    nameButton.addEventListener("click", () => onOpen(item));
    nameCell.appendChild(nameButton);
    row.appendChild(nameCell);
    appendCount(row, formatInt(item.containers), () => onOpen(item));
    appendCount(row, formatQty(item.units), () => onOpen(item));
    const person = document.createElement("td");
    person.className = "inv-responder";
    person.textContent = respondersForPlace(kind, item.name);
    row.appendChild(person);
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
    cell.colSpan = 9;
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

function assignmentRecord(value) {
  if (value && typeof value === "object") return value;
  return { responder: value || "", scope: null };
}

function placeStoreKey(kind, name, scope) {
  const base = placeKey(kind, name);
  return scope ? base + "\t" + JSON.stringify(scope) : base;
}

function scopeFromFilter(filter) {
  if (!filter || !filtersActive(filter)) return null;
  const allow = {};
  for (const [column, ids] of Object.entries(filter.allow || {})) {
    const col = dataset && dataset.byName[column];
    if (!col || !ids) continue;
    const names = [];
    ids.forEach((id) => {
      const label = col.dict[id];
      if (label) names.push(label);
    });
    names.sort((a, b) => a.localeCompare(b));
    if (names.length) allow[column] = names;
  }
  return {
    asin: String(filter.asin || "").trim(),
    bin: String(filter.bin || "").trim(),
    ageMin: filter.ageMin == null ? "" : String(filter.ageMin),
    ageMax: filter.ageMax == null ? "" : String(filter.ageMax),
    qtyMin: filter.qtyMin == null ? "" : String(filter.qtyMin),
    statuses: [...(filter.statuses || [])].sort(),
    containerType: filter.containerType || "",
    allow,
  };
}

function filterForQuery(scope) {
  const allow = {};
  for (const [column, names] of Object.entries(scope.allow || {})) {
    const col = dataset.byName[column];
    const wanted = new Set(names);
    const ids = new Set();
    if (col) {
      for (let id = 0; id < col.dict.length; id++) {
        if (wanted.has(col.dict[id])) ids.add(id);
      }
    }
    allow[column] = ids;
  }
  return {
    asin: scope.asin || "",
    bin: scope.bin || "",
    ageMin: scope.ageMin || "",
    ageMax: scope.ageMax || "",
    qtyMin: scope.qtyMin || "",
    statuses: new Set(scope.statuses || []),
    containerType: scope.containerType || "",
    groupings,
    allow,
  };
}

function scopeLabel(scope) {
  if (!scope) return "";
  const parts = [];
  for (const names of Object.values(scope.allow || {})) {
    if (names && names.length) parts.push(names.join(", "));
  }
  if (scope.containerType) parts.push(scope.containerType);
  if (scope.asin) parts.push("ASIN " + scope.asin);
  if (scope.bin) parts.push("Bin " + scope.bin);
  if (scope.ageMin !== "" || scope.ageMax !== "") parts.push("age " + (scope.ageMin || "…") + "–" + (scope.ageMax || "…"));
  if (scope.qtyMin !== "") parts.push("qty ≥ " + scope.qtyMin);
  const statuses = scope.statuses || [];
  const defaultHot = statuses.length === 3 && statuses.includes("approaching") && statuses.includes("at") && statuses.includes("diot");
  if (!defaultHot && statuses.length) parts.push(statuses.map((status) => STATUS_LABEL[status] || status).join(", "));
  return parts.join(" · ");
}

function visiblePlaceKeys() {
  const keys = new Set();
  if (!view) return keys;
  for (const item of view.locations || []) keys.add(placeKey("location", item.name));
  for (const item of view.containerTypes || []) keys.add(placeKey("type", item.name));
  return keys;
}

function pruneSelection() {
  if (!view) return;
  const visible = visiblePlaceKeys();
  for (const key of [...selectedPlaces]) {
    if (!visible.has(key)) selectedPlaces.delete(key);
  }
}

function respondersForPlace(kind, name) {
  const found = new Set();
  const prefix = placeKey(kind, name);
  for (const [key, value] of assignments) {
    if (key !== prefix && !key.startsWith(prefix + "\t")) continue;
    const responder = assignmentRecord(value).responder;
    if (responder) found.add(responder);
  }
  return [...found].sort((a, b) => a.localeCompare(b)).join(", ");
}

function assignmentPlaces() {
  const places = [];
  const filters = new Map();
  for (const [, value] of assignments) {
    const record = assignmentRecord(value);
    if (!record.responder || !record.name) continue;
    let scope = null;
    let scopeKey = "";
    if (record.scope) {
      scopeKey = JSON.stringify(record.scope);
      if (!filters.has(scopeKey)) filters.set(scopeKey, filterForQuery(record.scope));
      scope = filters.get(scopeKey);
    }
    places.push({ kind: record.kind, name: record.name, responder: record.responder, scope, scopeKey });
  }
  return places;
}

async function exportAssignments(button) {
  if (!dataset || !assignments.size) {
    exportStatus.textContent = "Assign at least one row to an IOL Responder first.";
    document.getElementById("responder-note").textContent = "Assign at least one row to an IOL Responder first.";
    return;
  }
  const filename = "assignments.xlsx";
  let writable = null;
  if (typeof window.showSaveFilePicker === "function") {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "Excel workbook", accept: { "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"] } }],
      });
      writable = await handle.createWritable();
    } catch (error) {
      if (error && error.name === "AbortError") {
        exportStatus.textContent = "Download canceled.";
        return;
      }
    }
  }
  if (button) button.disabled = true;
  exportStatus.textContent = "Building " + filename + "…";
  await new Promise((resolve) => setTimeout(resolve, 0));
  try {
    const pack = assignmentPackage(dataset, assignmentPlaces(), groupings);
    const bytes = assignmentWorkbook(pack, inventoryThreshold());
    if (writable) {
      await writable.write(bytes);
      await writable.close();
    } else {
      downloadBytes(filename, bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    }
    const people = pack.responders.length;
    exportStatus.textContent = "Saved " + filename + " (" + formatInt(people) + (people === 1 ? " responder" : " responders") + "). Unit counts are from the full inventory file.";
    document.getElementById("responder-note").textContent = "Saved " + filename + ".";
  } catch (error) {
    if (writable) {
      try { await writable.abort(); } catch (abortError) { /* already closed */ }
    }
    exportStatus.textContent = error && error.message ? error.message : String(error);
  } finally {
    if (button) button.disabled = false;
  }
}

function downloadBytes(filename, bytes, type) {
  const blob = new Blob([bytes], { type });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1500);
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

let assignmentPack = null;
let assignmentPackKey = "";
let assignmentPackDataset = null;

function responderPack() {
  if (!dataset) return null;
  const places = assignmentPlaces();
  const key = JSON.stringify(places) + "\n" + JSON.stringify(groupings);
  if (dataset !== assignmentPackDataset || key !== assignmentPackKey) {
    assignmentPack = places.length ? assignmentPackage(dataset, places, groupings) : { responders: [] };
    assignmentPackKey = key;
    assignmentPackDataset = dataset;
  }
  return assignmentPack;
}

function placesFor(responder) {
  const locations = [];
  const types = [];
  for (const [, value] of assignments) {
    const record = assignmentRecord(value);
    if (record.responder !== responder || !record.name) continue;
    if (record.kind === "type") types.push({ name: record.name, scope: scopeLabel(record.scope) });
    else {
      const label = scopeLabel(record.scope);
      locations.push(label ? record.name + " (" + label + ")" : record.name);
    }
  }
  locations.sort((a, b) => a.localeCompare(b));
  types.sort((a, b) => a.name.localeCompare(b.name) || a.scope.localeCompare(b.scope));
  return { locations, types };
}

function typeCountRows(types, stats) {
  const containers = stats && stats.containers ? stats.containers : [];
  const seen = new Set();
  const rows = [];
  for (const type of types) {
    if (seen.has(type.name)) continue;
    seen.add(type.name);
    let units = 0;
    let count = 0;
    for (const row of containers) {
      if ((row.typeName || row.type) !== type.name) continue;
      units += row.quantity;
      count += 1;
    }
    rows.push({ name: type.name, scope: type.scope, units, containers: count });
  }
  return rows;
}

function assignedTypeTable(types, stats) {
  const table = document.createElement("table");
  table.className = "inv-dash-types";
  const head = document.createElement("thead");
  const headRow = document.createElement("tr");
  for (const [label, numeric] of [["Container type", false], ["Units", true], ["Containers", true]]) {
    const cell = document.createElement("th");
    if (numeric) cell.className = "num";
    cell.textContent = label;
    headRow.appendChild(cell);
  }
  head.appendChild(headRow);
  table.appendChild(head);
  const body = document.createElement("tbody");
  for (const row of typeCountRows(types, stats)) {
    const line = document.createElement("tr");
    const name = document.createElement("td");
    name.textContent = row.name;
    if (row.scope) {
      const scope = document.createElement("small");
      scope.textContent = row.scope;
      name.appendChild(scope);
    }
    const units = document.createElement("td");
    units.className = "num";
    units.textContent = formatQty(row.units);
    const count = document.createElement("td");
    count.className = "num";
    count.textContent = formatInt(row.containers);
    line.append(name, units, count);
    body.appendChild(line);
  }
  table.appendChild(body);
  return table;
}

function assignedLine(label, names) {
  const line = document.createElement("p");
  line.className = "inv-dash-assigned";
  line.append(label + " ");
  const strong = document.createElement("b");
  strong.textContent = names.length ? names.join(", ") : "None";
  line.appendChild(strong);
  return line;
}

function dashMetric(className, value, label, note) {
  const wrap = document.createElement("div");
  wrap.className = className;
  const strong = document.createElement("b");
  strong.textContent = value;
  const span = document.createElement("span");
  span.textContent = label;
  wrap.append(strong, span);
  if (note) {
    const small = document.createElement("small");
    small.textContent = note;
    wrap.appendChild(small);
  }
  return wrap;
}

function renderResponderDashboard() {
  const body = document.getElementById("responder-dashboard-body");
  if (!body) return;
  body.replaceChildren();
  if (!responders.length) {
    const empty = document.createElement("p");
    empty.className = "inv-file-meta";
    empty.textContent = "Add an IOL Responder, then assign rows.";
    body.appendChild(empty);
    return;
  }
  const pack = responderPack();
  const byName = new Map();
  if (pack) {
    for (const person of pack.responders) byName.set(person.name, person);
  }
  const grid = document.createElement("div");
  grid.className = "inv-dash-grid";
  for (const name of responders) {
    const places = placesFor(name);
    const assigned = places.locations.length + places.types.length;
    const stats = byName.get(name);
    const card = document.createElement("article");
    card.className = "inv-dash-card";
    const title = document.createElement("h3");
    title.textContent = name;
    card.appendChild(title);
    if (!assigned) {
      const none = document.createElement("p");
      none.className = "inv-dash-assigned";
      none.textContent = "Nothing assigned yet.";
      card.appendChild(none);
    } else {
      card.appendChild(assignedLine("Outer locations", places.locations));
      if (places.types.length) card.appendChild(assignedTypeTable(places.types, stats));
      else card.appendChild(assignedLine("Container types", []));
    }
    const total = document.createElement("p");
    total.className = "inv-dash-total";
    if (!dataset) {
      total.textContent = "Totals appear after the inventory file loads.";
    } else {
      const containers = stats ? stats.uniqueContainers : 0;
      const quantity = stats ? stats.quantity : 0;
      total.textContent = formatInt(containers) + (containers === 1 ? " container" : " containers") + " · " + formatQty(quantity) + " units";
    }
    card.appendChild(total);
    const metrics = document.createElement("div");
    metrics.className = "inv-dash-metrics";
    const showCounts = Boolean(dataset && assigned);
    metrics.appendChild(dashMetric(showCounts ? "approaching" : "empty", showCounts ? formatQty(stats ? stats.approachingUnits : 0) : "—", "Approaching"));
    metrics.appendChild(dashMetric(showCounts ? "at" : "empty", showCounts ? formatQty(stats ? stats.atUnits : 0) : "—", "At"));
    const diotUnits = stats ? stats.diotUnits : 0;
    metrics.appendChild(dashMetric(showCounts ? "diot " + diotTone(diotUnits) : "empty", showCounts ? formatQty(diotUnits) : "—", "DIOT"));
    card.appendChild(metrics);
    grid.appendChild(card);
  }
  body.appendChild(grid);
}

function renderAssignControls() {
  const count = document.getElementById("assign-count");
  const selected = selectedPlaces.size;
  count.textContent = selected
    ? selected + " selected"
    : "Select rows to assign them.";
  const select = document.getElementById("assign-responder");
  const current = select.value;
  select.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = responders.length ? "Choose a responder" : "Add a responder first";
  select.appendChild(blank);
  for (const name of responders) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    select.appendChild(option);
  }
  if (responders.includes(current)) select.value = current;
}

function renderResponders() {
  const list = document.getElementById("responder-list");
  list.replaceChildren();
  for (const name of responders) {
    const item = document.createElement("li");
    const label = document.createElement("b");
    label.textContent = name;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "btn btn-outline btn-sm";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => removeResponder(name));
    item.appendChild(label);
    item.appendChild(remove);
    list.appendChild(item);
  }
  renderAssignControls();
  renderResponderDashboard();
}

function addResponder() {
  const input = document.getElementById("responder-name");
  const note = document.getElementById("responder-note");
  const name = input.value.replace(/[\u0000-\u001f]/g, "").trim();
  if (!name) {
    note.textContent = "Enter the responder's name.";
    return;
  }
  if (responders.some((item) => item.toLowerCase() === name.toLowerCase())) {
    note.textContent = name + " is already an IOL Responder.";
    return;
  }
  responders.push(name);
  responders.sort((a, b) => a.localeCompare(b));
  input.value = "";
  storeResponders();
  note.textContent = "Saved in this browser.";
  renderResponders();
  document.getElementById("assign-responder").value = name;
}

function removeResponder(name) {
  responders = responders.filter((item) => item !== name);
  for (const [key, value] of assignments) {
    if (assignmentRecord(value).responder === name) assignments.delete(key);
  }
  storeResponders();
  storeAssignments();
  document.getElementById("responder-note").textContent = "Saved in this browser.";
  renderResponders();
  if (view) renderPlace();
}

function assignSelected() {
  const note = document.getElementById("responder-note");
  const responder = document.getElementById("assign-responder").value;
  if (!responder) {
    note.textContent = "Add an IOL Responder, then choose them here.";
    return;
  }
  pruneSelection();
  if (!selectedPlaces.size) {
    note.textContent = "Select one or more rows first.";
    return;
  }
  const scope = scopeFromFilter(readFilter());
  const count = selectedPlaces.size;
  for (const key of selectedPlaces) {
    const split = key.indexOf("\t");
    assignments.set(placeStoreKey(key.slice(0, split), key.slice(split + 1), scope), {
      kind: key.slice(0, split),
      name: key.slice(split + 1),
      responder,
      scope,
    });
  }
  selectedPlaces.clear();
  storeAssignments();
  note.textContent = "Assigned " + count + " to " + responder + (scope ? " from the rows in this view." : ".");
  if (view) renderPlace();
}

function clearSelectedAssignments() {
  const note = document.getElementById("responder-note");
  pruneSelection();
  if (!selectedPlaces.size) {
    note.textContent = "Select the rows whose assignment you want to clear.";
    return;
  }
  for (const key of selectedPlaces) {
    assignments.delete(key);
    for (const stored of [...assignments.keys()]) {
      if (stored.startsWith(key + "\t")) assignments.delete(stored);
    }
  }
  storeAssignments();
  note.textContent = "Cleared the assignment on the selected rows.";
  if (view) renderPlace();
}

function storeResponders() {
  localStorage.setItem(RESPONDER_KEY, JSON.stringify(responders));
}

function storeAssignments() {
  const rows = [];
  for (const [, value] of assignments) {
    const record = assignmentRecord(value);
    if (!record.responder || !record.name) continue;
    rows.push({ kind: record.kind, name: record.name, responder: record.responder, scope: record.scope || null });
  }
  localStorage.setItem(ASSIGNMENT_KEY, JSON.stringify(rows));
}

function loadStoredAssignments() {
  try {
    const stored = JSON.parse(localStorage.getItem(ASSIGNMENT_KEY) || "[]");
    if (!Array.isArray(stored)) return;
    for (const row of stored) {
      const name = String((row && row.name) || "").trim();
      const responder = String((row && row.responder) || "").trim();
      const kind = row && row.kind === "type" ? "type" : "location";
      if (!name || !responder) continue;
      const scope = row && row.scope && typeof row.scope === "object" ? row.scope : null;
      assignments.set(placeStoreKey(kind, name, scope), { kind, name, responder, scope });
    }
  } catch (error) {
    assignments.clear();
  }
}

async function saveRespondersToSite() {
  const note = document.getElementById("responder-note");
  const token = (tokenInput.value || readToken()).trim();
  if (!token) {
    note.textContent = "Paste a GitHub token in Saved copy, then save. The responders are already kept in this browser.";
    return;
  }
  writeToken(token);
  note.textContent = "Saving responders…";
  try {
    const result = await saveDataFile(
      "responders.json",
      JSON.stringify(responders, null, 2) + "\n",
      token,
      "Save IOL responders"
    );
    note.textContent = result.direct
      ? "Saved. Other machines see these responders after GitHub Pages deploys, usually within a few minutes."
      : "Main is protected, so the responders are on branch inventory-saved." + (result.prUrl ? " Merge " + result.prUrl + "." : "");
  } catch (error) {
    note.textContent = error && error.message ? error.message : String(error);
  }
}

async function loadResponders() {
  loadStoredAssignments();
  try {
    const stored = localStorage.getItem(RESPONDER_KEY);
    if (stored != null) {
      const parsed = JSON.parse(stored);
      responders = Array.isArray(parsed) ? parsed.map((name) => String(name || "").trim()).filter(Boolean) : [];
      renderResponders();
      return;
    }
  } catch (error) {
    responders = [];
  }
  try {
    const response = await fetch(new URL("data/responders.json", import.meta.url), { cache: "no-store" });
    if (!response.ok) {
      renderResponders();
      return;
    }
    const parsed = await response.json();
    responders = Array.isArray(parsed) ? parsed.map((name) => String(name || "").trim()).filter(Boolean) : [];
  } catch (error) {
    responders = [];
  }
  renderResponders();
}

const groupingsReady = loadGroupings();
const respondersReady = loadResponders();

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
