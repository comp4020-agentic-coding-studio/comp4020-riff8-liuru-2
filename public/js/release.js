// Letting go: the words in the composer come apart the way their as-if does,
// gather into one small light, and that light travels down into the orb.

import { META, rgba } from "./kinds.js";
import { TAU, boltPath, clamp, drawBolt, easeInOut, easeOut, glowSprite, lerp, mixRgb, rand, reducedMotion } from "./util.js";

const DISSOLVE = 1.5; // seconds
const FLIGHT = 1.35;

/** Where each visible character of the textarea sits on screen, via a hidden mirror of it. */
function measureGlyphs(textarea) {
  const cs = getComputedStyle(textarea);
  const rect = textarea.getBoundingClientRect();
  const mirror = document.createElement("div");
  for (const prop of [
    "boxSizing",
    "width",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "wordSpacing",
    "textIndent",
  ]) {
    mirror.style[prop] = cs[prop];
  }
  Object.assign(mirror.style, {
    position: "fixed",
    left: `${rect.left}px`,
    top: `${rect.top - textarea.scrollTop}px`,
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    borderStyle: "solid",
    pointerEvents: "none",
  });
  const seg = "Segmenter" in Intl ? [...new Intl.Segmenter().segment(textarea.value)].map((s) => s.segment) : Array.from(textarea.value);
  const spans = seg.map((ch) => {
    const span = document.createElement("span");
    span.textContent = ch;
    mirror.append(span);
    return span;
  });
  document.body.append(mirror);
  const glyphs = [];
  spans.forEach((span, i) => {
    const ch = seg[i];
    if (!ch.trim()) return;
    const r = span.getBoundingClientRect();
    // keep only what the visitor could actually see inside the box
    if (r.bottom < rect.top || r.top > rect.bottom) return;
    glyphs.push({ ch, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height });
  });
  mirror.remove();
  return { glyphs, font: `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, rect };
}

function overlay() {
  const canvas = document.createElement("canvas");
  canvas.className = "release-layer";
  canvas.setAttribute("aria-hidden", "true");
  document.body.append(canvas);
  const dpr = Math.min(devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { canvas, ctx };
}

/** The single small light a thought becomes, drawn in its own kind's manner. */
export function drawEssence(ctx, kind, x, y, r, t, alpha = 1) {
  const m = META[kind];
  ctx.save();
  ctx.globalAlpha = alpha;
  switch (kind) {
    case "bubble": {
      const g = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      g.addColorStop(0, rgba(m.a));
      g.addColorStop(0.5, "rgba(255,243,176,0.8)");
      g.addColorStop(1, rgba(m.c));
      ctx.fillStyle = rgba(m.a, 0.12);
      ctx.strokeStyle = g;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(x, y, r * (1 + 0.05 * Math.sin(t * 9)), r * (1 - 0.05 * Math.sin(t * 9)), 0, 0, TAU);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.beginPath();
      ctx.ellipse(x - r * 0.4, y - r * 0.4, r * 0.22, r * 0.12, -0.7, 0, TAU);
      ctx.fill();
      break;
    }
    case "shadow": {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      g.addColorStop(0, "rgba(2,0,6,0.95)");
      g.addColorStop(0.45, "rgba(10,3,20,0.7)");
      g.addColorStop(1, "rgba(2,0,6,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r * 2.4, y - r * 2.4, r * 4.8, r * 4.8);
      ctx.strokeStyle = rgba(m.a, 0.9);
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, r * 0.7, 0, TAU);
      ctx.stroke();
      break;
    }
    case "illusion": {
      ctx.globalCompositeOperation = "lighter";
      const s = r * 0.45 * (1 + 0.4 * Math.sin(t * 7));
      ctx.drawImage(glowSprite(m.a, 64), x - s - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      ctx.drawImage(glowSprite(m.c, 64), x + s - r * 1.4, y - r * 1.4, r * 2.8, r * 2.8);
      ctx.drawImage(glowSprite([255, 255, 255], 64), x - r, y - r, r * 2, r * 2);
      break;
    }
    case "dew": {
      const g = ctx.createRadialGradient(x, y + r * 0.3, 0, x, y, r);
      g.addColorStop(0, rgba(mixRgb(m.a, m.c, 0.4), 0.9));
      g.addColorStop(1, rgba(m.a, 0.95));
      ctx.fillStyle = g;
      ctx.beginPath();
      // a drop, pointed upward
      ctx.moveTo(x, y - r * 1.6);
      ctx.bezierCurveTo(x + r * 0.9, y - r * 0.5, x + r, y + r, x, y + r);
      ctx.bezierCurveTo(x - r, y + r, x - r * 0.9, y - r * 0.5, x, y - r * 1.6);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(x - r * 0.35, y + r * 0.05, r * 0.22, 0, TAU);
      ctx.fill();
      break;
    }
    case "lightning": {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowSprite(m.a, 64), x - r * 2, y - r * 2, r * 4, r * 4);
      ctx.fillStyle = "rgba(255,255,240,1)";
      ctx.beginPath();
      ctx.arc(x, y, r * 0.35, 0, TAU);
      ctx.fill();
      if (!reducedMotion.matches && Math.random() < 0.5) {
        const a = rand(0, TAU);
        drawBolt(ctx, boltPath(x, y, x + Math.cos(a) * r * 2.2, y + Math.sin(a) * r * 2.2, 0.5, 3), m.c, 0.8, 0.8);
      }
      break;
    }
    default: {
      ctx.globalCompositeOperation = "lighter";
      ctx.drawImage(glowSprite(m.c, 64), x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
      ctx.drawImage(glowSprite(m.a, 64), x - r, y - r, r * 2, r * 2);
    }
  }
  ctx.restore();
}

/**
 * Starts the release of what's written in `textarea` as `kind`. Returns
 * `dissolved` (resolves once the words have become one light), then `fly`
 * (carry that light to wherever `target()` says the orb is) or `restore`
 * (the post failed: give the words back).
 */
export function startRelease(textarea, kind) {
  const m = META[kind];
  textarea.classList.add("released");

  if (reducedMotion.matches) {
    // no flight, no particles: the words simply go quiet
    return {
      dissolved: new Promise((r) => setTimeout(r, 350)),
      fly: async () => {},
      restore: () => textarea.classList.remove("released"),
      essenceAt: null,
    };
  }

  const { glyphs, font, rect } = measureGlyphs(textarea);
  const { canvas, ctx } = overlay();
  const n = Math.max(1, glyphs.length);
  const bx = glyphs.reduce((s, g) => s + g.x, 0) / n || rect.left + rect.width / 2;
  const by = glyphs.reduce((s, g) => s + g.y, 0) / n || rect.top + rect.height / 2;
  // where the light gathers: shadows sink, bubbles rise, dew falls
  const E = {
    dream: [bx, by - 30],
    illusion: [bx, by],
    bubble: [bx, by - 50],
    shadow: [bx, rect.bottom + 10],
    dew: [bx, rect.bottom - 6],
    lightning: [bx, by],
  }[kind];
  const essence = { x: E[0], y: E[1], r: 0 };
  for (const [i, g] of glyphs.entries()) {
    g.i = i;
    g.delay = (i / n) * 0.35;
    g.rx = rand(-1, 1);
    g.ry = rand(-1, 1);
    g.ph = rand(0, TAU);
  }
  let extras = []; // smoke, sparks, ghosts: whatever the kind throws off
  let raf = 0;
  let t0 = performance.now();
  let mode = "dissolve";
  let flight = null;
  let doneDissolve;
  const dissolved = new Promise((r) => (doneDissolve = r));

  const glyph = (g, x, y, alpha, rgb = [236, 230, 245], sx = 1, sy = 1) => {
    if (alpha <= 0.01) return;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sx, sy);
    ctx.font = font;
    ctx.fillStyle = rgba(rgb, alpha);
    ctx.fillText(g.ch, 0, 0);
    ctx.restore();
  };

  function drawDissolve(T) {
    const k = clamp(T / DISSOLVE, 0, 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const local = (g) => clamp((k - g.delay) / (1 - 0.35), 0, 1);
    switch (kind) {
      case "dream": {
        // each word lifts, loses its edges, and becomes a mote that drifts to the gathering light
        for (const g of glyphs) {
          const u = local(g);
          const lift = easeOut(Math.min(1, u * 1.6));
          const gather = easeInOut(clamp((u - 0.45) / 0.55, 0, 1));
          const x0 = g.x + Math.sin(g.ph + u * 4) * 14 * lift;
          const y0 = g.y - 40 * lift;
          const x = lerp(x0, E[0], gather);
          const y = lerp(y0, E[1], gather);
          glyph(g, x, y, 1 - Math.min(1, u * 2.2), mixRgb([236, 230, 245], m.a, lift));
          ctx.globalCompositeOperation = "lighter";
          ctx.globalAlpha = Math.min(1, u * 3) * (1 - gather * 0.7);
          ctx.drawImage(glowSprite(m.c, 32), x - 9, y - 9, 18, 18);
          ctx.globalAlpha = 1;
          ctx.globalCompositeOperation = "source-over";
        }
        essence.r = 10 * easeOut(clamp((k - 0.6) / 0.4, 0, 1));
        break;
      }
      case "illusion": {
        // three copies part, waver, then all fall into one point
        for (const g of glyphs) {
          const u = local(g);
          const spread = Math.sin(Math.min(1, u * 1.8) * Math.PI * 0.5) * 16 * (1 - clamp((u - 0.55) / 0.45, 0, 1));
          const col = easeInOut(clamp((u - 0.5) / 0.5, 0, 1));
          const x = lerp(g.x, E[0], col);
          const y = lerp(g.y, E[1], col);
          const sc = 1 - col * 0.8;
          ctx.globalCompositeOperation = "lighter";
          glyph(g, x - spread, y + g.ry * spread * 0.3, 0.75 * (1 - col * 0.6), m.a, sc, sc);
          glyph(g, x + spread, y - g.ry * spread * 0.3, 0.75 * (1 - col * 0.6), m.c, sc, sc);
          glyph(g, x, y, 1 - Math.min(1, u * 1.4), [255, 255, 255], sc, sc);
          ctx.globalCompositeOperation = "source-over";
        }
        essence.r = 9 * easeOut(clamp((k - 0.8) / 0.2, 0, 1));
        break;
      }
      case "bubble": {
        // a bubble blooms around the words, takes them in, and lifts away smaller
        const minX = Math.min(...glyphs.map((g) => g.x)) - 20;
        const maxX = Math.max(...glyphs.map((g) => g.x)) + 20;
        const R0 = clamp((maxX - minX) / 2, 40, 260);
        const grow = easeOut(clamp(k / 0.4, 0, 1));
        const shrink = easeInOut(clamp((k - 0.45) / 0.55, 0, 1));
        const cx = bx;
        const cy = lerp(by, E[1], shrink);
        const rr = lerp(R0 * grow, 12, shrink);
        for (const g of glyphs) {
          const pull = easeInOut(clamp((k - 0.25) / 0.6, 0, 1));
          const x = lerp(g.x, cx + (g.x - bx) * (rr / R0) * 0.6, pull);
          const y = lerp(g.y, cy + (g.y - by) * (rr / R0) * 0.6, pull);
          const sc = lerp(1, 0.15, pull);
          glyph(g, x, y, 1 - pull * 0.9, mixRgb([236, 230, 245], m.a, pull), sc, sc);
        }
        if (rr > 0.5) drawEssence(ctx, "bubble", cx, cy, rr, T, Math.min(1, grow * 1.2));
        essence.x = cx;
        essence.y = cy;
        essence.r = shrink >= 1 ? 12 : 0;
        break;
      }
      case "shadow": {
        // the words lengthen, fall into smoke, and are drawn downward
        for (const g of glyphs) {
          const u = local(g);
          const stretch = 1 + easeInOut(u) * 2.6;
          const sink = easeInOut(u) * (E[1] - g.y) * 0.85;
          const x = lerp(g.x, E[0], easeInOut(clamp((u - 0.4) / 0.6, 0, 1)));
          glyph(g, x, g.y + sink, 1 - u, mixRgb([236, 230, 245], [40, 20, 60], u), 1 - u * 0.4, stretch);
          if (u > 0.05 && u < 0.9 && Math.random() < 0.18) extras.push({ x, y: g.y + sink, vx: rand(-10, 10), vy: rand(20, 60), r: rand(10, 26), age: 0, life: rand(0.6, 1.1) });
        }
        essence.r = 11 * easeOut(clamp((k - 0.65) / 0.35, 0, 1));
        break;
      }
      case "dew": {
        // each character condenses into a bead, the beads run down and pool
        for (const g of glyphs) {
          const u = local(g);
          const cond = easeOut(clamp(u / 0.35, 0, 1));
          const fall = clamp((u - 0.35) / 0.65, 0, 1);
          const x = lerp(g.x, E[0], easeInOut(fall));
          const y = lerp(g.y, E[1], fall * fall);
          glyph(g, g.x, g.y, 1 - cond, [236, 230, 245]);
          if (cond > 0 && fall < 0.98) {
            const r = 1 + cond * 3.2;
            ctx.fillStyle = rgba(m.a, 0.85);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, TAU);
            ctx.fill();
            ctx.fillStyle = "rgba(255,255,255,0.9)";
            ctx.beginPath();
            ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.3, 0, TAU);
            ctx.fill();
          }
        }
        essence.r = 9 * easeOut(clamp((k - 0.75) / 0.25, 0, 1));
        break;
      }
      case "lightning": {
        // a current runs through the letters in order, they discharge, the sparks are pulled to one point
        const trace = clamp(k / 0.4, 0, 1);
        const reach = Math.floor(trace * glyphs.length);
        if (trace < 1 && reach > 0) {
          const pts = glyphs.slice(0, reach + 1).map((g) => [g.x + rand(-3, 3), g.y + rand(-6, 6)]);
          drawBolt(ctx, pts, m.c, 0.9, 1.3);
        }
        for (const g of glyphs) {
          const hitAt = (g.i / n) * 0.4;
          const since = k - hitAt;
          if (since < 0) glyph(g, g.x, g.y, 1);
          else if (since < 0.12) {
            glyph(g, g.x, g.y, 1, [255, 250, 200]);
            if (!g.burst) {
              g.burst = true;
              for (let i = 0; i < 3; i++) extras.push({ x: g.x, y: g.y, vx: rand(-120, 120), vy: rand(-120, 60), age: 0, life: rand(0.7, 1.0), spark: true });
            }
          }
        }
        essence.r = 10 * easeOut(clamp((k - 0.7) / 0.3, 0, 1));
        break;
      }
    }

    // what the kind threw off: smoke falls, sparks are reeled in
    const dt = 1 / 60;
    extras = extras.filter((p) => {
      p.age += dt;
      if (p.spark) {
        const pull = clamp((p.age - 0.3) / 0.5, 0, 1);
        p.vx *= 0.94;
        p.vy *= 0.94;
        p.x = lerp(p.x + p.vx * dt, E[0], pull * 0.15);
        p.y = lerp(p.y + p.vy * dt, E[1], pull * 0.15);
        ctx.fillStyle = rgba(Math.random() < 0.3 ? [255, 255, 255] : m.a, 1 - p.age / p.life);
        ctx.fillRect(p.x, p.y, 2, 2);
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = Math.sin((p.age / p.life) * Math.PI) * 0.4;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(4,1,10,${a})`);
        g.addColorStop(0.7, rgba(m.a, a * 0.12));
        g.addColorStop(1, "rgba(4,1,10,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      return p.age < p.life;
    });

    return k >= 1;
  }

  function drawFlight(T) {
    const k = clamp(T / FLIGHT, 0, 1);
    const [tx, ty] = flight.target();
    const e = easeInOut(k);
    // an arc, not a straight line: it falls, swings out, and comes in from the side
    const c1x = lerp(flight.x0, tx, 0.1) + flight.swing;
    const c1y = lerp(flight.y0, ty, 0.5);
    const x = (1 - e) ** 2 * flight.x0 + 2 * (1 - e) * e * c1x + e * e * tx;
    const y = (1 - e) ** 2 * flight.y0 + 2 * (1 - e) * e * c1y + e * e * ty;
    flight.trail.push([x, y]);
    if (flight.trail.length > 18) flight.trail.shift();
    ctx.globalCompositeOperation = "lighter";
    flight.trail.forEach(([px, py], i) => {
      const a = (i / flight.trail.length) * 0.5;
      const r = 3 + (i / flight.trail.length) * 8;
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(kind === "shadow" ? m.a : m.c, 32), px - r, py - r, r * 2, r * 2);
    });
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    const r = lerp(essence.r || 10, 7, e) * (1 + Math.sin(k * Math.PI) * 0.3);
    drawEssence(ctx, kind, x, y, r, T, 1 - clamp((k - 0.92) / 0.08, 0, 1));
    return k >= 1;
  }

  function frame(now) {
    const T = (now - t0) / 1000;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    if (mode === "dissolve") {
      const done = drawDissolve(T);
      if (essence.r > 0.3 && kind !== "bubble") drawEssence(ctx, kind, essence.x, essence.y, essence.r, T);
      if (done) {
        mode = "hold";
        doneDissolve();
      }
    } else if (mode === "hold") {
      // waiting on the server: the light breathes where it gathered
      drawDissolve(DISSOLVE);
      if (kind !== "bubble") drawEssence(ctx, kind, essence.x, essence.y, (essence.r || 10) * (1 + 0.12 * Math.sin(T * 5)), T);
    } else if (mode === "fly") {
      if (drawFlight(T)) {
        cancelAnimationFrame(raf);
        canvas.remove();
        flight.done();
        return;
      }
    } else if (mode === "back") {
      const k = clamp(T / 0.5, 0, 1);
      drawEssence(ctx, kind, essence.x, essence.y, (essence.r || 10) * (1 - k), T, 1 - k);
      if (k >= 1) {
        canvas.remove();
        return;
      }
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    dissolved,
    fly(target) {
      return new Promise((done) => {
        if (!essence.r) essence.r = 10;
        flight = { x0: essence.x, y0: essence.y, target, done, trail: [], swing: (Math.random() < 0.5 ? -1 : 1) * Math.min(260, innerWidth * 0.25) };
        mode = "fly";
        t0 = performance.now();
      });
    },
    restore() {
      mode = "back";
      t0 = performance.now();
      textarea.classList.remove("released");
    },
  };
}
