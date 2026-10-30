// Publish the inventory CSV into this public repository so every machine
// loads the same file. The token stays in localStorage and is never written
// into the repo.

export const TOKEN_KEY = "inventory.githubToken";
export const REPO = "rigoabell/abelrigm_repository";
export const DATA_DIR = "docs/inventory/data";
export const PART_BYTES = 40 * 1024 * 1024;
export const MAX_BYTES = 90 * 1024 * 1024;
export const PART_NAME = /^(latest\.csv|part-\d{3})$/;

const API = "https://api.github.com/repos/" + REPO;

export function planParts(size) {
  if (!Number.isFinite(size) || size < 0) throw new Error("That file has no readable size.");
  if (size > MAX_BYTES) {
    throw new Error("That file is over 90 MB. GitHub cannot store a larger inventory file this way.");
  }
  if (size <= PART_BYTES) return ["latest.csv"];
  const count = Math.ceil(size / PART_BYTES);
  const names = [];
  for (let i = 0; i < count; i++) names.push("part-" + String(i).padStart(3, "0"));
  return names;
}

export function partSlices(size) {
  const names = planParts(size);
  if (names.length === 1) return [{ name: names[0], start: 0, end: size }];
  const slices = [];
  let start = 0;
  for (let i = 0; i < names.length; i++) {
    const end = i === names.length - 1 ? size : start + PART_BYTES;
    slices.push({ name: names[i], start, end });
    start = end;
  }
  return slices;
}

export function bytesToBase64(bytes) {
  const parts = [];
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, Math.min(bytes.length, i + chunk));
    parts.push(String.fromCharCode.apply(null, slice));
  }
  return btoa(parts.join(""));
}

export function safeFileName(name) {
  const base = String(name || "inventory.csv").split(/[/\\]/).pop();
  const cleaned = base.replace(/[\u0000-\u001f]/g, "").trim();
  return cleaned || "inventory.csv";
}

export function buildTreeEntries(partNames, partShas, manifestSha, existingNames) {
  const keep = new Set(partNames.concat("manifest.json"));
  const entries = partNames.map((name, index) => ({
    path: DATA_DIR + "/" + name,
    mode: "100644",
    type: "blob",
    sha: partShas[index],
  }));
  entries.push({
    path: DATA_DIR + "/manifest.json",
    mode: "100644",
    type: "blob",
    sha: manifestSha,
  });
  for (const name of existingNames || []) {
    if (keep.has(name) || !PART_NAME.test(name)) continue;
    entries.push({
      path: DATA_DIR + "/" + name,
      mode: "100644",
      type: "blob",
      sha: null,
    });
  }
  return entries;
}

// How a failed update of refs/heads/main should be handled.
export function refUpdateFailure(status, message) {
  const text = String(message || "");
  if (status === 401 || /bad credentials/i.test(text)) return "token";
  if (status >= 500) return "error";
  if (/not a fast forward/i.test(text)) return "retry-forward";
  if (status === 403 || status === 409 || status === 422) return "branch";
  return "error";
}

export function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch (error) {
    return "";
  }
}

export function writeToken(token) {
  localStorage.setItem(TOKEN_KEY, String(token || "").trim());
}

export function forgetToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function loadSavedFile() {
  const manifestUrl = new URL("data/manifest.json", import.meta.url);
  const response = await fetch(manifestUrl, { cache: "no-store" });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("The saved inventory list could not be read (" + response.status + ").");
  const manifest = await response.json();
  if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error("The saved inventory list is empty.");
  }
  const buffers = [];
  let total = 0;
  for (const name of manifest.parts) {
    if (!PART_NAME.test(name)) throw new Error("Unexpected saved part name.");
    const partUrl = new URL("data/" + name, import.meta.url);
    const part = await fetch(partUrl, { cache: "no-store" });
    if (!part.ok) throw new Error("Saved part missing: " + name + ".");
    const buffer = await part.arrayBuffer();
    buffers.push(buffer);
    total += buffer.byteLength;
  }
  if (Number(manifest.bytes) !== total) {
    throw new Error("The saved inventory file is incomplete.");
  }
  const file = new File(buffers, safeFileName(manifest.fileName), {
    type: "text/csv",
    lastModified: Date.parse(manifest.savedAt) || Date.now(),
  });
  return { file, manifest };
}

export async function saveInventoryFile(file, token, onProgress) {
  const progress = typeof onProgress === "function" ? onProgress : function () {};
  const auth = String(token || "").trim();
  if (!auth) throw new Error("Paste a GitHub token with Contents access to this repository, then save.");
  if (file.size > MAX_BYTES) {
    throw new Error("That file is over 90 MB. GitHub cannot store a larger inventory file this way.");
  }
  progress("Reading the file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const slices = partSlices(bytes.length);
  const partShas = [];
  for (const slice of slices) {
    progress("Encoding " + slice.name);
    const sha = await createBlob(auth, bytesToBase64(bytes.subarray(slice.start, slice.end)));
    partShas.push(sha);
  }
  const manifest = {
    fileName: safeFileName(file.name),
    bytes: bytes.length,
    savedAt: new Date().toISOString(),
    parts: slices.map((slice) => slice.name),
  };
  progress("Writing the file list");
  const manifestSha = await createBlob(
    auth,
    bytesToBase64(new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n"))
  );
  const existing = await listDataFiles(auth);
  const treeEntries = buildTreeEntries(manifest.parts, partShas, manifestSha, existing);

  async function commitOnMain() {
    const ref = await github(auth, "GET", "/git/ref/heads/main");
    const parent = ref.object && ref.object.sha;
    if (!parent) throw new Error("GitHub did not return the main branch.");
    const current = await github(auth, "GET", "/git/commits/" + parent);
    const tree = await github(auth, "POST", "/git/trees", {
      base_tree: current.tree.sha,
      tree: treeEntries,
    });
    const commit = await github(auth, "POST", "/git/commits", {
      message: "Save inventory file " + manifest.fileName,
      tree: tree.sha,
      parents: [parent],
    });
    return { parent, sha: commit.sha };
  }

  progress("Saving to the repository");
  let committed = await commitOnMain();
  let update = await updateRef(auth, "heads/main", committed.sha, false);
  if (!update.ok && refUpdateFailure(update.status, update.message) === "retry-forward") {
    progress("Main moved. Saving again.");
    committed = await commitOnMain();
    update = await updateRef(auth, "heads/main", committed.sha, false);
  }
  if (update.ok) return { branch: "main", manifest, prUrl: null, direct: true };

  const failure = refUpdateFailure(update.status, update.message);
  if (failure === "token") {
    throw new Error("GitHub rejected the token. Create a fine-grained token for this repository with Contents read and write.");
  }
  if (failure !== "branch") {
    throw new Error(update.message || "GitHub could not update main.");
  }

  progress("Main is protected. Opening a branch.");
  await pointBranch(auth, "inventory-saved", committed.sha);
  let prUrl = null;
  try {
    prUrl = await ensurePullRequest(auth, manifest.fileName);
  } catch (error) {
    prUrl = null;
  }
  return { branch: "inventory-saved", manifest, prUrl, direct: false };
}

export async function saveDataFile(name, text, token, message) {
  if (!/^[A-Za-z0-9._-]+$/.test(name)) throw new Error("Unexpected file name.");
  const auth = String(token || "").trim();
  if (!auth) throw new Error("Paste a GitHub token with Contents access to this repository, then save.");
  const content = bytesToBase64(new TextEncoder().encode(text));
  const fileSha = await createBlob(auth, content);
  const treeEntries = [
    {
      path: DATA_DIR + "/" + name,
      mode: "100644",
      type: "blob",
      sha: fileSha,
    },
  ];

  async function commitOnMain() {
    const ref = await github(auth, "GET", "/git/ref/heads/main");
    const parent = ref.object && ref.object.sha;
    if (!parent) throw new Error("GitHub did not return the main branch.");
    const current = await github(auth, "GET", "/git/commits/" + parent);
    const tree = await github(auth, "POST", "/git/trees", { base_tree: current.tree.sha, tree: treeEntries });
    const commit = await github(auth, "POST", "/git/commits", {
      message: message || "Save " + name,
      tree: tree.sha,
      parents: [parent],
    });
    return commit.sha;
  }

  let sha = await commitOnMain();
  let update = await updateRef(auth, "heads/main", sha, false);
  if (!update.ok && refUpdateFailure(update.status, update.message) === "retry-forward") {
    sha = await commitOnMain();
    update = await updateRef(auth, "heads/main", sha, false);
  }
  if (update.ok) return { branch: "main", prUrl: null, direct: true };
  const failure = refUpdateFailure(update.status, update.message);
  if (failure === "token") {
    throw new Error("GitHub rejected the token. Create a fine-grained token for this repository with Contents read and write.");
  }
  if (failure !== "branch") throw new Error(update.message || "GitHub could not update main.");
  await pointBranch(auth, "inventory-saved", sha);
  let prUrl = null;
  try {
    prUrl = await ensurePullRequest(auth, name);
  } catch (error) {
    prUrl = null;
  }
  return { branch: "inventory-saved", prUrl, direct: false };
}

async function createBlob(token, content) {
  const data = await github(token, "POST", "/git/blobs", { content, encoding: "base64" });
  if (!data.sha) throw new Error("GitHub did not return a file id.");
  return data.sha;
}

async function listDataFiles(token) {
  const response = await fetch(API + "/contents/" + DATA_DIR, { headers: headers(token) });
  if (response.status === 404) return [];
  const data = await readBody(response);
  if (!response.ok) throw githubError(response.status, data);
  const entries = Array.isArray(data) ? data : [data];
  return entries.filter((entry) => entry && entry.type === "file").map((entry) => entry.name);
}

async function updateRef(token, ref, sha, force) {
  const response = await fetch(API + "/git/refs/" + ref, {
    method: "PATCH",
    headers: headers(token, true),
    body: JSON.stringify({ sha, force }),
  });
  const data = await readBody(response);
  return { ok: response.ok, status: response.status, message: data && data.message ? data.message : "" };
}

async function pointBranch(token, branch, sha) {
  const updated = await updateRef(token, "heads/" + branch, sha, true);
  if (updated.ok) return;
  if (updated.status !== 404) throw new Error(updated.message || "GitHub could not update the save branch.");
  await github(token, "POST", "/git/refs", { ref: "refs/heads/" + branch, sha });
}

async function ensurePullRequest(token, fileName) {
  const head = "rigoabell:" + "inventory-saved";
  const listed = await github(
    token,
    "GET",
    "/pulls?head=" + encodeURIComponent(head) + "&base=main&state=open"
  );
  if (Array.isArray(listed) && listed[0] && listed[0].html_url) return listed[0].html_url;
  const created = await github(token, "POST", "/pulls", {
    title: "Save inventory file " + fileName,
    head: "inventory-saved",
    base: "main",
    body: "Replace the public inventory file with " + fileName + ".",
  });
  return created.html_url || null;
}

async function github(token, method, path, body) {
  const response = await fetch(API + path, {
    method,
    headers: headers(token, body !== undefined),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await readBody(response);
  if (!response.ok) throw githubError(response.status, data);
  return data;
}

function headers(token, json) {
  const result = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (json) result["Content-Type"] = "application/json";
  return result;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 300) };
  }
}

function githubError(status, data) {
  if (status === 401) {
    return new Error("GitHub rejected the token. Create a fine-grained token for this repository with Contents read and write.");
  }
  const message = data && data.message ? data.message : "GitHub request failed (" + status + ").";
  return new Error(message);
}
