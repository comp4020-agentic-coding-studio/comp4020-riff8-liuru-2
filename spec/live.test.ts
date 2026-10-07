import { expect, inject, it } from "vitest";

// What the orb page relies on beyond the plain form: a fetch gets the stored
// trace back as JSON, every open page hears about a new trace over /events,
// and the static routes serve the client without reaching outside it.
const baseUrl = inject("baseUrl");

const randomText = (): string => `live-trace-${Math.random().toString(36).slice(2)}`;

const post = (body: Record<string, string>) =>
  fetch(new URL("/trace", baseUrl), {
    method: "POST",
    headers: { accept: "application/json" },
    body: new URLSearchParams(body),
  });

it("answers a JSON post with the stored trace, marked as the poster's own", async () => {
  const text = randomText();
  const res = await post({ kind: "bubble", text });
  expect(res.status).toBe(201);
  const trace = await res.json();
  expect(trace).toMatchObject({ kind: "bubble", text, mine: true });
  expect(trace).not.toHaveProperty("visitorId");

  const listed = await (await fetch(new URL("/traces", baseUrl))).json();
  expect(listed.some((t: { id: number }) => t.id === trace.id)).toBe(true);
});

it("refuses a JSON post with no real kind, and stores nothing", async () => {
  const text = randomText();
  const res = await post({ kind: "thunder", text });
  expect(res.status).toBe(400);
  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page).not.toContain(text);
});

it("tells an open page about a new trace without a reload", async () => {
  const controller = new AbortController();
  const events = await fetch(new URL("/events", baseUrl), { signal: controller.signal });
  expect(events.headers.get("content-type")).toContain("text/event-stream");
  const reader = events.body!.getReader();
  const decoder = new TextDecoder();

  const text = randomText();
  await post({ kind: "lightning", text });

  let received = "";
  const deadline = Date.now() + 2000;
  while (!received.includes(text) && Date.now() < deadline) {
    const { value, done } = await reader.read();
    if (done) break;
    received += decoder.decode(value);
  }
  controller.abort();
  expect(received).toContain("event: trace");
  expect(received).toContain(text);
});

it("serves the client, and nothing outside it", async () => {
  const js = await fetch(new URL("/static/js/main.js", baseUrl));
  expect(js.status).toBe(200);
  expect(js.headers.get("content-type")).toContain("javascript");

  for (const path of ["/static/../src/db.ts", "/static/%2e%2e/src/db.ts", "/assets/..%2fREADME.md"]) {
    const res = await fetch(new URL(path, baseUrl));
    expect(res.status, path).toBe(404);
  }
});

it("shrugs off a malformed cookie or Host header instead of falling over", async () => {
  const bad = await fetch(new URL("/", baseUrl), { headers: { cookie: "other=%E0%A4; visitor=%" } });
  expect(bad.status).toBe(200);

  const { request } = await import("node:http");
  const url = new URL(baseUrl);
  const status = await new Promise<number | undefined>((resolve, reject) => {
    const req = request({ host: url.hostname, port: url.port, path: "/", headers: { host: "[::bad" } }, (res) => {
      res.resume();
      resolve(res.statusCode);
    });
    req.on("error", reject);
    req.end();
  });
  expect(status).toBe(200);

  // and it is still there afterwards
  expect((await fetch(new URL("/", baseUrl))).status).toBe(200);
});
