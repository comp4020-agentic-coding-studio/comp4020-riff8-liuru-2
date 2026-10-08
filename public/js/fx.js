// The page's touch language: every pointer movement, press, scroll, context
// menu and keyboard focus leaves a few motes of light, coloured by whatever
// it touched. One canvas over everything, which never takes a pointer event;
// one bounded pool; drawing only while something is alive.

import { META, NEUTRAL, rgba } from "./kinds.js";
import { TAU, fitCanvas, glowSprite, mixRgb, rand, reducedMotion } from "./util.js";

const MAX = 240; // particles alive at once, whatever the visitor does
const MOVE_EVERY = 28; // ms between trail motes
const SCROLL_EVERY = 90;
// the model's own colour: moonlight and old gold, not one of the six
export const ORACLE = { a: [222, 226, 255], c: [240, 210, 150] };

const INTERACTIVE = "button, a, summary, textarea, .card, .orb, .oracle, .legend-kind";

export function createFx(canvas) {
  const ctx = canvas.getContext("2d");
  let W = 0;
  let H = 0;
  let parts = [];
  let strands = [];
  let running = false;
  let last = 0;
  let lastMove = 0;
  let lastScroll = 0;
  let lastY = scrollY;
  let lastEnter = null;
  let pointerDown = false;

  function resize() {
    ({ w: W, h: H } = fitCanvas(canvas, 1.5));
  }

  /** The colours of whatever is under (or is) this element. */
  function paletteOf(el) {
    const host = el?.closest?.("[data-kind], .oracle, .twin-model, .orb, .twin-human");
    if (!host) {
      const chosen = document.body.dataset.kind;
      return chosen ? META[chosen] : NEUTRAL;
    }
    if (host.matches(".oracle, .twin-model")) return ORACLE;
    const kind = host.dataset.kind ?? host.querySelector?.(".orb")?.dataset.kind;
    return META[kind] ?? META[document.body.dataset.kind] ?? NEUTRAL;
  }

  function add(p) {
    if (parts.length >= MAX) parts.shift();
    parts.push({ age: 0, vx: 0, vy: 0, drag: 1.6, grav: 0, shape: "mote", ...p });
    wake();
  }

  // ---------------------------------------------------------------- shapes of feedback

  function mote(x, y, pal, { speed = 18, life = rand(0.5, 0.9), r = rand(1.4, 2.6) } = {}) {
    const a = rand(0, TAU);
    add({ x, y, vx: Math.cos(a) * speed * rand(0.3, 1), vy: Math.sin(a) * speed * rand(0.3, 1) - 6, life, r, rgb: Math.random() < 0.7 ? pal.a : pal.c });
  }

  function ring(x, y, pal, { r = 26, life = 0.6 } = {}) {
    add({ x, y, shape: "ring", r0: 2, r1: r, life, rgb: pal.a });
  }

  function burst(x, y, pal, n = 10, speed = 90) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand(-0.2, 0.2);
      const s = speed * rand(0.5, 1);
      add({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, drag: 3.2, life: rand(0.45, 0.8), r: rand(1.2, 2.4), rgb: i % 3 ? pal.a : pal.c });
    }
  }

  /** A held, unmoving glow: what reduced motion gets instead of flying motes. */
  function still(x, y, pal, r = 18) {
    add({ x, y, shape: "glow", r, life: 0.5, rgb: pal.a });
  }

  function star(x, y, { n = 6, speed = 40 } = {}) {
    for (let i = 0; i < n; i++) {
      add({ x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-speed, speed) * 0.5, vy: -rand(speed * 0.4, speed), drag: 1.2, life: rand(0.8, 1.4), r: rand(2.5, 4.5), shape: "star", rgb: Math.random() < 0.5 ? ORACLE.a : ORACLE.c });
    }
  }

  // ---------------------------------------------------------------- input

  addEventListener(
    "pointermove",
    (e) => {
      if (reducedMotion.matches || e.timeStamp - lastMove < MOVE_EVERY) return;
      lastMove = e.timeStamp;
      const pal = paletteOf(e.target);
      const n = pointerDown ? 2 : 1;
      for (let i = 0; i < n; i++) mote(e.clientX + rand(-3, 3), e.clientY + rand(-3, 3), pal, { speed: pointerDown ? 30 : 12, life: rand(0.7, 1.2), r: pointerDown ? rand(1.8, 3.2) : rand(1.4, 2.4) });
    },
    { passive: true },
  );

  addEventListener(
    "pointerover",
    (e) => {
      const el = e.target.closest?.(INTERACTIVE);
      if (!el || el === lastEnter || e.pointerType === "touch") return;
      lastEnter = el;
      const pal = paletteOf(el);
      if (reducedMotion.matches) return still(e.clientX, e.clientY, pal, 14);
      ring(e.clientX, e.clientY, pal, { r: 18, life: 0.45 });
      for (let i = 0; i < 3; i++) mote(e.clientX, e.clientY, pal, { speed: 40 });
    },
    { passive: true },
  );

  addEventListener(
    "pointerout",
    (e) => {
      const el = e.target.closest?.(INTERACTIVE);
      if (!el || el.contains(e.relatedTarget)) return;
      if (lastEnter === el) lastEnter = null;
      if (reducedMotion.matches || e.pointerType === "touch") return;
      const pal = paletteOf(el);
      for (let i = 0; i < 2; i++) mote(e.clientX, e.clientY, pal, { speed: 24, life: 0.6 });
    },
    { passive: true },
  );

  addEventListener(
    "pointerdown",
    (e) => {
      pointerDown = true;
      const pal = paletteOf(e.target);
      if (reducedMotion.matches) return still(e.clientX, e.clientY, pal);
      ring(e.clientX, e.clientY, pal, { r: 30, life: 0.55 });
    },
    { passive: true, capture: true },
  );

  addEventListener(
    "pointerup",
    (e) => {
      pointerDown = false;
      if (reducedMotion.matches) return;
      burst(e.clientX, e.clientY, paletteOf(e.target), 7, 70);
    },
    { passive: true, capture: true },
  );
  addEventListener("pointercancel", () => (pointerDown = false), { passive: true });

  // a click from the keyboard (Enter or Space) has no pointer: answer at the control itself
  addEventListener(
    "click",
    (e) => {
      if (e.detail !== 0 || !(e.target instanceof Element)) return;
      const r = e.target.getBoundingClientRect();
      const pal = paletteOf(e.target);
      if (reducedMotion.matches) return still(r.left + r.width / 2, r.top + r.height / 2, pal, 24);
      burst(r.left + r.width / 2, r.top + r.height / 2, pal, 12, 110);
    },
    { capture: true },
  );

  // the native menu still opens; the light only marks where it was asked for
  addEventListener(
    "contextmenu",
    (e) => {
      const pal = paletteOf(e.target);
      if (reducedMotion.matches) return still(e.clientX, e.clientY, pal);
      ring(e.clientX, e.clientY, pal, { r: 40, life: 0.7 });
      burst(e.clientX, e.clientY, pal, 8, 50);
    },
    { passive: true },
  );

  // scrolling stirs a few motes in from the edge it's moving toward
  const stir = (dir) => {
    if (reducedMotion.matches) return;
    const pal = paletteOf(document.body);
    for (let i = 0; i < 2; i++) {
      const x = Math.random() < 0.5 ? rand(0, W * 0.12) : rand(W * 0.88, W);
      add({ x, y: dir > 0 ? H + 4 : -4, vx: rand(-6, 6), vy: -dir * rand(60, 140), drag: 1.4, life: rand(0.8, 1.4), r: rand(1, 2.2), rgb: pal.a });
    }
  };
  addEventListener(
    "scroll",
    (e) => {
      if (e.timeStamp - lastScroll < SCROLL_EVERY) return;
      lastScroll = e.timeStamp;
      const dir = Math.sign(scrollY - lastY);
      lastY = scrollY;
      if (dir) stir(dir);
    },
    { passive: true },
  );
  // a wheel at the top or bottom of the page scrolls nothing, but still stirs
  addEventListener(
    "wheel",
    (e) => {
      if (e.timeStamp - lastScroll < SCROLL_EVERY) return;
      const atEdge = (e.deltaY < 0 && scrollY <= 0) || (e.deltaY > 0 && innerHeight + scrollY >= document.documentElement.scrollHeight - 1);
      if (!atEdge) return;
      lastScroll = e.timeStamp;
      stir(Math.sign(e.deltaY));
    },
    { passive: true },
  );

  // keyboard focus gets a ring of light around what it landed on
  addEventListener("focusin", (e) => {
    const el = e.target;
    if (!(el instanceof Element) || !el.matches(":focus-visible") || el.matches("textarea")) return;
    const r = el.getBoundingClientRect();
    const pal = paletteOf(el);
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    if (reducedMotion.matches) return still(cx, cy, pal, Math.min(40, r.width / 2));
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU;
      add({ x: cx + (Math.cos(a) * r.width) / 2, y: cy + (Math.sin(a) * r.height) / 2, vx: Math.cos(a) * 20, vy: Math.sin(a) * 20, life: 0.6, r: 1.8, rgb: i % 2 ? pal.a : pal.c });
    }
  });

  // ---------------------------------------------------------------- loop

  function wake() {
    if (running || document.hidden) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalCompositeOperation = "lighter";

    parts = parts.filter((p) => (p.age += dt) < p.life);
    for (const p of parts) {
      const k = p.age / p.life;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy = p.vy * Math.exp(-p.drag * dt) + p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.shape === "ring") {
        ctx.strokeStyle = rgba(p.rgb, 0.55 * (1 - k));
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r0 + (p.r1 - p.r0) * (1 - (1 - k) ** 3), 0, TAU);
        ctx.stroke();
      } else if (p.shape === "glow") {
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.drawImage(glowSprite(p.rgb, 64), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = 1;
      } else if (p.shape === "star") {
        // the model's particles: four-pointed glints, not round motes
        const s = p.r * (1 - k * 0.6);
        ctx.fillStyle = rgba(p.rgb, 0.9 * (1 - k));
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - s * 2);
        ctx.lineTo(p.x + s * 0.4, p.y);
        ctx.lineTo(p.x, p.y + s * 2);
        ctx.lineTo(p.x - s * 0.4, p.y);
        ctx.closePath();
        ctx.moveTo(p.x - s * 2, p.y);
        ctx.lineTo(p.x, p.y + s * 0.4);
        ctx.lineTo(p.x + s * 2, p.y);
        ctx.lineTo(p.x, p.y - s * 0.4);
        ctx.closePath();
        ctx.fill();
      } else {
        const a = (1 - k) * (k < 0.15 ? k / 0.15 : 1);
        const r = p.r * 3.2;
        ctx.globalAlpha = a * 0.8;
        ctx.drawImage(glowSprite(p.rgb, 32), p.x - r, p.y - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
      }
    }

    strands = strands.filter((s) => (s.age += dt) < s.life);
    for (const s of strands) drawStrand(s);

    ctx.globalCompositeOperation = "source-over";
    if (parts.length || strands.length) requestAnimationFrame(frame);
    else {
      ctx.clearRect(0, 0, W, H);
      running = false;
    }
  }

  function strandPoint(s, u) {
    const [x0, y0] = s.from();
    const [x1, y1] = s.to();
    const mx = (x0 + x1) / 2;
    const my = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.22 - 30;
    const v = 1 - u;
    return [v * v * x0 + 2 * v * u * mx + u * u * x1, v * v * y0 + 2 * v * u * my + u * u * y1];
  }

  function drawStrand(s) {
    const k = s.age / s.life;
    const fade = Math.min(1, k * 5) * Math.min(1, (1 - k) * 3);
    // the thread itself, faint
    ctx.strokeStyle = rgba(mixRgb(s.colours[0], ORACLE.a, 0.5), 0.12 * fade);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const [x, y] = strandPoint(s, i / 24);
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
    // and the motes travelling along it, each in the colour of a fragment it carries
    for (let i = 0; i < s.n; i++) {
      const u = (k * 1.6 - i / s.n) % 1;
      if (u < 0 || u > 1) continue;
      const [x, y] = strandPoint(s, u);
      const rgb = mixRgb(s.colours[i % s.colours.length], ORACLE.c, u);
      ctx.globalAlpha = fade * 0.9;
      ctx.drawImage(glowSprite(rgb, 32), x - 6, y - 6, 12, 12);
    }
    ctx.globalAlpha = 1;
  }

  addEventListener("resize", resize);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      parts = [];
      strands = [];
    }
  });
  resize();

  return {
    /** A thought arriving, being touched, or let go: a burst in its own colours. */
    burst(x, y, kind, n = 14) {
      const pal = META[kind] ?? NEUTRAL;
      if (reducedMotion.matches) return still(x, y, pal, 26);
      ring(x, y, pal, { r: 36, life: 0.7 });
      burst(x, y, pal, n, 120);
    },
    /** The model's glints, rising off a new model thought. */
    glint(x, y, n = 8) {
      if (reducedMotion.matches) return still(x, y, ORACLE, 22);
      star(x, y, { n });
    },
    /**
     * Light travelling from the human orb to the model's, carrying the colours
     * of the fragments the model was actually shown. Endpoints are functions,
     * so the strand follows the orbs while the page scrolls.
     */
    strand(from, to, colours) {
      if (reducedMotion.matches || !colours.length) return;
      if (strands.length >= 2) strands.shift();
      strands.push({ from, to, colours, n: Math.min(10, 3 + colours.length * 2), age: 0, life: 2.6 });
      wake();
    },
    get count() {
      return parts.length;
    },
  };
}
