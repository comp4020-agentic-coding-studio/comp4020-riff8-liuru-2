import { describe, expect, it } from "vitest";
import { createLoop } from "../public/js/oracle-loop.js";
import {
  LIMITS,
  accept,
  buildPrompt,
  chooseHumans,
  cleanThought,
  compact,
  compactionPrompt,
  emptyMemory,
  isRepetitive,
  needsCompaction,
  sanitise,
  skip,
} from "../public/js/oracle-memory.js";

// The second orb's memory and scheduler, driven by deterministic doubles in
// place of the model. That the real model loads and generates in a browser is
// checked by hand (see README), not here: these pin the bounds and the rules.

type Memory = ReturnType<typeof emptyMemory>;
type Human = { id: number; kind: string; text: string };

const humans = (n: number, from = 1): Human[] =>
  Array.from({ length: n }, (_, i) => ({
    id: from + i,
    kind: ["dream", "dew", "shadow"][i % 3],
    text: `visitor fragment ${from + i} about rain on a tin roof and a train ${"long ".repeat(i % 7)}`,
  }));

const VOCAB = "lantern river ash moth glass salt orchard ferry bell kite marrow tide wren chalk ember quay".split(" ");
// a fake model: a different line every call, carrying a few words no other call uses
const fakeThought = (n: number) => `the ${VOCAB[n % 16]} remembers k${n}a and k${n}b by morning`;

function assertBounded(m: Memory) {
  expect(m.recent.length).toBeLessThanOrEqual(LIMITS.recent + 1);
  for (const r of m.recent) expect(r.text.length).toBeLessThanOrEqual(LIMITS.thoughtChars);
  expect(m.summary.length).toBeLessThanOrEqual(LIMITS.summaryChars);
  expect(m.seen.length).toBeLessThanOrEqual(LIMITS.seen);
  expect(JSON.stringify(m).length).toBeLessThan(12_000);
}

/** One iteration as the page runs it: compact if due, then generate and keep or skip. */
function iterate(m: Memory, pool: Human[], gen: (n: number) => string, summarise: (m: Memory) => unknown) {
  if (needsCompaction(m)) m = compact(m, summarise(m));
  const chosen = chooseHumans(pool, m);
  const prompt = buildPrompt(m, chosen, () => 0.5);
  expect(prompt.user.length).toBeLessThanOrEqual(LIMITS.promptChars);
  const text = cleanThought(gen(m.gen));
  return { m: text && !isRepetitive(text, m, chosen) ? accept(m, text, chosen) : skip(m, chosen), chosen, prompt };
}

describe("model memory", () => {
  it("stays inside every bound across hundreds of generations and repeated compaction", () => {
    let m = emptyMemory();
    const pool = humans(40);
    for (let i = 0; i < 300; i++) {
      ({ m } = iterate(m, pool, fakeThought, (mm) => `themes so far: ${mm.recent.map((r) => r.text.split(" ")[1]).join(", ")}`));
      assertBounded(m);
    }
    expect(m.compactions).toBeGreaterThan(50);
    expect(m.gen).toBe(300);
    expect(m.summary).toMatch(/^themes so far/);
  });

  it("falls back to a deterministic summary when the model's is missing, junk, or far too long", () => {
    let m = emptyMemory();
    const pool = humans(10);
    const bad = [() => undefined, () => "", () => "ok", () => "x ".repeat(5000), () => ({ not: "text" })];
    for (let i = 0; i < 120; i++) {
      ({ m } = iterate(m, pool, fakeThought, bad[i % bad.length]));
      assertBounded(m);
    }
    expect(m.compactions).toBeGreaterThan(20);
    expect(m.summary).toMatch(/^recurring: /);
  });

  it("keeps human words out of the summary: compaction only ever sees model thoughts", () => {
    let m = emptyMemory();
    const pool = humans(5);
    for (let i = 0; i < LIMITS.recent + 1; i++) ({ m } = iterate(m, pool, fakeThought, () => ""));
    const p = compactionPrompt(m);
    expect(p.user).not.toMatch(/visitor fragment/);
    const after = compact(m, undefined);
    expect(after.summary).not.toMatch(/visitor|tin roof/);
  });

  it("reads a newly arrived human comment within the next generation", () => {
    let m = emptyMemory();
    let pool = humans(30);
    for (let i = 0; i < 20; i++) ({ m } = iterate(m, pool, fakeThought, () => ""));
    pool = [...pool, { id: 999, kind: "lightning", text: "a brand new comment, just posted" }];
    // an anchor generation shows a single comment; the fresh one still gets it
    const { chosen } = iterate(m, pool, fakeThought, () => "");
    expect(chosen.map((h) => h.id)).toContain(999);
  });

  it("walks every stored comment in turn rather than favouring any", () => {
    let m = emptyMemory();
    const pool = humans(25);
    const seen = new Set<number>();
    for (let i = 0; i < 20; i++) {
      const r = iterate(m, pool, fakeThought, () => "");
      r.chosen.forEach((h) => seen.add(h.id));
      m = r.m;
    }
    expect(seen.size).toBe(25);
  });

  it("returns to a single human fragment every few generations", () => {
    let m = emptyMemory();
    const pool = humans(12);
    const anchors: number[] = [];
    for (let i = 0; i < 12; i++) {
      const r = iterate(m, pool, fakeThought, () => "");
      if (r.prompt.anchor) {
        anchors.push(i);
        expect(r.prompt.user).not.toMatch(/Your last few fragments/);
      }
      m = r.m;
    }
    expect(anchors.length).toBe(3);
  });

  it("caps the prompt even when every input is at its largest", () => {
    let m = emptyMemory();
    for (let i = 0; i < LIMITS.recent; i++) m = accept(m, `${"w".repeat(30)} ${i} `.repeat(20), []);
    m = { ...m, summary: "s ".repeat(400) };
    const huge = Array.from({ length: 50 }, (_, i) => ({ id: i + 1, kind: "dew", text: `${i} ${"y".repeat(239)}` }));
    const p = buildPrompt(m, chooseHumans(huge, m));
    expect(p.user.length).toBeLessThanOrEqual(LIMITS.promptChars);
    expect(p.user).toMatch(/Fragments visitors left/);
  });

  it("refuses repeats, echoes of a visitor, and model chatter", () => {
    let m = emptyMemory();
    m = accept(m, "the lantern sways over the black river", []);
    expect(isRepetitive("The lantern sways over the black river!", m)).toBe(true);
    expect(isRepetitive("a moth circles the porch light", m)).toBe(false);
    // two lines the model really did produce back to back, in different words
    const m2 = accept(emptyMemory(), "A young person stands before a wooden table, staring blankly at a chalkboard full of numbers outside.", []);
    expect(isRepetitive("I stand before a wooden table, staring blankly at the chalkboard filled with numbers outside.", m2)).toBe(true);
    const visitor = [{ id: 1, kind: "dew", text: "wet grass on the walk to the 8am lecture" }];
    expect(isRepetitive("Wet grass on the walk to the 8am lecture.", m, visitor)).toBe(true);
    expect(cleanThought("")).toBeNull();
    expect(cleanThought("Sure, here is a fragment")).toBeNull();
    expect(cleanThought("I'm stuck—let's craft something fresh!\n\n**New Fragment:** A cracked teacup hums with static.")).toBe(
      "A cracked teacup hums with static.",
    );
    expect(cleanThought("An image it brings to mind: a faded photo of a cottage in golden light.")).toBe(
      "a faded photo of a cottage in golden light.",
    );
    expect(cleanThought('"My father\'s coat mingled with today\'s rain."<|im_end|>')).toBe("My father's coat mingled with today's rain.");
    expect(cleanThought("word ".repeat(200))!.length).toBeLessThanOrEqual(LIMITS.thoughtChars);
  });

  it("restores whatever was stored to a valid, bounded memory", () => {
    expect(sanitise(null)).toEqual(emptyMemory());
    expect(sanitise({ v: 2 })).toEqual(emptyMemory());
    const junk = sanitise({
      v: 1,
      recent: [...Array.from({ length: 500 }, (_, i) => ({ id: i, text: "z".repeat(5000), at: "soon" })), null, 7],
      summary: "q".repeat(100_000),
      gen: -4,
      seen: Array.from({ length: 900 }, () => "a".repeat(9000)),
      lastHumanId: Number.NaN,
    });
    assertBounded(junk);
    expect(junk.gen).toBe(0);
    expect(junk.lastHumanId).toBe(0);
  });
});

describe("generation loop", () => {
  // sleeps resolve on the next tick, so the loop runs as fast as the test can drive it
  const quickSleep = (_ms: number, signal?: AbortSignal) =>
    new Promise<void>((done, fail) => {
      const id = setTimeout(done, 0);
      signal?.addEventListener("abort", () => {
        clearTimeout(id);
        fail(new Error("woken"));
      });
    });
  const tick = () => new Promise((r) => setTimeout(r, 5));

  it("never has more than one generation in flight, however often it is started", async () => {
    let calls = 0;
    let concurrent = 0;
    let worst = 0;
    const loop = createLoop({
      sleep: quickSleep,
      think: async () => {
        concurrent++;
        worst = Math.max(worst, concurrent);
        calls++;
        await tick();
        concurrent--;
        return { status: "kept" };
      },
    });
    for (let i = 0; i < 5; i++) loop.start();
    while (calls < 20) await tick();
    loop.stop();
    expect(worst).toBe(1);
    expect(loop.stats.maxInFlight).toBe(1);
  });

  it("stays still while held for any reason, and carries on when every hold is released", async () => {
    let calls = 0;
    const loop = createLoop({ sleep: quickSleep, think: async () => (calls++, { status: "kept" }) });
    loop.hold("paused");
    loop.hold("hidden");
    loop.start();
    await tick();
    await tick();
    expect(calls).toBe(0);
    loop.release("paused");
    await tick();
    expect(calls).toBe(0);
    loop.release("hidden");
    while (calls < 3) await tick();
    loop.stop();
    expect(calls).toBeGreaterThanOrEqual(3);
  });

  it("backs off after failures and gives up after a bounded number in a row", async () => {
    const delays: number[] = [];
    const states: string[] = [];
    const loop = createLoop({
      backoff: [10, 20, 40],
      sleep: (ms, signal) => (delays.push(ms), quickSleep(ms, signal)),
      onState: (s) => states.push(s),
      think: async () => {
        throw new Error("out of memory");
      },
    });
    loop.start();
    while (!states.includes("failed")) await tick();
    expect(delays).toEqual([10, 20, 40]);
    expect(states.filter((s) => s === "thinking")).toHaveLength(4);
    expect(loop.running).toBe(false);
  });

  it("forgets earlier failures once a generation succeeds", async () => {
    let n = 0;
    const states: string[] = [];
    const loop = createLoop({
      backoff: [1, 1],
      sleep: quickSleep,
      onState: (s) => states.push(s),
      think: async () => {
        n++;
        if (n % 2) throw new Error("flaky");
        return { status: "kept" };
      },
    });
    loop.start();
    while (n < 12) await tick();
    loop.stop();
    expect(states).not.toContain("failed");
  });
});
