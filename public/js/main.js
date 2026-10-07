// Wires the page together. Without this file the page is still a working
// form and a list; with it, the form becomes the composer and the list the orb.

import { createAmbient } from "./ambient.js";
import * as audio from "./audio.js";
import { initCards } from "./cards.js";
import { KINDS, META } from "./kinds.js";
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

stage.hidden = false;
ledger.open = false;

const orb = createOrb(stage, {
  traces,
  onCount(n) {
    scry.dataset.count = n;
    $(".scry-count").textContent = n === 1 ? "one thought" : `${n} thoughts`;
  },
});

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

function setStatus(message, error = false) {
  status.textContent = message;
  status.classList.toggle("error", error);
}

// ---------------------------------------------------------------- letting go

form.noValidate = true;
let busy = false;
let heldEvents = [];

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  const text = textarea.value.trim();
  const kind = form.querySelector("input[name=kind]:checked")?.value;
  if (!text) {
    setStatus("Write something first — even a fragment will do.", true);
    textarea.focus();
    return;
  }
  if (!kind || !KINDS.includes(kind)) {
    setStatus("Choose a form for it: one of the six above.", true);
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
  audio.play(kind, "release", 0);
  const release = startRelease(textarea, kind);

  let trace = null;
  try {
    const res = await fetch("/trace", {
      method: "POST",
      headers: { accept: "application/json" },
      body: new URLSearchParams({ kind, text }),
    });
    if (!res.ok) throw new Error(`the wall answered ${res.status}`);
    trace = await res.json();
  } catch (err) {
    console.warn(err);
  }
  await release.dissolved;

  if (!trace) {
    release.restore();
    textarea.readOnly = false;
    setStatus("It didn’t reach the glass — the wall didn’t answer. Your words are still here; try again.", true);
    busy = false;
    letGo.removeAttribute("aria-disabled");
    flushHeld();
    return;
  }

  known.add(trace.id);
  scry.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth", block: "start" });
  await release.fly(() => orb.centre());
  orb.receive(trace);
  ambient.flash(META[kind].a);
  addToLedger(trace);

  textarea.value = "";
  textarea.readOnly = false;
  textarea.classList.remove("released");
  renderCount();
  setStatus("Let go. It’s in the glass now, with everyone else’s.");
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
  if (orb.arriveFromElsewhere(t)) addToLedger(t);
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
