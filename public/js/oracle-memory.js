// The second orb's working memory: what the model has recently imagined, a
// short rolling summary of what it imagined before that, and a little
// bookkeeping. Everything here is bounded by LIMITS, whatever is fed in, and
// nothing here ever touches the human guestbook: human comments are read in
// as source material and never written back, summarised, or stored.
//
// Pure functions over plain objects, so the browser and the spec share them.

export const LIMITS = {
  recent: 8, // model thoughts kept word for word
  thoughtChars: 160, // longest a single kept thought may be
  compactBatch: 4, // oldest thoughts folded into the summary at a time
  summaryChars: 360, // the rolling summary of everything older
  humanCount: 6, // human comments shown to the model per generation
  humanChars: 200, // each one cut to this in the prompt (they are ≤240 stored)
  freshHumans: 2, // of those, how many slots go to comments it hasn't seen yet
  promptChars: 2000, // the whole user message, hard cap (roughly 500 tokens)
  seen: 48, // fingerprints remembered for de-duplication
  maxNewTokens: 40,
  summaryTokens: 72,
};

// Every fourth generation leans on a single human fragment and sets the
// model's own recent thoughts aside, so the loop keeps returning to what
// people actually wrote instead of only riffing on itself.
export const ANCHOR_EVERY = 4;

// Concrete asks, because a model this small echoes an abstract one back as a
// label ("Quiet contrast: …"); compared against real output on 8 Oct 2026.
const MODES = [
  "something you could see or touch",
  "a sound or a smell it brings back",
  "a question nobody here has asked",
  "where one of them might be a year from now",
  "a small scene, in the present tense",
];

export const SYSTEM_PROMPT = [
  "You are the second crystal ball on 六如, a wall where strangers leave passing thoughts.",
  "Everything here is as a dream, an illusion, a bubble, a shadow, dew, or lightning.",
  "You answer no one and speak for no one. You write one short fragment of your own that the fragments bring to mind.",
  "Write a single line of at most twenty words. No quotation marks, no preamble, no explanation, no lists.",
].join(" ");

const STOP = new Set(
  (
    "a an the and or but of to in on at for with from by as is are was were be been it its it's this that these those " +
    "i you he she we they me my your our their his her them us not no so if then than there here what which who when " +
    "where how all any some one just only very can could would should will may might do does did have has had into " +
    "out up down over under again more most such like about after before while because through also each still own"
  ).split(" "),
);

/**
 * @typedef {{ id: number, text: string, at: number, kinds: string[] }} Thought
 * @typedef {{ v: 1, recent: Thought[], summary: string, gen: number, compactions: number,
 *   lastHumanId: number, cursor: number, seen: string[], updatedAt: number, summarisedBy?: string }} Memory
 */

/** @returns {Memory} */
export function emptyMemory() {
  return { v: 1, recent: [], summary: "", gen: 0, compactions: 0, lastHumanId: 0, cursor: 0, seen: [], updatedAt: 0 };
}

const words = (s) => s.toLowerCase().match(/[\p{L}\p{N}']+/gu) ?? [];

/** Cuts at a word boundary, never mid-word, and never past `max` characters. */
export function clip(s, max) {
  const flat = s.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:–—-]+$/u, "")}…`;
}

// crude stemming, enough that "stands" and "stand", "filled" and "fill" count as one word
const stem = (w) => (w.length > 4 ? w.replace(/(?:ing|ed|es|s)$/u, "") : w);

/** The content words of a line, for comparing two lines' substance rather than their spelling. */
export function fingerprint(s) {
  return [...new Set(words(s).filter((w) => w.length > 2 && !STOP.has(w)).map(stem))].sort().join(" ");
}

function jaccard(a, b) {
  const A = new Set(a.split(" ").filter(Boolean));
  const B = new Set(b.split(" ").filter(Boolean));
  if (!A.size || !B.size) return 0;
  let both = 0;
  for (const w of A) if (B.has(w)) both++;
  return both / (A.size + B.size - both);
}

/**
 * Turns raw model output into a kept thought, or null if there's nothing
 * worth keeping: empty, a refusal-shaped preamble, leaked template tokens,
 * or too short to be a fragment.
 */
export function cleanThought(raw, { truncated = false } = {}) {
  if (typeof raw !== "string") return null;
  if (raw.includes("<|")) raw = raw.slice(0, raw.indexOf("<|"));
  const lines = raw
    .replace(/[*_`#]+/g, "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter((l) => /\p{L}/u.test(l));
  // a small model sometimes talks about the task before doing it: take what it labelled as the answer
  const labelled = lines.map((l) => l.match(/^(?:new\s+)?(?:fragment|thought)\s*[:：]\s*(.+)$/iu)?.[1]).find(Boolean);
  let line = labelled ?? lines.find((l) => !META_TALK.test(l)) ?? "";
  // 'Hidden beneath ordinary noise: "The quiet holds…"': a label it made up, introducing the line itself
  line = line.match(/^[^:"“]{3,48}[:：]\s*["“](.+)$/u)?.[1] ?? line;
  line = line
    .replace(/^(?:[-•\d.)\s]+)/u, "")
    .replace(MODE_ECHO, "")
    .replace(BECOME_ECHO, "")
    .replace(/^["“”'‘’「『]+|["“”'‘’」』]+$/gu, "")
    .trim();
  if (/^(?:here(?:'s| is)|sure|certainly)\b/iu.test(line) || REFUSAL.test(line)) return null;
  if (truncated) line = endCleanly(line);
  line = line.charAt(0).toUpperCase() + line.slice(1);
  if (words(line).length < 3) return null;
  return clip(line, LIMITS.thoughtChars);
}

const REFUSAL = /\b(?:i'?m sorry|i apologi[sz]e|i (?:can(?:not|'t|’t)|am unable|won'?t)|as an ai|would you like me)\b/iu;

/** A line the token limit cut off: back to its last clause, or at least its last whole word. */
function endCleanly(line) {
  const stop = Math.max(...[".", "!", "?", ";", "—", ","].map((p) => line.lastIndexOf(p)));
  if (stop > 0 && words(line.slice(0, stop)).length >= 4) return `${line.slice(0, stop).trimEnd()}${line[stop] === "," || line[stop] === "—" ? "…" : line[stop]}`;
  return `${line.replace(/\s+\S*$/u, "")}…`;
}

// "I'm stuck, let's craft something fresh", "Here is a fragment": talk about the task, not a thought
const META_TALK = /\b(?:let'?s|craft|fragments?|prompt|i'?m stuck|as requested)\b/iu;
// "An image it brings to mind: …", "Question: …": the instruction echoed back as a label
const MODE_ECHO = /^[^:：—–]{0,48}\b(?:image|question|contrast|scene|mind|become|fragment|thought|answer|response|something|sound|smell|year)\b[^:：—–]{0,24}(?:[:：]|\s*[—–])\s*/iu;
const BECOME_ECHO = /^(?:what|where) (?:it|this|they|one of them) (?:might|may|will|could) (?:become|be)(?: (?:is|are))?[,:]?\s+/iu;

/** True when a candidate says what the model, or a visitor, or its own instruction, has already said. */
export function isRepetitive(text, memory, humans = [], mode = "") {
  const fp = fingerprint(text);
  if (!fp) return true;
  if (mode && jaccard(fp, fingerprint(mode)) >= 0.4) return true;
  for (const old of memory.seen) if (jaccard(fp, old) >= 0.5) return true;
  // an association, not a quotation: echoing a visitor back isn't a new thought
  for (const h of humans) if (jaccard(fp, fingerprint(h.text)) >= 0.7) return true;
  return false;
}

/**
 * The human comments for one generation: the newest ones it hasn't read yet
 * first, then a fair walk through everything else in id order, so every
 * stored comment gets its turn and none is favoured for attention.
 */
export function chooseHumans(traces, memory, anchor = false) {
  const pool = [...traces].filter((t) => t && typeof t.text === "string" && t.text.trim()).sort((p, q) => p.id - q.id);
  if (!pool.length) return [];
  const want = anchor ? 1 : Math.min(LIMITS.humanCount, pool.length);
  const fresh = pool.filter((t) => t.id > memory.lastHumanId).slice(-LIMITS.freshHumans);
  const chosen = [...fresh].slice(0, want);
  for (let i = 0; chosen.length < want && i < pool.length; i++) {
    const t = pool[(memory.cursor + i) % pool.length];
    if (!chosen.includes(t)) chosen.push(t);
  }
  return chosen.map((t) => ({ id: t.id, kind: t.kind, text: clip(t.text, LIMITS.humanChars) }));
}

export const isAnchor = (memory) => memory.gen % ANCHOR_EVERY === ANCHOR_EVERY - 1;

/**
 * The user message for one generation, never longer than LIMITS.promptChars.
 * When it would be, it gives up the oldest recent thoughts first, then the
 * summary, then human comments beyond the first: fresh human input is the
 * last thing to go.
 */
export function buildPrompt(memory, humans, rng = Math.random) {
  const anchor = isAnchor(memory);
  const mode = MODES[Math.floor(rng() * MODES.length) % MODES.length];
  let recent = anchor ? [] : memory.recent.slice(-4).map((r) => r.text);
  let summary = anchor ? "" : memory.summary;
  let people = humans.map((h) => h.text);

  const render = () => {
    const parts = [];
    parts.push(
      `${people.length === 1 ? "A fragment a visitor left" : "Fragments visitors left"} (theirs, not yours):\n${people.map((p) => `- ${p}`).join("\n")}`,
    );
    if (summary) parts.push(`What you have been imagining lately, in brief: ${summary}`);
    if (recent.length) parts.push(`Your last few fragments (don't repeat them):\n${recent.map((r) => `- ${r}`).join("\n")}`);
    parts.push(`Write one new fragment: ${mode}.`);
    return parts.join("\n\n");
  };

  let text = render();
  while (text.length > LIMITS.promptChars) {
    if (recent.length) recent = recent.slice(1);
    else if (summary) summary = "";
    else if (people.length > 1) people = people.slice(0, -1);
    else {
      people = [clip(people[0] ?? "", Math.max(40, LIMITS.promptChars - 200))];
      text = render();
      break;
    }
    text = render();
  }
  return { system: SYSTEM_PROMPT, user: text.slice(0, LIMITS.promptChars), anchor, mode };
}

/** Memory after keeping one new thought. Pure: the input isn't touched. */
export function accept(memory, text, humans, now = Date.now()) {
  const thought = {
    id: memory.gen + 1,
    text: clip(text, LIMITS.thoughtChars),
    at: now,
    // which kinds of human fragment it was looking at: true, and nothing more specific
    kinds: [...new Set(humans.map((h) => h.kind))].slice(0, 6),
  };
  const maxId = humans.reduce((m, h) => Math.max(m, h.id), memory.lastHumanId);
  return {
    ...memory,
    recent: [...memory.recent, thought],
    seen: [...memory.seen, fingerprint(thought.text)].slice(-LIMITS.seen),
    gen: memory.gen + 1,
    lastHumanId: maxId,
    cursor: memory.cursor + Math.max(1, humans.length - 1),
    updatedAt: now,
  };
}

/** Memory after a generation that produced nothing usable: it still moves on through the comments. */
export function skip(memory, humans, now = Date.now()) {
  return { ...memory, gen: memory.gen + 1, cursor: memory.cursor + Math.max(1, humans.length), updatedAt: now };
}

// folded before a turn that would otherwise take the ring past LIMITS.recent
export const needsCompaction = (memory) => memory.recent.length >= LIMITS.recent;

/** The model is asked to fold its own oldest thoughts into the summary. Human text never enters this. */
export function compactionPrompt(memory) {
  const old = memory.recent.slice(0, LIMITS.compactBatch).map((r) => `- ${r.text}`);
  return {
    system:
      "You keep brief notes for a daydreaming crystal ball. Merge its earlier notes and its older fragments into one short note of the themes, images and open questions. At most forty words, one paragraph, no list, no preamble.",
    user: `${memory.summary ? `Earlier notes: ${memory.summary}\n\n` : ""}Older fragments:\n${old.join("\n")}`,
  };
}

/** A summary built without the model: the most frequent content words, newest first on ties. */
export function fallbackSummary(summary, evicted) {
  const counts = new Map();
  const order = [...words(summary), ...evicted.flatMap((e) => words(e.text))].filter((w) => w.length > 2 && !STOP.has(w));
  order.forEach((w, i) => {
    const c = counts.get(w) ?? { n: 0, last: 0 };
    counts.set(w, { n: c.n + 1, last: i });
  });
  const top = [...counts.entries()]
    .sort((p, q) => q[1].n - p[1].n || q[1].last - p[1].last)
    .slice(0, 18)
    .map(([w]) => w);
  return clip(top.length ? `recurring: ${top.join(", ")}` : "", LIMITS.summaryChars);
}

/**
 * Memory after compaction. A model summary that is missing, malformed or
 * over-long is replaced by the deterministic fallback, so the bound holds
 * whatever the model did.
 */
export function compact(memory, modelSummary) {
  const evicted = memory.recent.slice(0, LIMITS.compactBatch);
  let summary = typeof modelSummary === "string" ? modelSummary.replace(/<\|[^]*$/u, "").replace(/\s+/g, " ").trim() : "";
  summary = summary.replace(/^(?:notes?|summary|themes?)\s*[:：-]\s*/iu, "");
  // a note to itself, not a question back to whoever asked: anything chat-shaped falls back
  const chatty = /\?\s*$|\byou\b|\byour\b/iu.test(summary) || REFUSAL.test(summary) || META_TALK.test(summary);
  const usable = !chatty && words(summary).length >= 4 && summary.length <= LIMITS.summaryChars * 1.5;
  return {
    ...memory,
    recent: memory.recent.slice(LIMITS.compactBatch),
    summary: usable ? clip(summary, LIMITS.summaryChars) : fallbackSummary(memory.summary, evicted),
    compactions: memory.compactions + 1,
    summarisedBy: usable ? "model" : "fallback",
  };
}

const num = (x, lo = 0) => (Number.isFinite(x) && x >= lo ? Math.floor(x) : lo);

/** Whatever was stored, a memory that satisfies every bound (or an empty one). */
export function sanitise(stored) {
  const base = emptyMemory();
  if (!stored || typeof stored !== "object" || stored.v !== 1) return base;
  const recent = Array.isArray(stored.recent)
    ? stored.recent
        .filter((r) => r && typeof r.text === "string" && r.text.trim())
        .slice(-LIMITS.recent)
        .map((r, i) => ({
          id: num(r.id, 1) || i + 1,
          text: clip(r.text, LIMITS.thoughtChars),
          at: num(r.at),
          kinds: Array.isArray(r.kinds) ? r.kinds.filter((k) => typeof k === "string").slice(0, 6) : [],
        }))
    : [];
  return {
    ...base,
    recent,
    summary: typeof stored.summary === "string" ? clip(stored.summary, LIMITS.summaryChars) : "",
    gen: num(stored.gen),
    compactions: num(stored.compactions),
    lastHumanId: num(stored.lastHumanId),
    cursor: num(stored.cursor),
    seen: Array.isArray(stored.seen) ? stored.seen.filter((s) => typeof s === "string").slice(-LIMITS.seen).map((s) => s.slice(0, LIMITS.thoughtChars)) : [],
    updatedAt: num(stored.updatedAt),
  };
}
