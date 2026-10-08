import { expect, inject, it } from "vitest";

// What the second orb needs from the server: the page cross-origin isolated
// (so the model's WebAssembly can use threads), the in-browser runtime served
// from the installed package and nothing beside it, and the two glasses told
// apart in the HTML itself, before any script runs.
const baseUrl = inject("baseUrl");

it("isolates the page so the model can run on several threads", async () => {
  const res = await fetch(new URL("/", baseUrl));
  expect(res.headers.get("cross-origin-opener-policy")).toBe("same-origin");
  // credentialless, not require-corp: the weights still have to load from Hugging Face
  expect(res.headers.get("cross-origin-embedder-policy")).toBe("credentialless");
  const worker = await fetch(new URL("/static/js/oracle-worker.js", baseUrl));
  expect(worker.headers.get("cross-origin-embedder-policy")).toBe("credentialless");
});

it("serves the model's runtime from the installed package, and nothing outside it", async () => {
  const js = await fetch(new URL("/vendor/transformers/transformers.min.js", baseUrl));
  expect(js.status).toBe(200);
  expect(js.headers.get("content-type")).toContain("javascript");
  await js.body?.cancel();

  // the worker names this file; it is tens of megabytes and must arrive whole
  const wasm = await fetch(new URL("/vendor/ort/ort-wasm-simd-threaded.asyncify.wasm", baseUrl));
  expect(wasm.status).toBe(200);
  expect(wasm.headers.get("content-type")).toBe("application/wasm");
  expect(Number(wasm.headers.get("content-length"))).toBeGreaterThan(1_000_000);
  await wasm.body?.cancel();

  for (const path of ["/vendor/ort/../../package.json", "/vendor/ort/%2e%2e/package.json", "/vendor/transformers/..%2f..%2fpackage.json", "/vendor/ort/"]) {
    const res = await fetch(new URL(path, baseUrl));
    expect(res.status, path).toBe(404);
  }
});

it("tells the two glasses apart in the HTML itself: what people left, and what is generated", async () => {
  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page).toMatch(/<h3 id="human-h">What people left<\/h3>/);
  expect(page).toMatch(/<h3 id="model-h">What the model imagines<\/h3>/);
  expect(page).toContain("generated, not written");
  // the human thoughts stay readable as plain text without a script; the model's need one, and say so
  expect(page).toContain('<ol class="wall">');
  expect(page).toContain("needs JavaScript");
  // generated thoughts are never served as part of the wall
  expect(page).not.toMatch(/class="oracle-list"[^>]*>\s*<li/);
});
