// The six cards. Each one is its own small weather system on a canvas, with
// its own physics, not one effect recoloured six times.

import * as audio from "./audio.js";
import { META, rgba } from "./kinds.js";
import { TAU, approach, boltPath, clamp, drawBolt, fitCanvas, glowSprite, mixRgb, noise2, rand, reducedMotion } from "./util.js";

const RENDERERS = { dream, illusion, bubble, shadow, dew, lightning };

export function initCards(root, { onSelect }) {
  let keyboardInput = false;
  const cards = [...root.querySelectorAll(".card")].map((el) => {
    const kind = el.dataset.kind;
    const canvas = el.querySelector("canvas");
    const s = {
      kind,
      el,
      canvas,
      ctx: canvas.getContext("2d"),
      w: 0,
      h: 0,
      t: rand(0, 100),
      px: 0,
      py: 0,
      inside: false,
      hover: 0,
      lastMove: 0,
      speed: 0,
      visible: true,
      selected: false,
      calm: false,
    };
    s.r = RENDERERS[kind](s);
    return s;
  });

  const resize = () =>
    cards.forEach((s) => {
      const { w, h } = fitCanvas(s.canvas, 1.5);
      const first = s.w === 0;
      s.w = w;
      s.h = h;
      if (first) s.r.seed?.();
    });

  for (const s of cards) {
    const input = s.el.querySelector("input");
    s.el.addEventListener("pointerenter", (e) => {
      s.inside = true;
      if (e.pointerType === "mouse") audio.play(s.kind, "hover", 0.35);
    });
    s.el.addEventListener("pointerleave", () => {
      s.inside = false;
      s.el.style.setProperty("--rx", "0deg");
      s.el.style.setProperty("--ry", "0deg");
      s.el.style.setProperty("--px", "0");
      s.el.style.setProperty("--py", "0");
    });
    s.el.addEventListener("pointermove", (e) => {
      const rect = s.el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const now = performance.now();
      const dt = Math.max(1, now - s.lastMove);
      s.speed = Math.hypot(x - s.px, y - s.py) / dt;
      s.lastMove = now;
      s.px = x;
      s.py = y;
      const nx = (x / rect.width) * 2 - 1;
      const ny = (y / rect.height) * 2 - 1;
      s.el.style.setProperty("--px", nx.toFixed(3));
      s.el.style.setProperty("--py", ny.toFixed(3));
      if (!reducedMotion.matches) {
        s.el.style.setProperty("--rx", `${(-ny * 7).toFixed(2)}deg`);
        s.el.style.setProperty("--ry", `${(nx * 9).toFixed(2)}deg`);
      }
      s.r.move?.(x, y);
    });
    s.el.addEventListener("pointerdown", (e) => {
      const rect = s.el.getBoundingClientRect();
      s.px = e.clientX - rect.left;
      s.py = e.clientY - rect.top;
      if (!s.calm) s.r.poke?.(s.px, s.py);
    });
    input.addEventListener("change", () => {
      if (!input.checked) return;
      audio.play(s.kind, "select", 0.05);
      if (keyboardInput && !s.calm) s.r.poke?.(s.w / 2, s.h / 2);
      onSelect(s.kind);
    });
    input.addEventListener("focus", () => s.el.classList.add("hot"));
    input.addEventListener("blur", () => s.el.classList.remove("hot"));
  }

  // keyboard selection (arrow keys in the radio group) pokes the card from its centre
  root.addEventListener("keydown", () => (keyboardInput = true));
  root.addEventListener("pointerdown", () => (keyboardInput = false));

  const io = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const s = cards.find((c) => c.el === entry.target);
      if (s) s.visible = entry.isIntersecting;
    }
  });
  cards.forEach((s) => io.observe(s.el));

  addEventListener("resize", resize);
  resize();

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // reduced motion keeps each card's weather, slowed right down, and drops
    // everything sudden: no bursts, pops, ghosts or arcs
    const calm = reducedMotion.matches;
    for (const s of cards) {
      if (!s.visible || s.w === 0) continue;
      s.selected = s.el.querySelector("input").checked;
      s.hover = approach(s.hover, s.inside || s.el.classList.contains("hot") ? 1 : 0, dt, 0.25);
      s.calm = calm;
      const d = calm ? dt * 0.25 : dt;
      s.t += d;
      s.r.step(d);
      const dpr = s.canvas.width / s.w;
      s.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      s.ctx.clearRect(0, 0, s.w, s.h);
      s.r.draw(s.ctx);
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    select(kind) {
      const s = cards.find((c) => c.kind === kind);
      if (s) s.r.poke?.(s.w / 2, s.h / 2);
    },
  };
}

/* ---------------- Dream: drifting light, slow cloud, a pull toward you ---------------- */

function dream(s) {
  const m = META.dream;
  let motes = [];
  let clouds = [];
  const seed = () => {
    motes = Array.from({ length: 30 }, () => ({ x: rand(0, s.w), y: rand(0, s.h), vx: 0, vy: 0, r: rand(0.6, 2), ph: rand(0, TAU) }));
    clouds = Array.from({ length: 5 }, (_, i) => ({ x: rand(0, s.w), y: rand(s.h * 0.2, s.h * 0.9), r: rand(60, 120), sp: rand(3, 8) * (i % 2 ? 1 : -1) }));
  };
  return {
    seed,
    step(dt) {
      for (const c of clouds) {
        c.x += c.sp * dt * (1 + s.hover * 1.5);
        if (c.x > s.w + c.r) c.x = -c.r;
        if (c.x < -c.r) c.x = s.w + c.r;
      }
      for (const p of motes) {
        // a gentle pull toward the pointer, with a swirl, so they orbit rather than stick
        if (s.hover > 0.05) {
          const dx = s.px - p.x;
          const dy = s.py - p.y;
          const d = Math.hypot(dx, dy) + 30;
          p.vx += ((dx / d) * 22 - (dy / d) * 16) * s.hover * dt;
          p.vy += ((dy / d) * 22 + (dx / d) * 16) * s.hover * dt;
        }
        p.vx = approach(p.vx, 0, dt, 1.4);
        p.vy = approach(p.vy, -6, dt, 1.4);
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.y < -6) {
          p.y = s.h + 6;
          p.x = rand(0, s.w);
        }
        if (p.x < -10) p.x = s.w + 10;
        if (p.x > s.w + 10) p.x = -10;
      }
    },
    draw(ctx) {
      ctx.globalCompositeOperation = "lighter";
      const cloud = glowSprite(m.b.map((v) => v * 2.2), 96);
      ctx.globalAlpha = 0.28 + 0.15 * s.hover;
      for (const c of clouds) ctx.drawImage(cloud, c.x - c.r, c.y - c.r * 0.55, c.r * 2, c.r * 1.1);
      const star = glowSprite(m.c, 32);
      for (const p of motes) {
        const tw = 0.5 + 0.5 * Math.sin(s.t * 1.7 + p.ph);
        ctx.globalAlpha = 0.35 + 0.6 * tw;
        const r = p.r * (5 + 3 * s.hover);
        ctx.drawImage(star, p.x - r, p.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    },
    poke(x, y) {
      for (let i = 0; i < 14; i++) {
        const a = rand(0, TAU);
        const v = rand(20, 70);
        motes.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(0.6, 1.8), ph: rand(0, TAU) });
      }
      motes = motes.slice(-60);
    },
  };
}

/* ---------------- Illusion: interfering rings and false copies ---------------- */

function illusion(s) {
  const m = META.illusion;
  let ghosts = [];
  let spawnIn = 0;
  let split = 0;
  return {
    step(dt) {
      split = approach(split, s.hover * (4 + Math.min(10, s.speed * 6)), dt, 0.2);
      spawnIn -= dt;
      if (s.inside && spawnIn <= 0 && !s.calm) {
        spawnIn = rand(0.1, 0.22);
        ghosts.push({ x: s.px + rand(-30, 30), y: s.py + rand(-24, 24), age: 0, life: rand(0.5, 0.9), rgb: Math.random() < 0.5 ? m.a : m.c, size: rand(18, 40), skew: rand(-0.4, 0.4), dx: rand(-30, 30) });
      }
      ghosts = ghosts.filter((g) => (g.age += dt) < g.life);
      for (const g of ghosts) g.x += g.dx * dt;
    },
    draw(ctx) {
      const cx = s.w * 0.62 + (s.inside ? (s.px - s.w * 0.62) * 0.35 : 0);
      const cy = s.h * 0.42 + (s.inside ? (s.py - s.h * 0.42) * 0.35 : 0);
      const phase = (s.t * 9) % 12;
      ctx.lineWidth = 1;
      ctx.globalCompositeOperation = "lighter";
      [
        [m.a, -split, 0],
        [m.c, split, 0.6],
      ].forEach(([rgb, off, twist]) => {
        ctx.strokeStyle = rgba(rgb, 0.22 + 0.15 * s.hover);
        for (let r = phase; r < s.w; r += 12) {
          ctx.beginPath();
          ctx.ellipse(cx + off, cy, r, r * (0.92 + 0.08 * Math.sin(s.t * 0.7 + twist)), s.t * 0.1 + twist, 0, TAU);
          ctx.stroke();
        }
      });
      ctx.font = `40px "Ma Shan Zheng", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const g of ghosts) {
        const a = Math.sin((g.age / g.life) * Math.PI) * 0.6;
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.transform(1, 0, g.skew, 1, 0, 0);
        ctx.font = `${g.size}px "Ma Shan Zheng", serif`;
        ctx.fillStyle = rgba(g.rgb, a);
        ctx.fillText(META.illusion.hanzi, 0, 0);
        ctx.restore();
      }
      ctx.globalCompositeOperation = "source-over";
    },
    poke(x, y) {
      split = 22;
      for (let i = 0; i < 6; i++) ghosts.push({ x: x + rand(-50, 50), y: y + rand(-40, 40), age: 0, life: rand(0.5, 1), rgb: i % 2 ? m.a : m.c, size: rand(24, 56), skew: rand(-0.5, 0.5), dx: rand(-60, 60) });
    },
  };
}

/* ---------------- Bubble: rising, shying away, popping when touched ---------------- */

function bubble(s) {
  const m = META.bubble;
  let bubbles = [];
  let bursts = [];
  const make = (y) => ({ x: rand(10, s.w - 10), y: y ?? s.h + rand(10, 60), r: rand(5, 18), vx: 0, vy: rand(-26, -12), ph: rand(0, TAU) });
  const popAt = (b, sound) => {
    bursts.push({ x: b.x, y: b.y, r: b.r, age: 0, drops: Array.from({ length: 7 }, () => [rand(0, TAU), rand(30, 80)]) });
    if (sound) audio.play("bubble", "pop", 0.06);
    Object.assign(b, make());
  };
  return {
    seed: () => (bubbles = Array.from({ length: 14 }, () => make(rand(0, s.h)))),
    step(dt) {
      for (const b of bubbles) {
        b.vx += Math.sin(s.t * 1.3 + b.ph) * 8 * dt;
        if (s.inside) {
          const dx = b.x - s.px;
          const dy = b.y - s.py;
          const d = Math.hypot(dx, dy);
          // a slow hand nudges them; a quick one catches and pops them
          if (d < b.r + 4 && s.speed > 0.25 && !s.calm) popAt(b, true);
          else if (d < 70) {
            b.vx += (dx / (d + 1)) * 120 * dt;
            b.vy += (dy / (d + 1)) * 80 * dt;
          }
        }
        b.vx = approach(b.vx, 0, dt, 0.8);
        b.vy = approach(b.vy, -18 - b.r, dt, 1.2);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.y < -b.r) {
          if (Math.random() < 0.5) popAt({ ...b, y: 4 }, false);
          Object.assign(b, make());
        }
      }
      bursts = bursts.filter((p) => (p.age += dt) < 0.45);
    },
    draw(ctx) {
      for (const b of bubbles) {
        const wob = 1 + Math.sin(s.t * 4 + b.ph) * 0.05;
        const g = ctx.createLinearGradient(b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r);
        const h = s.t * 0.4 + b.ph;
        g.addColorStop(0, rgba(mixRgb(m.a, m.c, 0.5 + 0.5 * Math.sin(h)), 0.85));
        g.addColorStop(0.5, rgba([255, 243, 176], 0.5));
        g.addColorStop(1, rgba(mixRgb(m.c, [180, 200, 255], 0.5 + 0.5 * Math.cos(h)), 0.85));
        ctx.fillStyle = rgba(m.a, 0.05);
        ctx.strokeStyle = g;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.ellipse(b.x, b.y, b.r * wob, b.r / wob, 0, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.beginPath();
        ctx.ellipse(b.x - b.r * 0.38, b.y - b.r * 0.42, b.r * 0.22, b.r * 0.12, -0.7, 0, TAU);
        ctx.fill();
      }
      for (const p of bursts) {
        const k = p.age / 0.45;
        ctx.strokeStyle = rgba(m.a, 0.6 * (1 - k));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 + k * 0.8), 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba(m.c, 0.8 * (1 - k));
        for (const [a, v] of p.drops) ctx.fillRect(p.x + Math.cos(a) * v * k, p.y + Math.sin(a) * v * k + 30 * k * k, 2, 2);
      }
    },
    poke(x, y) {
      let best = null;
      let bd = Infinity;
      for (const b of bubbles) {
        const d = Math.hypot(b.x - x, b.y - y) - b.r;
        if (d < bd) [best, bd] = [b, d];
      }
      if (best && bd < 40) popAt(best, true);
      for (let i = 0; i < 3; i++) bubbles.push({ ...make(), x: x + rand(-20, 20), y: y + rand(-10, 10), r: rand(4, 10) });
      bubbles = bubbles.slice(-22);
    },
  };
}

/* ---------------- Shadow: smoke on a slow current, and a darkness that follows ---------------- */

function shadow(s) {
  const m = META.shadow;
  let wisps = [];
  const follower = { x: 0, y: 0 };
  return {
    seed() {
      wisps = Array.from({ length: 26 }, () => ({ x: rand(0, s.w), y: rand(0, s.h), r: rand(40, 90), vx: 0, vy: 0 }));
      follower.x = s.w * 0.7;
      follower.y = s.h * 0.4;
    },
    step(dt) {
      const tx = s.inside ? s.px : s.w * 0.7 + Math.sin(s.t * 0.3) * 30;
      const ty = s.inside ? s.py : s.h * 0.4 + Math.cos(s.t * 0.23) * 20;
      // it follows you, but always a little late
      follower.x = approach(follower.x, tx, dt, 0.9);
      follower.y = approach(follower.y, ty, dt, 0.9);
      for (const w of wisps) {
        const a = noise2(w.x * 0.008, w.y * 0.008 + s.t * 0.08) * TAU;
        w.vx = approach(w.vx, Math.cos(a) * 14, dt, 0.8);
        w.vy = approach(w.vy, Math.sin(a) * 10 - 6, dt, 0.8);
        if (s.hover > 0.05) {
          w.vx += (follower.x - w.x) * 0.25 * s.hover * dt;
          w.vy += (follower.y - w.y) * 0.25 * s.hover * dt;
        }
        w.x += w.vx * dt;
        w.y += w.vy * dt;
        if (w.y < -w.r) w.y = s.h + w.r;
        if (w.y > s.h + w.r) w.y = -w.r;
        if (w.x < -w.r) w.x = s.w + w.r;
        if (w.x > s.w + w.r) w.x = -w.r;
      }
    },
    draw(ctx) {
      const ember = ctx.createRadialGradient(s.w * 0.5, s.h * 1.05, 0, s.w * 0.5, s.h * 1.05, s.h * 0.9);
      ember.addColorStop(0, rgba(m.c, 0.35));
      ember.addColorStop(1, rgba(m.c, 0));
      ctx.fillStyle = ember;
      ctx.fillRect(0, 0, s.w, s.h);
      for (const w of wisps) {
        const g = ctx.createRadialGradient(w.x, w.y, 0, w.x, w.y, w.r);
        g.addColorStop(0, "rgba(3,1,6,0.34)");
        g.addColorStop(0.6, "rgba(24,10,34,0.14)");
        g.addColorStop(1, "rgba(3,1,6,0)");
        ctx.fillStyle = g;
        ctx.fillRect(w.x - w.r, w.y - w.r, w.r * 2, w.r * 2);
      }
      const r = 70 + 20 * s.hover;
      const fg = ctx.createRadialGradient(follower.x, follower.y + 8, 0, follower.x, follower.y + 8, r);
      fg.addColorStop(0, `rgba(0,0,0,${0.55 + 0.25 * s.hover})`);
      fg.addColorStop(0.7, rgba(m.a, 0.05 * s.hover));
      fg.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = fg;
      ctx.fillRect(follower.x - r, follower.y + 8 - r, r * 2, r * 2);
    },
    poke(x, y) {
      for (const w of wisps) {
        const dx = w.x - x;
        const dy = w.y - y;
        const d = Math.hypot(dx, dy) + 1;
        w.vx += (dx / d) * 160;
        w.vy += (dy / d) * 160;
      }
    },
  };
}

/* ---------------- Dew: beads gathering, sliding, catching your light ---------------- */

function dew(s) {
  const m = META.dew;
  let drops = [];
  let ripples = [];
  let rippleIn = 0;
  const make = () => ({ x: rand(8, s.w - 8), y: rand(8, s.h - 8), r: 0, max: rand(2.5, 7.5), vy: 0, trail: [] });
  return {
    seed: () => (drops = Array.from({ length: 22 }, () => ({ ...make(), r: rand(1, 6) }))),
    step(dt) {
      for (const d of drops) {
        if (d.r < d.max) d.r = Math.min(d.max, d.r + dt * 1.2);
        else if (d.max > 6 || d.vy > 0) {
          // only the heaviest beads let go and run
          d.vy = Math.min(70, d.vy + 40 * dt);
          d.y += d.vy * dt;
          d.x += Math.sin(d.y * 0.08) * 0.3;
          d.trail.push([d.x, d.y]);
          if (d.trail.length > 30) d.trail.shift();
        }
        if (d.y > s.h + 10) Object.assign(d, make());
      }
      rippleIn -= dt;
      if (s.inside && rippleIn <= 0 && s.speed > 0.05) {
        rippleIn = 0.28;
        ripples.push({ x: s.px, y: s.py, age: 0, life: 1.2 });
      }
      ripples = ripples.filter((r) => (r.age += dt) < r.life);
      if (drops.length < 22 && Math.random() < dt) drops.push(make());
    },
    draw(ctx) {
      const lx = s.inside ? s.px : s.w * 0.2;
      const ly = s.inside ? s.py : s.h * 0.1;
      for (const r of ripples) {
        const k = r.age / r.life;
        ctx.strokeStyle = rgba(m.a, 0.35 * (1 - k));
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(r.x, r.y, 8 + k * 50, (8 + k * 50) * 0.45, 0, 0, TAU);
        ctx.stroke();
      }
      for (const d of drops) {
        if (d.trail.length > 2) {
          ctx.strokeStyle = rgba(m.a, 0.12);
          ctx.lineWidth = d.r * 0.7;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(d.trail[0][0], d.trail[0][1]);
          for (const [x, y] of d.trail) ctx.lineTo(x, y);
          ctx.stroke();
        }
        if (d.r < 0.4) continue;
        const g = ctx.createRadialGradient(d.x, d.y + d.r * 0.4, 0, d.x, d.y, d.r);
        g.addColorStop(0, rgba(mixRgb(m.a, m.c, 0.4), 0.55));
        g.addColorStop(0.8, rgba(m.b.map((v) => v * 1.6), 0.5));
        g.addColorStop(1, rgba(m.a, 0.7));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, TAU);
        ctx.fill();
        // the highlight sits on the side facing the light, which is you
        const a = Math.atan2(ly - d.y, lx - d.x);
        ctx.fillStyle = `rgba(255,255,255,${0.6 + 0.3 * s.hover})`;
        ctx.beginPath();
        ctx.arc(d.x + Math.cos(a) * d.r * 0.45, d.y + Math.sin(a) * d.r * 0.45, Math.max(0.6, d.r * 0.22), 0, TAU);
        ctx.fill();
      }
    },
    poke(x, y) {
      ripples.push({ x, y, age: 0, life: 1.4 }, { x, y, age: -0.15, life: 1.4 });
      for (let i = 0; i < 3; i++) drops.push({ ...make(), x: x + rand(-25, 25), y: y + rand(-15, 15), r: rand(3, 6), max: 7, vy: 1 });
      drops = drops.slice(-30);
    },
  };
}

/* ---------------- Lightning: a charged border, sparks, arcs that find you ---------------- */

function lightning(s) {
  const m = META.lightning;
  let crawlers = [0, 0.33, 0.66].map((p) => ({ p, v: rand(0.06, 0.12) }));
  let arcs = [];
  let sparks = [];
  let arcIn = 0.4;
  let idleIn = rand(1, 3);
  let glow = 0;
  const perimeter = (p) => {
    const P = 2 * (s.w + s.h);
    let d = (((p % 1) + 1) % 1) * P;
    if (d < s.w) return [d, 1];
    d -= s.w;
    if (d < s.h) return [s.w - 1, d];
    d -= s.h;
    if (d < s.w) return [s.w - d, s.h - 1];
    return [1, s.h - (d - s.w)];
  };
  const strike = (x, y, big) => {
    const edges = [
      [x, 0],
      [x, s.h],
      [0, y],
      [s.w, y],
    ];
    const [ex, ey] = edges.reduce((a, b) => (Math.hypot(a[0] - x, a[1] - y) < Math.hypot(b[0] - x, b[1] - y) ? a : b));
    const from = big ? [x + rand(-40, 40), 0] : [ex + rand(-20, 20), ey];
    arcs.push({ pts: boltPath(from[0], from[1], x, y, 0.3, big ? 6 : 5), age: 0, life: big ? 0.35 : 0.22 });
    if (big) {
      const mid = arcs.at(-1).pts[Math.floor(arcs.at(-1).pts.length / 2)];
      arcs.push({ pts: boltPath(mid[0], mid[1], mid[0] + rand(-60, 60), mid[1] + rand(20, 60), 0.35, 4), age: 0, life: 0.3, thin: true });
    }
    for (let i = 0; i < (big ? 14 : 5); i++) {
      const a = rand(0, TAU);
      const v = rand(40, 160);
      sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(0.2, 0.5) });
    }
    glow = big ? 1 : 0.5;
  };
  return {
    step(dt) {
      for (const c of crawlers) c.p += c.v * dt * (1 + s.hover * 3);
      arcIn -= dt;
      if (s.inside && arcIn <= 0 && !s.calm) {
        arcIn = rand(0.45, 1.1);
        strike(s.px, s.py, false);
        audio.play("lightning", "hover", 0.3);
      }
      idleIn -= dt;
      if (!s.inside && idleIn <= 0 && !s.calm) {
        // even untouched, the card is never quite still: a small discharge between two points of its edge
        idleIn = rand(2.5, 5);
        const p = Math.random();
        const [x1, y1] = perimeter(p);
        const [x2, y2] = perimeter(p + rand(0.04, 0.09));
        arcs.push({ pts: boltPath(x1, y1, x2 + rand(-10, 10), y2 + rand(-10, 10), 0.45, 4), age: 0, life: 0.25, thin: true });
      }
      if (s.inside && !s.calm && Math.random() < dt * (6 + s.speed * 20)) {
        sparks.push({ x: s.px, y: s.py, vx: rand(-60, 60), vy: rand(-80, 10), age: 0, life: rand(0.2, 0.45) });
      }
      arcs = arcs.filter((a) => (a.age += dt) < a.life);
      sparks = sparks.filter((p) => {
        p.age += dt;
        p.vy += 220 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        return p.age < p.life;
      });
      glow = approach(glow, 0, dt, 0.12);
    },
    draw(ctx) {
      // the border is live: a faint charge with sparks crawling along it
      ctx.strokeStyle = rgba(m.c, 0.18 + 0.25 * s.hover);
      ctx.lineWidth = 1;
      ctx.strokeRect(1.5, 1.5, s.w - 3, s.h - 3);
      for (const c of crawlers) {
        const [x, y] = perimeter(c.p);
        const sp = glowSprite(m.a, 32);
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(sp, x - 10, y - 10, 20, 20);
        ctx.globalCompositeOperation = "source-over";
        if (!s.calm && Math.random() < 0.05 + s.hover * 0.15) {
          const [x2, y2] = perimeter(c.p - 0.03);
          drawBolt(ctx, boltPath(x2, y2, x, y, 0.4, 3), m.c, 0.6, 0.8);
        }
      }
      if (glow > 0.02) {
        const g = ctx.createRadialGradient(s.px, s.py, 0, s.px, s.py, s.w * 0.6);
        g.addColorStop(0, rgba(m.a, 0.22 * glow));
        g.addColorStop(1, rgba(m.a, 0));
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, s.w, s.h);
      }
      for (const a of arcs) drawBolt(ctx, a.pts, m.c, clamp(1 - a.age / a.life, 0, 1) * (a.thin ? 0.6 : 1), a.thin ? 0.8 : 1.4);
      for (const p of sparks) {
        ctx.fillStyle = rgba(Math.random() < 0.3 ? [255, 255, 255] : m.a, 1 - p.age / p.life);
        ctx.fillRect(p.x, p.y, 1.8, 1.8);
      }
    },
    poke(x, y) {
      strike(x, y, true);
    },
  };
}
