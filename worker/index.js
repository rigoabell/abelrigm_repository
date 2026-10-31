import { REPO } from "../docs/inventory/github-save.js";
import { publishInventory } from "./publish.js";

const API = "https://api.github.com/repos/" + REPO;
const MAX_BLOB = Math.ceil((90 * 1024 * 1024 * 4) / 3) + 64;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
    try {
      if (request.method === "GET" && url.pathname === "/health") return withCors(Response.json({ ok: true }));
      if (request.method === "POST" && url.pathname === "/blob") return withCors(await forwardBlob(request, env));
      if (request.method === "POST" && url.pathname === "/commit") return withCors(await commitUpload(request, env));
      return withCors(Response.json({ error: "Not found." }, { status: 404 }));
    } catch (error) {
      return withCors(Response.json({ error: error && error.message ? error.message : "The shared file could not be published." }, { status: 502 }));
    }
  },
};

async function forwardBlob(request, env) {
  if (!env || !env.GITHUB_TOKEN) return Response.json({ error: "The shared save is not connected yet." }, { status: 503 });
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BLOB) return Response.json({ error: "That file is over 90 MB." }, { status: 413 });
  const response = await fetch(API + "/git/blobs", {
    method: "POST",
    headers: githubHeaders(env.GITHUB_TOKEN, true),
    body: request.body,
    duplex: "half",
  });
  const data = await readJson(response);
  if (!response.ok || !data.sha) {
    const detail = data && (data.message || data.error) ? String(data.message || data.error).slice(0, 180) : "";
    const error = detail ? "GitHub could not store that file. " + detail : "GitHub could not store that file.";
    return Response.json({ error }, { status: response.status || 502 });
  }
  return Response.json({ sha: data.sha });
}

async function commitUpload(request, env) {
  if (!env || !env.GITHUB_TOKEN) return Response.json({ error: "The shared save is not connected yet." }, { status: 503 });
  const body = await request.json();
  const result = await publishInventory((method, path, payload) => callGitHub(env.GITHUB_TOKEN, method, path, payload), body);
  return Response.json(result);
}

async function callGitHub(token, method, path, payload) {
  const response = await fetch(API + path, {
    method,
    headers: githubHeaders(token, payload !== undefined),
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
  const data = await readJson(response);
  return {
    ok: response.ok,
    status: response.status,
    message: data && data.message ? data.message : "",
    data,
  };
}

function githubHeaders(token, json) {
  const headers = {
    Authorization: "Bearer " + token,
    Accept: "application/vnd.github+json",
    "User-Agent": "abelrigm-inventory",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (error) {
    return { message: text.slice(0, 180) };
  }
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  return new Response(response.body, { status: response.status, headers });
}
