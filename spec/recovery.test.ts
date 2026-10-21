import { expect, inject, it } from "vitest";

// Posting is idempotent, and a page that drops off the live stream gets back
// exactly what it missed: these are what make the wall reliable on a bad
// connection, not just on a good one.
const baseUrl = inject("baseUrl");

const tag = (what: string): string => `${what}-${Math.random().toString(36).slice(2)}`;

const post = (path: string, body: Record<string, string>, cookie?: string) =>
  fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { accept: "application/json", ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(body),
  });

const occurrences = (haystack: string, needle: string): number => haystack.split(needle).length - 1;

/** Reads an event stream until `until` is seen in it or the deadline passes. */
async function readStream(path: string, until: (soFar: string) => boolean, headers: Record<string, string> = {}): Promise<string> {
  const controller = new AbortController();
  const res = await fetch(new URL(path, baseUrl), { signal: controller.signal, headers });
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let received = "";
  const deadline = Date.now() + 3000;
  while (!until(received) && Date.now() < deadline) {
    const next = await Promise.race([reader.read(), new Promise<{ done: true; value: undefined }>((r) => setTimeout(() => r({ done: true, value: undefined }), deadline - Date.now()))]);
    if (next.done) break;
    received += decoder.decode(next.value);
  }
  controller.abort();
  return received;
}

it("stores a retried trace once: the same request id gets the first one back", async () => {
  const text = tag("retry");
  const request = crypto.randomUUID();
  const first = await post("/trace", { kind: "dew", text, request });
  expect(first.status).toBe(201);
  const a = await first.json();
  // the retry might come without the cookie the lost answer would have set
  const second = await post("/trace", { kind: "dew", text, request }, "visitor=someone-else");
  expect(second.status).toBe(200);
  const b = await second.json();
  expect(b.id).toBe(a.id);

  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(occurrences(page, `${text}</`)).toBe(1);
});

it("still takes an intentionally new trace with the same words", async () => {
  const text = tag("again");
  const a = await (await post("/trace", { kind: "dream", text, request: crypto.randomUUID() })).json();
  const b = await (await post("/trace", { kind: "dream", text, request: crypto.randomUUID() })).json();
  expect(b.id).not.toBe(a.id);
  // and without any request id at all (the plain form), every post is its own
  const c = await (await post("/trace", { kind: "dream", text })).json();
  expect(c.id).not.toBe(b.id);
});

it("stores a retried reply once, and still takes a new one with the same words", async () => {
  const parent = await (await post("/trace", { kind: "bubble", text: tag("parent") })).json();
  const text = tag("reply");
  const request = crypto.randomUUID();
  const a = await (await post("/reply", { trace: String(parent.id), text, request })).json();
  const retry = await post("/reply", { trace: String(parent.id), text, request });
  expect(retry.status).toBe(200);
  expect((await retry.json()).id).toBe(a.id);
  const fresh = await (await post("/reply", { trace: String(parent.id), text, request: crypto.randomUUID() })).json();
  expect(fresh.id).not.toBe(a.id);

  const snap = await (await fetch(new URL("/snapshot", baseUrl))).json();
  expect(snap.replies.filter((r: { text: string }) => r.text === text)).toHaveLength(2);
});

it("replays everything after a page's cursor before anything new, then says it is synced", async () => {
  const { cursor } = await (await fetch(new URL("/snapshot", baseUrl))).json();
  expect(cursor).toMatch(/^\d+\.\d+$/);

  // posted while this "page" was disconnected
  const missedTrace = tag("missed-trace");
  const parent = await (await post("/trace", { kind: "lightning", text: missedTrace })).json();
  const missedReply = tag("missed-reply");
  await post("/reply", { trace: String(parent.id), text: missedReply, request: crypto.randomUUID() });

  const replay = await readStream(`/events?since=${cursor}`, (s) => s.includes("event: synced"));
  expect(replay).toContain(missedTrace);
  expect(replay).toContain(missedReply);
  expect(replay.indexOf(missedTrace)).toBeLessThan(replay.indexOf("event: synced"));
  // other spec files post alongside this one, so at least these two
  expect(Number(replay.match(/"missed":(\d+)/)?.[1])).toBeGreaterThanOrEqual(2);
  // each event carries the cursor after it, so a reconnect resumes from there
  expect(replay).toMatch(/id: \d+\.\d+\nevent: trace/);
});

it("resumes from Last-Event-ID on a reconnect, without repeating what was already heard", async () => {
  const before = tag("heard");
  await post("/trace", { kind: "illusion", text: before });
  const { cursor } = await (await fetch(new URL("/snapshot", baseUrl))).json();
  const after = tag("unheard");
  await post("/trace", { kind: "illusion", text: after });

  // the browser's own reconnect sends Last-Event-ID; it wins over the page's original ?since
  const replay = await readStream("/events?since=0.0", (s) => s.includes("event: synced"), { "last-event-id": cursor });
  expect(replay).toContain(after);
  expect(replay).not.toContain(before);
});

it("tells a page that missed too much to replay to fetch a fresh snapshot instead", async () => {
  // a cursor from before the wall began, on a wall holding more than the replay limit, overflows;
  // on a smaller wall it replays everything. Either way the page is never left silently short.
  // the snapshot first: other spec files post alongside this one, and anything they add later is beyond it
  const snap = await (await fetch(new URL("/snapshot", baseUrl))).json();
  const res = await readStream("/events?since=0.0", (s) => s.includes("event: synced") || s.includes("event: reset"));
  if (res.includes("event: reset")) {
    expect(res).not.toContain("event: trace");
  } else {
    // every stored trace (up to the page's own 200) came back
    for (const t of snap.traces.slice(0, 20)) expect(res).toContain(JSON.stringify(t.text));
  }
});

it("broadcasts a reply to every open page, with the request id that lets its sender recognise it", async () => {
  const parent = await (await post("/trace", { kind: "dew", text: tag("parent") })).json();
  const { cursor } = await (await fetch(new URL("/snapshot", baseUrl))).json();
  const text = tag("live-reply");
  const request = crypto.randomUUID();
  const listening = readStream(`/events?since=${cursor}`, (s) => s.includes(text));
  await new Promise((r) => setTimeout(r, 100));
  await post("/reply", { trace: String(parent.id), text, request });
  const received = await listening;
  expect(received).toContain("event: reply");
  expect(received).toContain(request);
  expect(occurrences(received, text)).toBe(1);
});

it("tells a page whose cursor is ahead of the wall (its data was reset) to fetch a fresh snapshot", async () => {
  const res = await readStream("/events?since=999999999.999999999", (s) => s.includes("event: synced") || s.includes("event: reset"));
  expect(res).toContain("event: reset");
  expect(res).not.toContain("event: synced");
});
