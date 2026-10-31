import assert from "node:assert/strict";
import { publishInventory, validateCommitRequest } from "../worker/publish.js";
import { readUploadUrl, uploadSharedFile } from "../docs/inventory/shared-file.js";

const partSha = "a".repeat(40);
assert.throws(() => validateCommitRequest({ bytes: 1, parts: [{ name: "notes.txt", sha: partSha }] }), /Unexpected saved part/);
assert.throws(() => validateCommitRequest({ bytes: 90 * 1024 * 1024 + 1, parts: [{ name: "latest.csv", sha: partSha }] }), /90 MB/);

const calls = [];
const result = await publishInventory(async (method, path, body) => {
  calls.push({ method, path, body });
  if (path === "/git/blobs") return { ok: true, status: 201, data: { sha: "b".repeat(40) } };
  if (path.startsWith("/contents/")) {
    return {
      ok: true,
      status: 200,
      data: [
        { name: "latest.csv", type: "file" },
        { name: "part-000", type: "file" },
        { name: "manifest.json", type: "file" },
        { name: "groupings.json", type: "file" },
      ],
    };
  }
  if (path === "/git/ref/heads/main") return { ok: true, status: 200, data: { object: { sha: "parentsha" } } };
  if (path === "/git/commits/parentsha") return { ok: true, status: 200, data: { tree: { sha: "treesha" } } };
  if (path === "/git/trees") return { ok: true, status: 201, data: { sha: "newtree" } };
  if (method === "POST" && path === "/git/commits") return { ok: true, status: 201, data: { sha: "newcommit" } };
  if (method === "PATCH" && path === "/git/refs/heads/main") return { ok: true, status: 200, message: "", data: {} };
  return { ok: false, status: 404, message: "missing " + path, data: null };
}, {
  fileName: "fresh.csv",
  bytes: 12,
  assignmentEpoch: "epoch-1",
  parts: [{ name: "latest.csv", sha: partSha }],
});

assert.equal(result.commitSha, "newcommit");
assert.equal(result.manifest.fileName, "fresh.csv");
assert.equal(result.manifest.assignmentEpoch, "epoch-1");
assert.deepEqual(result.manifest.parts, ["latest.csv"]);
const tree = calls.find((call) => call.path === "/git/trees").body.tree;
assert.deepEqual(
  tree.map((entry) => [entry.path, entry.sha]),
  [
    ["docs/inventory/data/latest.csv", partSha],
    ["docs/inventory/data/manifest.json", "b".repeat(40)],
    ["docs/inventory/data/part-000", null],
  ]
);
assert.equal(calls.some((call) => call.path.includes("groupings.json")), false);
assert.equal(calls.find((call) => call.method === "POST" && call.path === "/git/commits").body.message, "Replace inventory file fresh.csv");

const uploaded = [];
globalThis.fetch = async (url, options) => {
  uploaded.push({ url: String(url), body: options && options.body });
  if (String(url).endsWith("/blob")) return new Response(JSON.stringify({ sha: partSha }), { status: 201 });
  return new Response(JSON.stringify({ manifest: { fileName: "drop.csv", assignmentEpoch: "epoch-9", parts: ["latest.csv"], bytes: 4 }, commitSha: "abc" }), { status: 200 });
};
const file = new File(["a,b\n"], "drop.csv", { type: "text/csv" });
const published = await uploadSharedFile(file, "https://upload.test/", "epoch-9");
assert.equal(published.commitSha, "abc");
assert.equal(uploaded.length, 2);
assert.equal(uploaded[0].url, "https://upload.test/blob");
assert.equal(JSON.parse(uploaded[1].body).assignmentEpoch, "epoch-9");
assert.equal(JSON.parse(uploaded[1].body).parts[0].sha, partSha);
await assert.rejects(() => uploadSharedFile(file, "", "epoch-9"), /not connected/);

globalThis.fetch = async (url) => {
  const href = String(url);
  if (href === "https://raw.githubusercontent.com/rigoabell/abelrigm_repository/main/docs/inventory/remote.json") {
    return new Response(JSON.stringify({ uploadUrl: "https://upload.test/" }), { status: 200 });
  }
  throw new Error("unexpected " + href);
};
assert.equal(await readUploadUrl(), "https://upload.test");

console.log("publish tests passed");
