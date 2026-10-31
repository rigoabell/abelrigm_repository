import { DATA_DIR, PART_NAME, REPO, bytesToBase64, partSlices, safeFileName } from "./github-save.js";

const API = "https://api.github.com/repos/" + REPO;
const RAW = "https://raw.githubusercontent.com/" + REPO;
const MAX_BYTES = 90 * 1024 * 1024;

export async function readUploadUrl() {
  const fromMain = await readRemote(RAW + "/main/docs/inventory/remote.json");
  if (fromMain) return fromMain;
  return readRemote(new URL("remote.json", import.meta.url));
}

async function readRemote(url) {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return "";
    const data = await response.json();
    return String((data && data.uploadUrl) || "").trim().replace(/\/$/, "");
  } catch (error) {
    return "";
  }
}

export async function loadSharedInventory() {
  const head = await fetch(API + "/commits/main", {
    headers: { Accept: "application/vnd.github+json" },
    cache: "no-store",
  });
  if (!head.ok) throw new Error("The shared inventory could not be found (" + head.status + ").");
  const commit = await head.json();
  const sha = commit && commit.sha;
  if (!sha) throw new Error("GitHub did not return the shared inventory.");
  const manifestResponse = await fetch(RAW + "/" + sha + "/" + DATA_DIR + "/manifest.json", { cache: "no-store" });
  if (!manifestResponse.ok) throw new Error("The shared inventory list could not be read.");
  const manifest = await manifestResponse.json();
  if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error("The shared inventory list is empty.");
  }
  const buffers = [];
  let total = 0;
  for (const name of manifest.parts) {
    if (!PART_NAME.test(name)) throw new Error("Unexpected saved part name.");
    const part = await fetch(RAW + "/" + sha + "/" + DATA_DIR + "/" + name, { cache: "no-store" });
    if (!part.ok) throw new Error("Shared part missing: " + name + ".");
    const buffer = await part.arrayBuffer();
    buffers.push(buffer);
    total += buffer.byteLength;
  }
  if (Number(manifest.bytes) !== total) throw new Error("The shared inventory file is incomplete.");
  const file = new File(buffers, safeFileName(manifest.fileName), {
    type: "text/csv",
    lastModified: Date.parse(manifest.savedAt) || Date.now(),
  });
  return { file, manifest, sha };
}

export async function uploadSharedFile(file, uploadUrl, epoch, onProgress) {
  const progress = typeof onProgress === "function" ? onProgress : function () {};
  const root = String(uploadUrl || "").trim().replace(/\/$/, "");
  if (!root) throw new Error("The shared save is not connected yet.");
  if (file.size > MAX_BYTES) throw new Error("That file is over 90 MB.");
  progress("Reading the file");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const slices = partSlices(bytes.length);
  const parts = [];
  for (const slice of slices) {
    progress("Uploading " + slice.name);
    const response = await fetch(root + "/blob", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: bytesToBase64(bytes.subarray(slice.start, slice.end)),
        encoding: "base64",
      }),
    });
    const data = await readBody(response);
    if (!response.ok || !data.sha) throw new Error((data && data.error) || "The shared file could not be uploaded.");
    parts.push({ name: slice.name, sha: data.sha });
  }
  progress("Publishing the shared file");
  const response = await fetch(root + "/commit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: file.name,
      bytes: bytes.length,
      assignmentEpoch: epoch,
      parts,
    }),
  });
  const data = await readBody(response);
  if (!response.ok) throw new Error((data && data.error) || "The shared file could not be published.");
  return data;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { error: text.slice(0, 300) };
  }
}
