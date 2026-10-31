import {
  DATA_DIR,
  PART_NAME,
  buildTreeEntries,
  bytesToBase64,
  inventoryManifest,
  refUpdateFailure,
} from "../docs/inventory/github-save.js";

const MAX_BYTES = 90 * 1024 * 1024;

export function validateCommitRequest(body) {
  if (!body || !Array.isArray(body.parts) || body.parts.length === 0) {
    throw new Error("The upload did not include the file.");
  }
  if (!Number.isFinite(Number(body.bytes)) || Number(body.bytes) < 0 || Number(body.bytes) > MAX_BYTES) {
    throw new Error("That file is over 90 MB.");
  }
  const seen = new Set();
  const parts = [];
  for (const part of body.parts) {
    const name = part && part.name;
    const sha = part && part.sha;
    if (!PART_NAME.test(name || "") || !/^[a-f0-9]{40}$/.test(sha || "") || seen.has(name)) {
      throw new Error("Unexpected saved part.");
    }
    seen.add(name);
    parts.push({ name, sha });
  }
  const epoch = body.assignmentEpoch ? String(body.assignmentEpoch) : "";
  if (epoch.length > 80) throw new Error("Unexpected assignment id.");
  return {
    fileName: body.fileName,
    bytes: Number(body.bytes),
    assignmentEpoch: epoch,
    parts,
  };
}

export async function publishInventory(call, request) {
  const spec = validateCommitRequest(request);
  const manifest = inventoryManifest(
    spec.fileName,
    spec.bytes,
    spec.parts.map((part) => part.name),
    new Date().toISOString(),
    spec.assignmentEpoch
  );
  const manifestBlob = must(
    await call("POST", "/git/blobs", {
      content: bytesToBase64(new TextEncoder().encode(JSON.stringify(manifest, null, 2) + "\n")),
      encoding: "base64",
    })
  );
  const listed = await call("GET", "/contents/" + DATA_DIR);
  const existing = listed.status === 404 ? [] : names(must(listed));
  const treeEntries = buildTreeEntries(
    manifest.parts,
    spec.parts.map((part) => part.sha),
    manifestBlob.sha,
    existing
  );

  async function commitOnMain() {
    const ref = must(await call("GET", "/git/ref/heads/main"));
    const parent = ref.object && ref.object.sha;
    if (!parent) throw new Error("GitHub did not return the main branch.");
    const current = must(await call("GET", "/git/commits/" + parent));
    const tree = must(
      await call("POST", "/git/trees", {
        base_tree: current.tree.sha,
        tree: treeEntries,
      })
    );
    const commit = must(
      await call("POST", "/git/commits", {
        message: "Replace inventory file " + manifest.fileName,
        tree: tree.sha,
        parents: [parent],
      })
    );
    return commit.sha;
  }

  let commitSha = await commitOnMain();
  let update = await call("PATCH", "/git/refs/heads/main", { sha: commitSha, force: false });
  if (!update.ok && refUpdateFailure(update.status, update.message) === "retry-forward") {
    commitSha = await commitOnMain();
    update = await call("PATCH", "/git/refs/heads/main", { sha: commitSha, force: false });
  }
  if (!update.ok) {
    const failure = refUpdateFailure(update.status, update.message);
    if (failure === "token") throw new Error("The shared save was rejected by GitHub.");
    if (failure === "branch") throw new Error("Main is protected, so the shared file could not be published.");
    throw new Error(update.message || "GitHub could not update the shared file.");
  }
  return { manifest, commitSha };
}

function must(result) {
  if (!result || !result.ok) throw new Error((result && result.message) || "GitHub could not update the shared file.");
  return result.data;
}

function names(data) {
  const entries = Array.isArray(data) ? data : [data];
  return entries.filter((entry) => entry && entry.type === "file").map((entry) => entry.name);
}
