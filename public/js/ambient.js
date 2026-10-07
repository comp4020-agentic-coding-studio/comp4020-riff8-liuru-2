// The weather behind everything: faint stars, slow ink-haze, and whichever
// as-if is currently chosen drifting quietly through the dark.

import { META, NEUTRAL, rgba } from "./kinds.js";
import { TAU, approach, boltPath, drawBolt, fitCanvas, glowSprite, mixRgb, noise2, rand, reducedMotion } from "./util.js";

export function createAmbient(canvas) {
  const ctx = canvas.getContext("2d");
  const haze = document.createElement("canvas");
  const hctx = haze.getContext("2d");
  let W = 0;
  let H = 0;
  let stars = [];
  let kind = null;
  let palette = { a: [...NEUTRAL.a], b: [...NEUTRAL.b], c: [...NEUTRAL.c] };
  let target = NEUTRAL;
  const pointer = { x: 0.5, y: 0.4, sx: 0.5, sy: 0.4 };
  let particles = [];
  let nextBolt = 3;
  let bolt = null;
  let flash = 0;
  let flashRgb = NEUTRAL.a;
  let t = 0;
  let last = performance.now();
  let dirty = true;

  function resize() {
    fitCanvas(canvas, 1.5);
    ({ width: W, height: H } = canvas.getBoundingClientRect());
    haze.width = Math.ceil(W / 10);
    haze.height = Math.ceil(H / 10);
    const n = Math.round(Math.min(220, (W * H) / 7000));
    stars = Array.from({ length: n }, () => ({
      x: Math.random(),
      y: Math.random(),
      z: rand(0.15, 1),
      r: rand(0.3, 1.2),
      ph: rand(0, TAU),
      sp: rand(0.3, 1.4),
    }));
    dirty = true;
  }

  function spawn() {
    const p = { x: rand(0, W), y: rand(0, H), age: 0, life: rand(8, 16), vx: 0, vy: 0, r: rand(2, 6), ph: rand(0, TAU) };
    switch (kind) {
      case "dream":
        p.vy = rand(-10, -4);
        p.vx = rand(-4, 4);
        p.r = rand(10, 26);
        break;
      case "illusion":
        p.vx = rand(-14, 14);
        p.len = rand(30, 90);
        p.life = rand(4, 8);
        break;
      case "bubble":
        p.y = H + 40;
        p.vy = rand(-30, -14);
        p.r = rand(6, 22);
        p.life = H / 12;
        break;
      case "shadow":
        p.y = rand(-60, H * 0.4);
        p.vy = rand(4, 12);
        p.vx = rand(-6, 6);
        p.r = rand(60, 140);
        break;
      case "dew":
        p.life = rand(2, 4);
        p.r = rand(1.5, 3.5);
        break;
      case "lightning":
        p.vx = rand(-8, 8);
        p.vy = rand(-8, 8);
        p.r = rand(1, 2.4);
        p.life = rand(2, 5);
        break;
      default:
        return null;
    }
    return p;
  }

  const CAP = { dream: 26, illusion: 14, bubble: 18, shadow: 7, dew: 30, lightning: 22 };

  function step(dt) {
    t += dt;
    pointer.sx = approach(pointer.sx, pointer.x, dt, 0.8);
    pointer.sy = approach(pointer.sy, pointer.y, dt, 0.8);
    for (const key of ["a", "b", "c"]) palette[key] = mixRgb(palette[key], target[key], 1 - Math.exp(-dt / 0.8));
    flash = approach(flash, 0, dt, 0.35);

    if (kind && particles.length < (CAP[kind] ?? 0) && Math.random() < dt * 4) {
      const p = spawn();
      if (p) particles.push(p);
    }
    particles = particles.filter((p) => {
      p.age += dt;
      p.x += p.vx * dt + (kind === "bubble" ? Math.sin(t * 1.4 + p.ph) * 12 * dt : 0);
      p.y += p.vy * dt;
      return p.age < p.life && p.y > -200 && p.y < H + 200;
    });

    if (kind === "lightning") {
      nextBolt -= dt;
      if (nextBolt <= 0) {
        // far-off and faint: weather on the horizon, never a strobe
        const side = Math.random() < 0.5 ? rand(0, W * 0.2) : rand(W * 0.8, W);
        bolt = { pts: boltPath(side, -10, side + rand(-120, 120), rand(H * 0.35, H * 0.7), 0.3, 6), age: 0 };
        nextBolt = rand(5, 10);
      }
    }
    if (bolt) {
      bolt.age += dt;
      if (bolt.age > 0.6) bolt = null;
    }
  }

  function drawHaze() {
    const hw = haze.width;
    const hh = haze.height;
    hctx.clearRect(0, 0, hw, hh);
    const blobs = [
      [palette.b, 0.55, 0.13],
      [palette.a, 0.13, 0.11],
      [palette.c, 0.08, 0.17],
      [palette.b, 0.45, 0.07],
    ];
    blobs.forEach(([rgb, alpha, speed], i) => {
      const x = (0.5 + 0.45 * noise2(t * speed * 0.3, i * 10)) * hw;
      const y = (0.5 + 0.45 * noise2(i * 10 + 5, t * speed * 0.3)) * hh;
      const r = hw * (0.35 + 0.1 * Math.sin(t * 0.05 + i));
      const g = hctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(rgb, alpha));
      g.addColorStop(1, rgba(rgb, 0));
      hctx.fillStyle = g;
      hctx.fillRect(0, 0, hw, hh);
    });
  }

  function draw() {
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    drawHaze();
    ctx.imageSmoothingEnabled = true;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(haze, 0, 0, W, H);
    ctx.globalAlpha = 1;

    const px = (pointer.sx - 0.5) * 24;
    const py = (pointer.sy - 0.5) * 18;
    const scroll = scrollY;
    for (const s of stars) {
      const tw = 0.55 + 0.45 * Math.sin(t * s.sp + s.ph);
      const x = s.x * W - px * s.z;
      const y = (((s.y * H - py * s.z - scroll * s.z * 0.08) % H) + H) % H;
      ctx.fillStyle = rgba(mixRgb([236, 230, 245], palette.a, 0.3), 0.15 + 0.55 * tw * s.z);
      ctx.fillRect(x, y, s.r * s.z * 1.6, s.r * s.z * 1.6);
    }

    // a faint light that follows the visitor
    const lx = pointer.sx * W;
    const ly = pointer.sy * H;
    const lg = ctx.createRadialGradient(lx, ly, 0, lx, ly, 340);
    lg.addColorStop(0, rgba(palette.a, 0.07));
    lg.addColorStop(1, rgba(palette.a, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(0, 0, W, H);

    for (const p of particles) {
      const life = Math.min(1, p.age / 1.2, (p.life - p.age) / 1.5);
      if (life <= 0) continue;
      drawParticle(p, life);
    }

    if (bolt) {
      const a = (1 - bolt.age / 0.6) ** 2 * 0.32;
      drawBolt(ctx, bolt.pts, META.lightning.c, a, 1);
    }

    if (flash > 0.01) {
      const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.7);
      g.addColorStop(0, rgba(flashRgb, flash * 0.18));
      g.addColorStop(1, rgba(flashRgb, 0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }
  }

  function drawParticle(p, life) {
    switch (kind) {
      case "dream": {
        const s = glowSprite(META.dream.c, 64);
        ctx.globalAlpha = life * 0.35;
        ctx.drawImage(s, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        ctx.globalAlpha = 1;
        break;
      }
      case "illusion": {
        const y = p.y + Math.sin(t * 2 + p.ph) * 4;
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(META.illusion.a, life * 0.25);
        ctx.beginPath();
        ctx.moveTo(p.x - 3, y);
        ctx.lineTo(p.x - 3 + p.len, y);
        ctx.stroke();
        ctx.strokeStyle = rgba(META.illusion.c, life * 0.25);
        ctx.beginPath();
        ctx.moveTo(p.x + 3, y + 2);
        ctx.lineTo(p.x + 3 + p.len, y + 2);
        ctx.stroke();
        break;
      }
      case "bubble": {
        ctx.lineWidth = 1;
        ctx.strokeStyle = rgba(mixRgb(META.bubble.a, META.bubble.c, 0.5 + 0.5 * Math.sin(t + p.ph)), life * 0.35);
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, TAU);
        ctx.stroke();
        ctx.fillStyle = rgba([255, 255, 255], life * 0.3);
        ctx.beginPath();
        ctx.arc(p.x - p.r * 0.35, p.y - p.r * 0.35, p.r * 0.18, 0, TAU);
        ctx.fill();
        break;
      }
      case "shadow": {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        g.addColorStop(0, `rgba(4,2,8,${life * 0.4})`);
        g.addColorStop(0.55, `rgba(28,10,30,${life * 0.16})`);
        g.addColorStop(1, "rgba(4,2,8,0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        break;
      }
      case "dew": {
        const a = life * 0.6 * (0.5 + 0.5 * Math.sin(t * 3 + p.ph));
        ctx.strokeStyle = rgba(META.dew.a, a);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p.x - p.r * 2, p.y);
        ctx.lineTo(p.x + p.r * 2, p.y);
        ctx.moveTo(p.x, p.y - p.r * 2);
        ctx.lineTo(p.x, p.y + p.r * 2);
        ctx.stroke();
        break;
      }
      case "lightning": {
        ctx.fillStyle = rgba(Math.random() < 0.1 ? [255, 255, 255] : META.lightning.c, life * 0.6);
        ctx.fillRect(p.x, p.y, p.r, p.r);
        break;
      }
    }
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (reducedMotion.matches) {
      // the same world, held still: redraw only when something changes
      if (dirty) {
        palette = { a: [...target.a], b: [...target.b], c: [...target.c] };
        particles = [];
        draw();
        dirty = false;
      }
    } else {
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  addEventListener("resize", resize);
  addEventListener(
    "pointermove",
    (e) => {
      pointer.x = e.clientX / innerWidth;
      pointer.y = e.clientY / innerHeight;
    },
    { passive: true },
  );
  reducedMotion.addEventListener("change", () => (dirty = true));
  resize();
  requestAnimationFrame(frame);

  return {
    setKind(next) {
      if (next === kind) return;
      kind = next;
      target = next ? META[next] : NEUTRAL;
      particles = [];
      nextBolt = 1.5;
      dirty = true;
    },
    flash(rgb) {
      flashRgb = rgb;
      flash = 1;
      dirty = true;
    },
  };
}
