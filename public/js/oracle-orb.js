// The second crystal ball: moon-glass, holding what the model has imagined.
// Its recent thoughts hang as a constellation, threaded in the order they
// came; the newest condenses out of drifting motes in the middle of the glass
// and, when the next arrives, comes apart into the star it leaves behind.

import { ORACLE } from "./fx.js";
import { TAU, approach, clamp, fitCanvas, glowSprite, mixRgb, noise2, rand, reducedMotion, relativeTime } from "./util.js";
import { rgba } from "./kinds.js";

const CONDENSE = 1.6; // seconds for a new thought's words to gather
const DISSOLVE = 0.9;
const MOON = [222, 226, 255];
const GOLD = [240, 210, 150];

/** A thought's place in the glass depends only on its number, so it stays put across reloads. */
function placeOf(id) {
  const a = id * 2.399963;
  const y = Math.sin(id * 1.7) * 0.55;
  const ring = Math.sqrt(1 - y * y) * (0.5 + 0.25 * Math.sin(id * 0.9));
  return [Math.cos(a) * ring, y, Math.sin(a) * ring];
}

export function createOracleOrb(stage, { onTouch, describe }) {
  const el = stage.querySelector(".oracle");
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const reveal = stage.querySelector(".oracle-reveal");
  const announce = stage.querySelector(".oracle-live");

  let W = 0;
  let R = 0;
  let cx = 0;
  let cy = 0;
  let t = 0;
  let visible = true;
  let yaw = 0;
  let stars = [];
  let current = null; // { thought, age, glyphs }
  let parting = null; // the previous current, coming apart
  let state = { name: "asleep", progress: 0, line: "" };
  let hovered = null;
  let pinned = null;
  let keyIndex = -1;
  let hideTimer = 0;
  let glow = 0;
  const pointer = { x: -1e4, y: -1e4, inside: false };

  function resize() {
    const { w } = fitCanvas(canvas, 1.5);
    W = w;
    cx = W / 2;
    cy = W / 2;
    R = (W / 1.16) * 0.5;
    if (current) current.glyphs = layout(current.thought.text);
  }

  // ---------------------------------------------------------------- words out of mist

  function font(size) {
    return `italic 500 ${Math.round(size)}px "Cormorant Garamond", serif`;
  }

  /** Lays the words out character by character, so each can gather from its own mote. */
  function layout(text) {
    const size = clamp(R * 0.075, 15, 25);
    ctx.font = font(size);
    const lines = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= R * 1.25 || !line) line = next;
      else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    const shown = lines.slice(0, 4);
    if (lines.length > 4) shown[3] = `${shown[3].replace(/[\s,.;:]+$/, "")}…`;
    const lh = size * 1.2;
    const top = cy - ((shown.length - 1) * lh) / 2 + R * 0.05;
    const glyphs = [];
    shown.forEach((l, li) => {
      const width = ctx.measureText(l).width;
      let x = cx - width / 2;
      for (const ch of l) {
        const w = ctx.measureText(ch).width;
        const a = rand(0, TAU);
        const d = rand(0.35, 0.95) * R;
        glyphs.push({ ch, x: x + w / 2, y: top + li * lh, fx: cx + Math.cos(a) * d, fy: cy + Math.sin(a) * d, delay: rand(0, 0.55), size });
        x += w;
      }
    });
    return glyphs;
  }

  // ---------------------------------------------------------------- simulate and draw

  function project([x, y, z]) {
    const c = Math.cos(yaw);
    const s = Math.sin(yaw);
    const x1 = x * c + z * s;
    const z1 = -x * s + z * c;
    const k = 1 / (1 - z1 * 0.25);
    return [cx + x1 * R * 0.86 * k, cy + y * R * 0.86 * k, z1];
  }

  function step(dt) {
    t += dt;
    const calm = reducedMotion.matches;
    const still = calm || state.name === "paused" || pinned || hovered;
    if (!still) yaw += dt * (state.name === "thinking" ? 0.12 : 0.05);
    glow = approach(glow, state.name === "thinking" ? 1 : 0, dt, 0.6);
    if (current) current.age += dt;
    if (parting && (parting.age += dt) > DISSOLVE) parting = null;
    for (const st of stars) {
      [st.sx, st.sy, st.z] = project(st.v);
      st.hot = approach(st.hot, st === hovered || st === pinned ? 1 : 0, dt, 0.15);
      st.born = Math.min(1, st.born + dt / 1.2);
    }
  }

  function drawBody() {
    const aura = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.16);
    aura.addColorStop(0, rgba(mixRgb(MOON, GOLD, glow), 0.08 + glow * 0.12));
    aura.addColorStop(1, rgba(MOON, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, W);

    const body = ctx.createRadialGradient(cx + R * 0.25, cy - R * 0.35, R * 0.08, cx, cy, R);
    body.addColorStop(0, "rgba(34,38,72,0.6)");
    body.addColorStop(0.6, "rgba(9,10,26,0.9)");
    body.addColorStop(1, "rgba(3,4,12,0.97)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
  }

  function drawMist() {
    // slow banks of moonlit mist, thicker while it is thinking
    ctx.globalCompositeOperation = "screen";
    for (let i = 0; i < 4; i++) {
      const a = t * 0.05 * (i % 2 ? 1 : -1) + i * 1.7;
      const rr = R * (0.25 + 0.2 * noise2(i * 2.3, t * 0.04));
      const x = cx + Math.cos(a) * rr;
      const y = cy + Math.sin(a * 1.3) * rr * 0.7;
      const g = ctx.createRadialGradient(x, y, 0, x, y, R * 0.7);
      g.addColorStop(0, rgba(i % 2 ? GOLD : [150, 160, 230], 0.045 + glow * 0.05));
      g.addColorStop(1, rgba(MOON, 0));
      ctx.fillStyle = g;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawConstellation() {
    const sorted = [...stars].sort((p, q) => p.thought.id - q.thought.id);
    // threads in the order the thoughts came: a chain of association
    ctx.lineWidth = 1;
    for (let i = 1; i < sorted.length; i++) {
      const p = sorted[i - 1];
      const q = sorted[i];
      const depth = (p.z + q.z + 2) / 4;
      ctx.strokeStyle = rgba(GOLD, (0.08 + depth * 0.16) * Math.min(p.born, q.born));
      ctx.beginPath();
      ctx.moveTo(p.sx, p.sy);
      ctx.lineTo(q.sx, q.sy);
      ctx.stroke();
    }
    for (const st of [...stars].sort((p, q) => p.z - q.z)) {
      const depth = (st.z + 1) / 2;
      const r = (2 + depth * 2.4) * (1 + st.hot * 0.9) * (W / 700 + 0.4);
      const twinkle = reducedMotion.matches ? 1 : 0.8 + 0.2 * Math.sin(t * 2 + st.thought.id);
      ctx.globalAlpha = (0.35 + depth * 0.65) * twinkle * st.born;
      const g = r * 4;
      ctx.drawImage(glowSprite(st.thought.id % 3 ? MOON : GOLD, 64), st.sx - g, st.sy - g, g * 2, g * 2);
      ctx.fillStyle = "rgba(255,252,240,0.95)";
      ctx.beginPath();
      // a four-pointed glint, the model's mark, rather than a round light
      ctx.moveTo(st.sx, st.sy - r * 1.6);
      ctx.lineTo(st.sx + r * 0.35, st.sy);
      ctx.lineTo(st.sx, st.sy + r * 1.6);
      ctx.lineTo(st.sx - r * 0.35, st.sy);
      ctx.closePath();
      ctx.moveTo(st.sx - r * 1.6, st.sy);
      ctx.lineTo(st.sx, st.sy + r * 0.35);
      ctx.lineTo(st.sx + r * 1.6, st.sy);
      ctx.lineTo(st.sx, st.sy - r * 0.35);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function drawWords(entry, mode) {
    if (!entry) return;
    const calm = reducedMotion.matches;
    // a pool of dark behind the words so they always read
    const k0 = mode === "in" ? clamp(entry.age / 0.6, 0, 1) : 1 - entry.age / DISSOLVE;
    const back = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 0.8);
    back.addColorStop(0, `rgba(5,6,16,${0.6 * k0})`);
    back.addColorStop(1, "rgba(5,6,16,0)");
    ctx.fillStyle = back;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const g of entry.glyphs) {
      let k;
      let x;
      let y;
      if (mode === "in") {
        k = calm ? clamp(entry.age / 0.4, 0, 1) : clamp((entry.age - g.delay) / (CONDENSE - 0.55), 0, 1);
        const e = 1 - (1 - k) ** 3;
        x = calm ? g.x : g.fx + (g.x - g.fx) * e;
        y = calm ? g.y : g.fy + (g.y - g.fy) * e;
        if (k < 1 && !calm) {
          ctx.globalAlpha = (1 - k) * 0.8;
          ctx.drawImage(glowSprite(GOLD, 32), x - 5, y - 5, 10, 10);
        }
        ctx.globalAlpha = k;
      } else {
        k = clamp(entry.age / DISSOLVE, 0, 1);
        x = g.x + (calm ? 0 : Math.sin(g.delay * 20 + k * 3) * 8 * k);
        y = g.y - (calm ? 0 : k * k * R * 0.3 * (0.5 + g.delay));
        ctx.globalAlpha = 1 - k;
      }
      ctx.font = font(g.size);
      ctx.fillStyle = rgba(mixRgb([248, 246, 255], GOLD, 0.15), 1);
      ctx.fillText(g.ch, x, y);
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = "start";
  }

  function drawState() {
    const name = state.name;
    if (current && !["asleep", "loading", "unavailable"].includes(name)) return;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const size = clamp(R * 0.068, 14, 22);
    ctx.font = font(size);
    const breath = reducedMotion.matches ? 0.75 : 0.6 + 0.25 * Math.sin(t * 1.2);
    ctx.fillStyle = `rgba(236,232,250,${name === "unavailable" ? 0.6 : breath})`;
    const words = {
      asleep: "asleep",
      loading: `waking · ${Math.round(state.progress * 100)}%`,
      waiting: "waiting for someone to leave a thought",
      unavailable: "it can't run here",
      elsewhere: "imagining in another tab",
      paused: "paused",
      thinking: "imagining…",
      resting: "",
    }[name];
    if (words) ctx.fillText(words, cx, cy);
    ctx.textAlign = "start";
    if (name === "loading") {
      ctx.strokeStyle = rgba(GOLD, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 0.97, -Math.PI / 2, -Math.PI / 2 + TAU * state.progress);
      ctx.stroke();
    }
  }

  function drawSurface() {
    const rim = ctx.createRadialGradient(cx, cy, R * 0.74, cx, cy, R);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(1, rgba(mixRgb(MOON, GOLD, 0.3), 0.24));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
    // a crescent of reflected light, opposite the human orb's highlight: the two face each other
    const lx = cx + R * 0.3 + (pointer.inside ? clamp((pointer.x - cx) / R, -1, 1) * R * 0.1 : 0);
    const ly = cy - R * 0.42;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(0.6);
    ctx.scale(1, 0.5);
    const hl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.34);
    hl.addColorStop(0, "rgba(255,255,255,0.26)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.34, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "rgba(236,232,250,0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, TAU);
    ctx.stroke();
  }

  function draw() {
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);
    drawBody();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, TAU);
    ctx.clip();
    drawMist();
    drawConstellation();
    if (!(pinned || hovered)) {
      drawWords(parting, "out");
      drawWords(current, "in");
    }
    drawState();
    ctx.restore();
    drawSurface();
  }

  // ---------------------------------------------------------------- reading a thought

  function show(st, { announceIt = false } = {}) {
    clearTimeout(hideTimer);
    const th = st.thought;
    reveal.replaceChildren();
    const head = document.createElement("div");
    head.className = "reveal-head";
    const hz = document.createElement("span");
    hz.className = "reveal-hanzi";
    hz.lang = "zh-Hant";
    hz.setAttribute("aria-hidden", "true");
    hz.textContent = "想";
    const kind = document.createElement("span");
    kind.className = "reveal-kind";
    const name = document.createElement("b");
    name.textContent = "model thought";
    const when = document.createElement("span");
    const time = document.createElement("time");
    time.dateTime = new Date(th.at).toISOString();
    time.textContent = relativeTime(th.at);
    when.append(`no. ${th.id} · imagined `, time);
    kind.append(name, when);
    head.append(hz, kind);
    const text = document.createElement("p");
    text.className = "reveal-text";
    text.textContent = th.text;
    const source = document.createElement("p");
    source.className = "reveal-source";
    source.textContent = describe(th);
    reveal.append(head, text, source);
    reveal.classList.add("shown");
    if (announceIt) announce.textContent = `Model thought ${th.id}, ${relativeTime(th.at)}: ${th.text}`;
  }

  function hideSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (pinned || hovered) return;
      reveal.classList.remove("shown");
    }, 1400);
  }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * W];
  };

  function hit(x, y, finger) {
    const reach = finger ? Math.max(26, R * 0.1) : Math.max(16, R * 0.07);
    let best = null;
    let score = Infinity;
    for (const st of stars) {
      const d = Math.hypot(st.sx - x, st.sy - y);
      if (d < reach && d - st.z * 8 < score) [best, score] = [st, d - st.z * 8];
    }
    return best;
  }

  function onScreen(st) {
    const r = canvas.getBoundingClientRect();
    return [r.left + (st.sx / W) * r.width, r.top + (st.sy / W) * r.height];
  }

  el.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = Math.hypot(x - cx, y - cy) < R;
    if (e.pointerType !== "mouse") return;
    const st = pointer.inside ? hit(x, y) : null;
    if (st !== hovered) {
      hovered = st;
      el.classList.toggle("over-mote", Boolean(st));
      if (st) {
        show(st);
        onTouch?.(...onScreen(st));
      } else if (pinned) show(pinned);
      else hideSoon();
    }
  });
  el.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (!hovered) return;
    hovered = null;
    el.classList.remove("over-mote");
    if (pinned) show(pinned);
    else hideSoon();
  });
  el.addEventListener("click", (e) => {
    const [x, y] = local(e);
    if (Math.hypot(x - cx, y - cy) > R) return;
    const st = hit(x, y, e.pointerType !== "mouse") ?? (current && Math.hypot(x - cx, y - cy) < R * 0.45 ? stars.find((s) => s.thought.id === current.thought.id) : null);
    if (st) {
      pinned = st;
      keyIndex = stars.indexOf(st);
      show(st, { announceIt: true });
      onTouch?.(...onScreen(st));
    } else {
      pinned = null;
      hideSoon();
    }
  });
  el.addEventListener("keydown", (e) => {
    if (!stars.length) return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const n = stars.length;
    const byAge = [...stars].sort((p, q) => q.thought.id - p.thought.id);
    if (e.key in moves) {
      e.preventDefault();
      keyIndex = keyIndex < 0 ? 0 : (keyIndex + moves[e.key] + n) % n;
    } else if (e.key === "Home") {
      e.preventDefault();
      keyIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      keyIndex = n - 1;
    } else if (e.key === "Escape") {
      pinned = null;
      hideSoon();
      announce.textContent = "";
      return;
    } else return;
    pinned = byAge[keyIndex];
    show(pinned, { announceIt: true });
    onTouch?.(...onScreen(pinned));
  });

  // ---------------------------------------------------------------- loop

  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(el);
  new ResizeObserver(resize).observe(el);
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && W > 0 && !document.hidden) {
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }
  resize();
  requestAnimationFrame(frame);

  return {
    /**
     * The thoughts to hold. `fresh`, when given, is a thought just imagined:
     * it condenses in the middle and the one before it comes apart.
     */
    setThoughts(thoughts, fresh = null) {
      const keep = new Map(stars.map((s) => [s.thought.id, s]));
      stars = thoughts.map((th) => keep.get(th.id) ?? { thought: th, v: placeOf(th.id), sx: cx, sy: cy, z: 0, hot: 0, born: fresh?.id === th.id ? 0 : 1 });
      for (const st of stars) [st.sx, st.sy, st.z] = project(st.v);
      if (pinned && !stars.includes(pinned)) pinned = null;
      if (hovered && !stars.includes(hovered)) hovered = null;
      const newest = fresh ?? thoughts.at(-1) ?? null;
      if (!newest) {
        current = null;
        return;
      }
      if (current?.thought.id === newest.id) return;
      if (current && fresh) parting = { ...current, age: 0 };
      current = { thought: newest, age: fresh ? 0 : CONDENSE, glyphs: layout(newest.text) };
      el.setAttribute("aria-label", `crystal ball of model thoughts, holding ${thoughts.length === 1 ? "one" : thoughts.length}`);
    },
    setState(name, { progress = 0 } = {}) {
      state = { name, progress };
      el.classList.toggle("is-asleep", name === "asleep" || name === "unavailable");
    },
    /** Where, in viewport coordinates, the glass's middle is. */
    centre() {
      const r = canvas.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    },
  };
}
