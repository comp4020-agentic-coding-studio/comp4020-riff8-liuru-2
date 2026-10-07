export const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

export const TAU = Math.PI * 2;
export const rand = (lo = 0, hi = 1) => lo + Math.random() * (hi - lo);
export const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];
export const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const mixRgb = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t), lerp(p[2], q[2], t)];
export const easeOut = (t) => 1 - (1 - t) ** 3;
export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Frame-rate independent approach: move `x` toward `target` with a time constant in seconds. */
export const approach = (x, target, dt, tau) => target + (x - target) * Math.exp(-dt / tau);

export function relativeTime(ms) {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Size a canvas's backing store to its CSS box, capped so big screens stay cheap. */
export function fitCanvas(canvas, maxDpr = 2) {
  const dpr = Math.min(devicePixelRatio || 1, maxDpr);
  const { width, height } = canvas.getBoundingClientRect();
  const w = Math.max(1, Math.round(width * dpr));
  const h = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  return { w: width, h: height, dpr };
}

/** A soft round sprite, pre-rendered once and stamped many times (cheaper than shadowBlur). */
const glowCache = new Map();
export function glowSprite(rgb, size = 64) {
  const key = `${rgb.join(",")}:${size}`;
  let c = glowCache.get(key);
  if (!c) {
    c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d");
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},1)`);
    grad.addColorStop(0.25, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0.45)`);
    grad.addColorStop(1, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
    glowCache.set(key, c);
  }
  return c;
}

/** A jagged path from a to b, as lightning takes it: midpoint displacement with a few forks. */
export function boltPath(x1, y1, x2, y2, roughness = 0.35, depth = 5) {
  let pts = [[x1, y1], [x2, y2]];
  let spread = Math.hypot(x2 - x1, y2 - y1) * roughness;
  for (let d = 0; d < depth; d++) {
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const nx = -(by - ay);
      const ny = bx - ax;
      const len = Math.hypot(nx, ny) || 1;
      const off = rand(-spread, spread);
      next.push([mx + (nx / len) * off, my + (ny / len) * off], pts[i + 1]);
    }
    pts = next;
    spread /= 2;
  }
  return pts;
}

export function strokePath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.stroke();
}

/** Draws a bolt twice: a wide soft glow, then a bright thin core. */
export function drawBolt(ctx, pts, rgb, alpha, width = 1.4) {
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha * 0.25})`;
  ctx.lineWidth = width * 5;
  strokePath(ctx, pts);
  ctx.strokeStyle = `rgba(255,255,250,${alpha})`;
  ctx.lineWidth = width;
  strokePath(ctx, pts);
  ctx.restore();
}

/** Cheap smooth 2-D value noise, enough for drifting smoke and fog. */
const P = new Uint8Array(512);
{
  const p = Array.from({ length: 256 }, (_, i) => i);
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) P[i] = p[i & 255];
}
const fade = (t) => t * t * (3 - 2 * t);
export function noise2(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const h = (i, j) => P[P[(xi + i) & 255] + ((yi + j) & 255)] / 255;
  const u = fade(xf);
  const v = fade(yf);
  return lerp(lerp(h(0, 0), h(1, 0), u), lerp(h(0, 1), h(1, 1), u), v) * 2 - 1;
}
