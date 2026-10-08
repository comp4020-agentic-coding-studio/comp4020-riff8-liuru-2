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
const ledger = $(".ledger");
const wall = $("ol.wall");
const soundToggle = $(".sound-toggle");

// ---------------------------------------------------------------- the stored thoughts

const traces = [...wall.querySelectorAll("li.trace")].map((li) => ({
  id: Number(li.dataset.id),
  kind: li.dataset.kind,
  text: li.querySelector(".text").lastChild.textContent,
  createdAt: Number(li.dataset.created),
  mine: li.hasAttribute("data-mine"),
}));
const known = new Set(traces.map((t) => t.id));
// what the model may read: only ever the stored human thoughts this page has seen
const everyone = [...traces];

function ledgerItem(t) {
  const m = META[t.kind];
  const li = document.createElement("li");
  li.className = `trace kind-${t.kind}${t.mine ? " mine" : ""} arrived`;
  li.dataset.id = t.id;
  li.dataset.kind = t.kind;
  li.dataset.created = t.createdAt;
  const glyph = document.createElement("span");
  glyph.className = "glyph";
  glyph.setAttribute("aria-hidden", "true");
  glyph.title = `${m.hanzi} ${m.label}`;
  glyph.textContent = m.hanzi;
  const tagged = document.createElement("span");
  tagged.className = "visually-hidden";
  tagged.textContent = `tagged as ${m.label}: `;
  const text = document.createElement("span");
  text.className = "text";
  if (t.mine) {
    const yours = document.createElement("span");
    yours.className = "visually-hidden";
    yours.textContent = "yours: ";
    text.append(yours);
  }
  text.append(t.text);
  const when = document.createElement("time");
  when.className = "when";
  when.dateTime = new Date(t.createdAt).toISOString();
  when.textContent = relativeTime(t.createdAt);
  li.append(glyph, tagged, text, when);
  return li;
}

function addToLedger(t) {
  wall.querySelector("li.empty")?.remove();
  wall.prepend(ledgerItem(t));
}

setInterval(() => {
  for (const li of wall.querySelectorAll("li.trace")) {
    li.querySelector(".when").textContent = relativeTime(Number(li.dataset.created));
  }
}, 60_000);

// ---------------------------------------------------------------- the world

const ambient = createAmbient($("canvas.ambient"));
const fx = createFx($("canvas.fx"));

stage.hidden = false;
ledger.open = false;

const orb = createOrb(stage, {
  traces,
  onTouch: (x, y, kind) => fx.burst(x, y, kind, 10),
  onCount(n) {
    scry.dataset.count = n;
    $(".scry-count").textContent =
      n === 0 ? "Nothing has passed through yet." : `${n === 1 ? "One thought" : `${n} thoughts`}, held for a while.`;
    $(".kinds-legend").hidden = n === 0;
  },
});

// ---------------------------------------------------------------- the drift

const cycleToggle = $(".cycle-toggle");
function renderCycle() {
  cycleToggle.setAttribute("aria-pressed", String(!orb.cycling));
  cycleToggle.querySelector("span").textContent = orb.cycling ? "hold the drift" : "let it drift";
}
cycleToggle.addEventListener("click", () => {
  orb.setCycling(!orb.cycling);
  renderCycle();
});
for (const button of document.querySelectorAll(".cycle-step")) {
  button.addEventListener("click", () => {
    // browsing by hand holds the drift, so what you stepped to stays to be read
    if (orb.cycling) orb.setCycling(false);
    orb.browse(Number(button.dataset.dir));
    renderCycle();
  });
}
renderCycle();

// ---------------------------------------------------------------- the second glass

const oracleOrb = createOracleOrb($(".oracle-stage"), {
  onTouch: (x, y) => fx.glint(x, y, 5),
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
    legend.forEach((b) => b.setAttribute("aria-pressed", String(on && b === button)));
    orb.only(on ? kind : null);
    if (on) audio.play(kind, "select", 0.05);
  });
}

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

/** The stored trace, or null if the wall didn't take it (or didn't say in time). Never throws. */
async function postTrace(kind, text, release) {
  try {
    const res = await fetch("/trace", {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams({ kind, text, release }),
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
  // the post starts at once; the words only come apart where the visitor can see them
  const token = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  const posting = postTrace(kind, text, token);
  await revealComposer();
  audio.play(kind, "release", 0);
  const release = startRelease(textarea, kind);
  let trace = await posting;
  await release.dissolved;
  if (!trace) {
    // the reply was lost, but the wall may have stored it anyway: if our own
    // token came back on the live stream, it did
    const echoed = heldEvents.find((t) => t.release === token);
    if (echoed) {
      trace = { ...echoed, mine: true };
      heldEvents = heldEvents.filter((t) => t !== echoed);
    }
  }

  if (!trace) {
    release.restore();
    textarea.readOnly = false;
    setStatus("It didn’t reach the glass — the wall didn’t answer. Your words are still here; try again.", { error: true });
    busy = false;
    letGo.removeAttribute("aria-disabled");
    flushHeld();
    return;
  }

  known.add(trace.id);
  scry.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  await release.fly(() => orb.centre());
  // a thought always arrives into the whole glass, not a filtered view of it
  if (legend.some((b) => b.getAttribute("aria-pressed") === "true")) {
    legend.forEach((b) => b.setAttribute("aria-pressed", "false"));
    orb.only(null);
  }
  orb.receive(trace);
  everyone.push(trace);
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
  if (!orb.arriveFromElsewhere(t)) return;
  addToLedger(t);
  everyone.push(t);
  oracle.nudge();
}

function flushHeld() {
  const held = heldEvents;
  heldEvents = [];
  held.forEach(arrive);
}

if ("EventSource" in window) {
  const events = new EventSource("/events");
  events.addEventListener("trace", (e) => {
    const t = JSON.parse(e.data);
    // while our own thought is in flight, hold others back so ours isn't mistaken for theirs
    if (busy) heldEvents.push(t);
    else arrive(t);
  });
}
