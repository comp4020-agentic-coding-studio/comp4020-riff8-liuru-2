import { expect, inject, it } from "vitest";

// Replies: anonymous, single-level, under a human thought, kept in SQLite with
// a stable reference to it, and validated on the server whatever the client did.
const baseUrl = inject("baseUrl");

const tag = (what: string): string => `${what}-${Math.random().toString(36).slice(2)}`;
const uuid = (): string => crypto.randomUUID();

async function postJson(path: string, body: Record<string, string>, cookie?: string) {
  const res = await fetch(new URL(path, baseUrl), {
    method: "POST",
    headers: { accept: "application/json", ...(cookie ? { cookie } : {}) },
    body: new URLSearchParams(body),
  });
  return { res, body: await res.json() };
}

async function newTrace(): Promise<{ id: number; text: string }> {
  const text = tag("parent");
  const { body } = await postJson("/trace", { kind: "shadow", text });
  return body;
}

it("stores a reply under its thought, anonymously, and serves it with the wall after a reload", async () => {
  const parent = await newTrace();
  const text = tag("reply");
  const { res, body } = await postJson("/reply", { trace: String(parent.id), text, request: uuid() });
  expect(res.status).toBe(201);
  expect(body).toMatchObject({ traceId: parent.id, text, mine: true });
  expect(body).not.toHaveProperty("visitorId");

  // a fresh visitor sees it too, under the right thought, and not as theirs
  const page = await (await fetch(new URL("/", baseUrl))).text();
  const item = page.match(new RegExp(`<li class="trace[^"]*" id="trace-${parent.id}"(?:(?!</li>\\s*</ol>\\s*</details>\\s*</li>)[\\s\\S])*`))?.[0] ?? "";
  expect(item).toContain(text);
  expect(item).toContain("anonymous");
  expect(page).not.toContain(`"visitorId"`);
});

it("keeps replies in the order they were left", async () => {
  const parent = await newTrace();
  const texts = [tag("first"), tag("second"), tag("third")];
  for (const text of texts) await postJson("/reply", { trace: String(parent.id), text, request: uuid() });
  const snap = await (await fetch(new URL("/snapshot", baseUrl))).json();
  const mine = snap.replies.filter((r: { traceId: number }) => r.traceId === parent.id).map((r: { text: string }) => r.text);
  expect(mine).toEqual(texts);
});

it("refuses a blank reply, an over-long one, and one to a thought that isn't there, storing none of them", async () => {
  const parent = await newTrace();
  const blank = await postJson("/reply", { trace: String(parent.id), text: "   \n ", request: uuid() });
  expect(blank.res.status).toBe(400);
  expect(blank.body.error).toMatch(/words/);

  // over the limit is refused outright, not cut short: a reply is a sentence someone meant whole
  const marker = tag("long");
  const long = await postJson("/reply", { trace: String(parent.id), text: marker + "x".repeat(241 - marker.length), request: uuid() });
  expect(long.res.status).toBe(400);
  expect(long.body.error).toMatch(/240/);

  const exactly = tag("full");
  const full = await postJson("/reply", { trace: String(parent.id), text: exactly + "y".repeat(240 - exactly.length), request: uuid() });
  expect(full.res.status).toBe(201);

  const orphan = tag("orphan");
  const missing = await postJson("/reply", { trace: "999999999", text: orphan, request: uuid() });
  expect(missing.res.status).toBe(404);
  const nonsense = await postJson("/reply", { trace: "abc", text: orphan, request: uuid() });
  expect(nonsense.res.status).toBe(400);

  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page).not.toContain(marker);
  expect(page).not.toContain(orphan);
});

it("renders a reply as text, never as markup", async () => {
  const parent = await newTrace();
  const text = `<img src=x onerror=alert(1)>${tag("xss")}</script>`;
  await postJson("/reply", { trace: String(parent.id), text, request: uuid() });
  const page = await (await fetch(new URL("/", baseUrl))).text();
  expect(page).not.toContain("<img src=x");
  expect(page).not.toMatch(/<\/script>[^<]*<\/script>/);
  expect(page).toContain("&lt;img src=x onerror=alert(1)&gt;");
});

it("never feeds replies to the model: the generated glass reads only the human thoughts", async () => {
  // the model's input is built in the browser from `traces` alone (public/js/main.js `everyone`);
  // replies arrive on their own event and are kept in their own store
  const main = await (await fetch(new URL("/static/js/main.js", baseUrl))).text();
  expect(main).toMatch(/getTraces: \(\) => everyone/);
  expect(main).not.toMatch(/everyone\.push\([^)]*\br\b/);
});
