// Wires the page together. Without this file the page is still a working
// form and a list; with it, the form becomes the composer and the list the orb.

import { createAmbient } from "./ambient.js";
import * as audio from "./audio.js";
import { initCards } from "./cards.js";
import { KINDS, META } from "./kinds.js";
import { createFx } from "./fx.js";
import { createOracle } from "./oracle.js";
import { createOracleOrb } from "./oracle-orb.js";
import { createOrb } from "./orb.js";
import { createReplies } from "./replies.js";
import { startRelease } from "./release.js";
import { reducedMotion, relativeTime } from "./util.js";

document.documentElement.classList.add("js");

const $ = (sel) => document.querySelector(sel);
const form = $(".release-form");
const textarea = $("#thought");
const pool = $(".pool");
const count = $(".count");
const countN = $(".count-n");
const status = $(".status");
const letGo = $(".let-go");
const cardsRoot = $(".cards");
const scry = $(".scry");
const stage = $(".orb-stage");
const wall = $("ol.wall");
const soundToggle = $(".sound-toggle");
const filterState = $(".filter-state");
const filterWords = $(".filter-words");
const ledgerEmpty = $(".ledger-empty");
const cycleToggle = $(".cycle-toggle");
const cycleState = $(".cycle-state");

// ---------------------------------------------------------------- the stored thoughts

// The page starts from exactly what the server rendered, and the cursor it was
// rendered at; the live stream then replays everything after that cursor, so
// nothing posted between the render and the stream opening is lost.
const initial = JSON.parse($("#wall-data").textContent);
const traces = initial.traces;
const known = new Set(traces.map((t) => t.id));
// what the model may read: only ever the stored human thoughts this page has seen, never replies
const everyone = [...traces];
let cursor = initial.cursor;

const wallLive = $(".wall-live");
const say = (message) => {
  wallLive.textContent = "";
  requestAnimationFrame(() => (wallLive.textContent = message));
};

let orb = null;
const replies = createReplies({
  maxText: initial.maxText,
  announce: say,
  // while someone writes a reply in the reading panel, the glass keeps that thought there
  onComposeInPanel: (id) => orb?.lock(id),
});
initial.replies.forEach((r) => replies.add(r));

const listItems = new Map(); // trace id -> its <li> in the plain list

function ledgerItem(t, { fresh = false } = {}) {
  const m = META[t.kind];
  const li = document.createElement("li");
  li.className = `trace kind-${t.kind}${t.mine ? " mine" : ""}${fresh ? " arrived" : ""}`;
  li.id = `trace-${t.id}`;
  li.dataset.id = t.id;
  li.dataset.kind = t.kind;
  const row = document.createElement("div");
  row.className = "trace-row";
  const glyph = document.createElement("span");
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.title = `${m.hanzi} ${m.label}`;
  glyph.textContent = m.hanzi;
  // the words are a button: pressing it reads this thought in the glass and lights its star
  const read = document.createElement("button");
  read.type = "button";
  read.className = "text trace-read";
  const tagged = document.createElement("span");
  tagged.className = "visually-hidden";
  tagged.textContent = `${t.mine ? "yours, " : ""}${m.label}: `;
  read.append(tagged, t.text);
  read.title = "read it in the glass";
  read.addEventListener("click", () => readInGlass(t.id, li));
  const when = document.createElement("time");
  when.className = "when";
  when.dateTime = new Date(t.createdAt).toISOString();
  when.textContent = relativeTime(t.createdAt);
  row.append(glyph, read, when);
  li.append(row, replies.mount({ ...t, label: m.name.toLowerCase() }, "list").root);
  li.hidden = Boolean(filter) && t.kind !== filter;
  listItems.set(t.id, li);
  return li;
}

function addToLedger(t) {
  wall.querySelector("li.empty")?.remove();
  wall.prepend(ledgerItem(t, { fresh: true }));
  renderFilter();
}

let filter = null; // one of the six, or null for every thought
wall.replaceChildren(...traces.map((t) => ledgerItem(t)));
if (!traces.length) {
  const li = document.createElement("li");
  li.className = "empty";
  li.textContent = "nothing has passed through yet";
  wall.append(li);
}

setInterval(() => {
  for (const t of everyone) {
    const when = listItems.get(t.id)?.querySelector(".trace-row .when");
    if (when) when.textContent = relativeTime(t.createdAt);
  }
}, 60_000);

// ---------------------------------------------------------------- the world

const ambient = createAmbient($("canvas.ambient"));
const fx = createFx($("canvas.fx"));

stage.hidden = false;

let panelThread = null;
let cameFrom = null; // the list item a reader chose this thought from, to go back to

orb = createOrb(stage, {
  traces,
  onTouch: (x, y, kind) => fx.burst(x, y, kind, 10),
  onCount: () => orb && renderFilter(),
  // every thought read in the panel carries its thread, and a way to answer it
  onShow(panel, t) {
    panelThread?.dispose();
    panelThread = replies.mount({ ...t, label: META[t.kind].name.toLowerCase() }, "panel");
    panel.append(panelThread.root);
    if (cameFrom && Number(cameFrom.dataset.id) === t.id) {
      const back = document.createElement("button");
      back.type = "button";
      back.className = "reveal-back";
      back.textContent = "back to the list";
      const from = cameFrom;
      back.addEventListener("click", () => {
        from.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
        from.querySelector(".trace-read").focus({ preventScroll: true });
      });
      panel.append(back);
    } else cameFrom = null;
  },
  onHold: renderHold,
});

/** Opens a thought from the plain list in the glass: its light turns to face you and the panel reads it. */
function readInGlass(id, li) {
  cameFrom = li;
  if (!orb.select(id)) return;
  stage.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
  $(".orb-stage .reveal").focus({ preventScroll: true });
}

// ---------------------------------------------------------------- one kind at a time


function renderFilter() {
  const total = everyone.length;
  const matching = filter ? everyone.filter((t) => t.kind === filter).length : total;
  scry.dataset.count = total;
  $(".scry-count").textContent =
    total === 0 ? "Nothing has passed through yet." : `${total === 1 ? "One thought" : `${total} thoughts`}, held for a while.`;
  $(".kinds-legend").hidden = total === 0;
  for (const [id, li] of listItems) li.hidden = Boolean(filter) && everyone.find((t) => t.id === id)?.kind !== filter;
  filterState.hidden = !filter;
  ledgerEmpty.hidden = !filter || matching > 0;
  if (!filter) return;
  const name = META[filter].name.toLowerCase();
  filterWords.textContent =
    matching === 0
      ? `No ${name} has passed through yet.`
      : `Showing ${matching === 1 ? "the one" : `all ${matching}`} ${name} ${matching === 1 ? "thought" : "thoughts"} of ${total}, in the glass and the list.`;
  ledgerEmpty.textContent = `No thought tagged as ${META[filter].label} has passed through yet. Yours could be the first, or show every thought again.`;
}

function setFilter(kind) {
  filter = kind;
  legend.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.kind === kind)));
  orb.only(kind);
  renderFilter();
}

// ---------------------------------------------------------------- the drift

// one fixed label, "hold the drift", whose pressed state says whether it is held;
// the line above the controls says it in words, and names what it is held on
function renderHold({ cycling, pinned } = { cycling: orb?.cycling ?? true, pinned: null }) {
  cycleToggle.setAttribute("aria-pressed", String(!cycling));
  stage.classList.toggle("held", !cycling || Boolean(pinned));
  cycleState.textContent = pinned
    ? `held on ${META[pinned.kind].label} · it stays while you read`
    : cycling
      ? "drifting · each thought rises in turn"
      : "held · step through by hand, or let it drift";
  for (const [id, li] of listItems) li.classList.toggle("lit", pinned?.id === id);
}
cycleToggle.addEventListener("click", () => orb.setCycling(!orb.cycling));
for (const button of document.querySelectorAll(".cycle-step")) {
  button.addEventListener("click", () => {
    // browsing by hand holds the drift, so what you stepped to stays to be read
    if (orb.cycling) orb.setCycling(false, { pin: false });
    orb.browse(Number(button.dataset.dir));
  });
}
renderHold();

// ---------------------------------------------------------------- the second glass

const oracleOrb = createOracleOrb($(".oracle-stage"), {
  onTouch(x, y) {
    fx.glint(x, y, 5);
    audio.play("oracle", "touch", 0.15);
  },
  describe: (th) => oracle.describe(th),
});
const oracle = createOracle({
  root: $(".twin-model"),
  orb: oracleOrb,
  getTraces: () => everyone,
  // the light that crosses between the glasses carries the colours of exactly the thoughts the model was shown
  onInspire(humans) {
    const read = orb.inspire(humans.map((h) => h.id));
    fx.strand(() => orb.centre(), () => oracleOrb.centre(), read.map((r) => META[r.kind].a));
  },
  onThought() {
    const [x, y] = oracleOrb.centre();
    fx.glint(x, y, 8);
  },
});

const legend = [...document.querySelectorAll(".legend-kind")];
for (const button of legend) {
  const kind = button.dataset.kind;
  button.addEventListener("pointerenter", () => audio.play(kind, "hover", 0.3));
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-pressed") !== "true";
    setFilter(on ? kind : null);
    if (on) audio.play(kind, "select", 0.05);
  });
}
$(".filter-all").addEventListener("click", () => setFilter(null));
renderFilter();

// ---------------------------------------------------------------- sound

soundToggle.hidden = false;
const renderSound = () => {
  const on = !audio.isMuted();
  soundToggle.setAttribute("aria-pressed", String(on));
  soundToggle.querySelector(".sound-label").textContent = on ? "sound on" : "sound off";
};
audio.onChange(renderSound);
renderSound();
soundToggle.addEventListener("click", () => {
  audio.unlock();
  audio.setMuted(!audio.isMuted());
});

// a browser only lets sound begin from a gesture; the first one anywhere wakes it
const wake = () => audio.unlock();
addEventListener("pointerdown", wake, { capture: true });
addEventListener("keydown", wake, { capture: true });

// ---------------------------------------------------------------- choosing a form

function choose(kind) {
  document.body.dataset.kind = kind;
  ambient.setKind(kind);
  audio.wantMusic(kind === "bubble");
  if (status.classList.contains("error") && textarea.value.trim()) setStatus("");
}

initCards(cardsRoot, { onSelect: choose });
const restored = form.querySelector("input[name=kind]:checked");
if (restored) choose(restored.value);

// ---------------------------------------------------------------- writing

let typingTimer = 0;
function renderCount() {
  const n = textarea.value.length;
  countN.textContent = n;
  count.style.setProperty("--chars", n);
  pool.style.setProperty("--fill", (n / 240).toFixed(3));
  count.classList.toggle("near", n >= 200 && n < 240);
  count.classList.toggle("full", n >= 240);
}
textarea.addEventListener("input", () => {
  renderCount();
  pool.classList.add("typing");
  clearTimeout(typingTimer);
  typingTimer = setTimeout(() => pool.classList.remove("typing"), 140);
  // each keystroke throws a small light up off the brush line, where the count has reached
  const r = pool.getBoundingClientRect();
  const fill = textarea.value.length / 240;
  ambient.spark(r.left + 24 + (r.width - 48) * fill, r.bottom - 2);
  if (status.classList.contains("error") && textarea.value.trim()) setStatus("");
});
// Cmd/Ctrl+Enter lets it go without reaching for the button
textarea.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    form.requestSubmit();
  }
});
renderCount();

let statusTimer = 0;
function setStatus(message, { error = false, fade = 0 } = {}) {
  clearTimeout(statusTimer);
  status.textContent = message;
  status.classList.toggle("error", error);
  if (fade) statusTimer = setTimeout(() => setStatus(""), fade);
}

/** Brings the composer fully into view and resolves once the page has stopped moving. */
function revealComposer() {
  const r = pool.getBoundingClientRect();
  if (r.top >= 0 && r.bottom <= innerHeight) return Promise.resolve();
  pool.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "center" });
  return new Promise((done) => {
    let last = -1;
    let still = 0;
    const watch = () => {
      still = scrollY === last ? still + 1 : 0;
      last = scrollY;
      if (still > 3) done();
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
  });
}

// ---------------------------------------------------------------- letting go

const POST_TIMEOUT = 12_000;
const newRequest = () => crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
// the request a failed post was sent under, kept so a retry of the same words is the same thought
let pendingRequest = null;
const ownRequests = new Set();

/** The stored trace, or null if the wall didn't take it (or didn't say in time). Never throws. */
async function postTrace(kind, text, request) {
  try {
    const res = await fetch("/trace", {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams({ kind, text, request }),
      signal: AbortSignal.timeout(POST_TIMEOUT),
    });
    if (!res.ok) throw new Error(`the wall answered ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(err);
    return null;
  }
}

form.noValidate = true;
let busy = false;
let heldEvents = [];

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const text = textarea.value.trim();
  const kind = form.querySelector("input[name=kind]:checked")?.value;
  if (!text) {
    setStatus("Write something first — even a fragment will do.", { error: true });
    textarea.focus();
    return;
  }
  if (!kind || !KINDS.includes(kind)) {
    setStatus("Choose a form for it: one of the six as-ifs.", { error: true });
    cardsRoot.classList.remove("nudge");
    void cardsRoot.offsetWidth;
    cardsRoot.classList.add("nudge");
    form.querySelector("input[name=kind]").focus();
    return;
  }

  busy = true;
  letGo.setAttribute("aria-disabled", "true");
  textarea.readOnly = true;
  setStatus("letting go…");
  // the same words and form, sent again after a failure, reuse the failed post's id:
  // if the first one did reach the wall, this one finds it there rather than storing it twice
  const signature = `${kind}\u0000${text}`;
  if (!pendingRequest || pendingRequest.signature !== signature) pendingRequest = { id: newRequest(), signature };
  const request = pendingRequest.id;
  ownRequests.add(request);
  // the post starts at once; the words only come apart where the visitor can see them
  const posting = postTrace(kind, text, request);
  await revealComposer();
  audio.play(kind, "release", 0);
  const release = startRelease(textarea, kind);
  let trace = await posting;
  await release.dissolved;
  if (!trace) {
    // the answer was lost, but the wall may have stored it anyway: if our own
    // request came back on the live stream, it did
    const echoed = heldEvents.find((t) => t.request === request);
    if (echoed) {
      trace = { ...echoed, mine: true };
      heldEvents = heldEvents.filter((t) => t !== echoed);
    }
  }

  if (!trace) {
    release.restore();
    textarea.readOnly = false;
    setStatus("It didn’t reach the glass — the wall didn’t answer. Your words are still here; try again, and it won’t be kept twice.", { error: true });
    busy = false;
    letGo.removeAttribute("aria-disabled");
    flushHeld();
    return;
  }
  pendingRequest = null;
  heldEvents = heldEvents.filter((t) => t.id !== trace.id);
  // ours even if the cookie that would have said so was lost with the first answer
  trace = { ...trace, mine: true };

  if (known.has(trace.id)) {
    // it was already here: a retry found the first attempt stored, and the stream had brought it in
    release.restore();
    textarea.value = "";
    textarea.readOnly = false;
    renderCount();
    setStatus("It had already reached the glass; it’s kept once.", { fade: 6000 });
    busy = false;
    letGo.removeAttribute("aria-disabled");
    flushHeld();
    return;
  }

  known.add(trace.id);
  scry.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  await release.fly(() => orb.centre());
  // a thought always arrives into the whole glass, not a filtered view of it
  if (filter) setFilter(null);
  everyone.push(trace);
  orb.receive(trace);
  oracle.nudge();
  const [ox, oy] = orb.centre();
  fx.burst(ox, oy, kind, 22);
  ambient.flash(META[kind].a);
  addToLedger(trace);

  textarea.value = "";
  textarea.readOnly = false;
  textarea.classList.remove("released");
  renderCount();
  setStatus(known.size > 1 ? "Let go. It’s in the glass now, with everyone else’s." : "Let go. It’s the first light in the glass.", {
    fade: 6000,
  });
  busy = false;
  letGo.removeAttribute("aria-disabled");
  flushHeld();
});

$(".again").addEventListener("click", () => {
  $(".compose").scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  setTimeout(() => textarea.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 600);
});

// ---------------------------------------------------------------- everyone else, live

function arrive(t) {
  if (known.has(t.id)) return;
  known.add(t.id);
  // one of ours whose answer was lost, now come back on the stream
  if (t.request && ownRequests.has(t.request)) t = { ...t, mine: true };
  everyone.push(t);
  if (!orb.arriveFromElsewhere(t)) return;
  addToLedger(t);
  oracle.nudge();
}

function flushHeld() {
  const held = heldEvents;
  heldEvents = [];
  held.forEach(arrive);
}

/** A reply from anywhere, this page's own included: counts and threads update, drafts are left alone. */
function arriveReply(r) {
  const stored = replies.add(r);
  if (!stored || stored.mine) return;
  const parent = everyone.find((t) => t.id === r.traceId);
  if (parent) say(`Someone replied to ${parent.mine ? "your thought" : META[parent.kind].label}: ${r.text}`);
}

// ---------------------------------------------------------------- the stream, and catching up after a gap

// The stream is opened with the cursor this page is up to. The server replays
// everything after it, then says "synced"; each event carries the cursor just
// after it as its SSE id. A dropped connection is reopened by hand from the
// latest cursor (not left to EventSource's own retry, which can't change the
// URL), so a page that slept, lost its network or raced the first render ends
// up with exactly what it missed, each event applied once by id. If it missed
// more than the server will replay, the server says "reset" and the page
// fetches a fresh snapshot instead.

const linkState = $(".link-state");
let linkTimer = 0;
function setLink(message, { quiet = 0, error = false } = {}) {
  clearTimeout(linkTimer);
  linkState.textContent = message;
  linkState.classList.toggle("error", error);
  if (quiet) linkTimer = setTimeout(() => (linkState.textContent = ""), quiet);
}

let stream = null;
let interrupted = false;
let retryTimer = 0;
let retries = 0;

function connect() {
  clearTimeout(retryTimer);
  stream?.close();
  const es = new EventSource(`/events?since=${encodeURIComponent(cursor)}`);
  stream = es;
  const track = (e) => {
    if (e.lastEventId) cursor = e.lastEventId;
  };
  es.addEventListener("trace", (e) => {
    const t = JSON.parse(e.data);
    // while our own thought is in flight, hold others back so ours isn't mistaken for theirs
    if (busy) heldEvents.push(t);
    else arrive(t);
    track(e);
  });
  es.addEventListener("reply", (e) => {
    arriveReply(JSON.parse(e.data));
    track(e);
  });
  es.addEventListener("synced", (e) => {
    track(e);
    retries = 0;
    if (interrupted) {
      const { missed } = JSON.parse(e.data);
      interrupted = false;
      setLink(missed ? `Back in touch — caught up on ${missed === 1 ? "one thing" : `${missed} things`} left while away.` : "Back in touch — nothing was missed.", {
        quiet: 5000,
      });
    }
  });
  es.addEventListener("reset", async () => {
    es.close();
    // resync moves the cursor only once the snapshot is in hand; if it fails, the old
    // cursor stays and the next attempt is told to reset again, so nothing is skipped
    if (await resync()) {
      if (interrupted) {
        interrupted = false;
        setLink("Back in touch — too much happened to replay, so the wall was read afresh.", { quiet: 5000 });
      }
      connect();
    } else lostTouch();
  });
  es.onerror = () => {
    if (stream !== es) return;
    es.close();
    lostTouch();
  };
}

function lostTouch() {
  if (!interrupted) {
    interrupted = true;
    setLink("Out of touch with the wall — new thoughts will catch up when it answers again.", { error: true });
  }
  // back off gently, but never give up while the page is open
  clearTimeout(retryTimer);
  retryTimer = setTimeout(connect, Math.min(30_000, 1500 * 2 ** retries++));
}

/** Too much was missed to replay one by one: take the wall as it is now, keeping only what's new. True once done. */
async function resync() {
  try {
    const res = await fetch("/snapshot", { headers: { accept: "application/json" }, cache: "no-store" });
    if (!res.ok) throw new Error(`the wall answered ${res.status}`);
    const snap = await res.json();
    // a wall behind this page was emptied and begun again: its ids mean other thoughts now, so start over
    const [had] = cursor.split(".").map(Number);
    const [has] = snap.cursor.split(".").map(Number);
    if (has < had) {
      location.reload();
      return false;
    }
    // oldest first, so the newest ends up at the top of the list and the front of the glass
    for (const t of [...snap.traces].reverse()) arrive(t);
    for (const r of snap.replies) replies.add(r);
    cursor = snap.cursor;
    return true;
  } catch (err) {
    console.warn(err);
    return false;
  }
}

if ("EventSource" in window) {
  connect();
  // a page coming back from sleep or the back/forward cache reconnects at once rather than waiting out a back-off
  addEventListener("online", () => interrupted && connect());
  addEventListener("pageshow", (e) => e.persisted && connect());
}
