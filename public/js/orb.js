// The scrying orb: every stored thought is a light suspended in the glass,
// moving the way its own as-if moves. Drag to turn it, touch a light to read it.

import * as audio from "./audio.js";
import { META, NEUTRAL, rgba } from "./kinds.js";
import {
  TAU,
  approach,
  boltPath,
  clamp,
  drawBolt,
  fitCanvas,
  glowSprite,
  mixRgb,
  noise2,
  rand,
  reducedMotion,
  relativeTime,
} from "./util.js";

const FRAGMENTS = 5; // how many front-most thoughts show a sliver of their words
const BURST = 0.9; // seconds an elemental reaction lasts when a light is touched
const FEATURE_EVERY = 1.1; // seconds each thought is held up in the glass while it cycles
const FEATURE_FADE = 0.35;

export function createOrb(stage, { traces, onCount, onTouch }) {
  const el = stage.querySelector(".orb");
  const canvas = el.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const reveal = stage.querySelector(".reveal");
  const announce = stage.querySelector(".orb-live");
  const fog = document.createElement("canvas");
  fog.width = fog.height = 96;
  const fctx = fog.getContext("2d");

  let W = 0;
  let R = 0;
  let cx = 0;
  let cy = 0;
  let t = 0;
  let visible = true;
  const rot = { yaw: 0.4, pitch: -0.15, vyaw: 0.06, vpitch: 0, target: null };
  const pointer = { x: -1e4, y: -1e4, inside: false, sx: 0, sy: 0 };
  let drag = null;
  let motes = [];
  let ripples = [];
  let streaks = [];
  let hovered = null;
  let pinned = null;
  let keyIndex = -1;
  let hideTimer = 0;
  let pulse = 0;
  let crowd = 1;
  let pulseRgb = NEUTRAL.a;
  let fogMix = [];
  let only = null; // when set, the glass shows one kind and dims the rest
  const shown = (mo) => !only || mo.trace.kind === only;
  // the living display: one thought at a time rises to the front of the glass, in a fair shuffled order
  let cycling = !reducedMotion.matches;
  let featured = null;
  let leaving = null;
  let featureClock = 0;
  let order = [];
  let orderPos = 0;
  let featureBox = null;

  const makeMote = (trace, i, n) => {
    // spread evenly through the ball (a Fibonacci sphere), then jitter so it reads as weather, not a lattice
    const k = n <= 1 ? 0.5 : i / (n - 1);
    const y = 1 - 2 * k;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const th = i * 2.399963 + rand(-0.2, 0.2);
    const depth = rand(0.38, 0.86);
    return {
      trace,
      m: META[trace.kind],
      v: [Math.cos(th) * ring * depth, y * depth * 0.92, Math.sin(th) * ring * depth],
      ph: rand(0, TAU),
      sx: 0,
      sy: 0,
      z: 0,
      scale: 1,
      push: [0, 0],
      hot: 0,
      burst: null,
      trail: [],
      fresh: 0,
      feature: 0,
      inspired: 0,
    };
  };

  const setTraces = (list) => {
    motes = list.map((tr, i) => makeMote(tr, i, list.length));
    order = [];
    refreshFogMix();
  };

  function shuffle(xs) {
    for (let i = xs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [xs[i], xs[j]] = [xs[j], xs[i]];
    }
    return xs;
  }

  /** The next thought in the cycle: every one gets its turn before any repeats. */
  function nextInOrder(dir = 1) {
    const candidates = motes.filter(shown);
    if (!candidates.length) return null;
    order = order.filter((mo) => motes.includes(mo));
    if (order.length !== motes.length) {
      const missing = motes.filter((mo) => !order.includes(mo));
      order.splice(orderPos, 0, ...shuffle(missing));
    }
    for (let i = 0; i < order.length; i++) {
      orderPos = (orderPos + dir + order.length) % order.length;
      if (shown(order[orderPos])) return order[orderPos];
    }
    return null;
  }

  function feature(mo) {
    if (mo === featured) return;
    leaving = featured ? { mo: featured, age: 0 } : null;
    featured = mo;
    featureClock = 0;
  }

  function refreshFogMix() {
    const counts = Object.fromEntries(Object.keys(META).map((k) => [k, 0]));
    for (const mo of motes) counts[mo.trace.kind]++;
    const total = motes.length || 1;
    // the fog is coloured by what the glass holds: more dew, more dew-light
    fogMix = Object.entries(counts)
      .filter(([, c]) => c > 0)
      .map(([k, c]) => ({ rgb: META[k].a, deep: META[k].b, w: c / total, ph: rand(0, TAU) }));
    if (!fogMix.length) fogMix = [{ rgb: NEUTRAL.a, deep: NEUTRAL.b, w: 1, ph: 0 }];
    onCount?.(motes.length);
    el.setAttribute(
      "aria-label",
      motes.length
        ? `crystal ball holding ${motes.length === 1 ? "one thought" : `${motes.length} thoughts`}`
        : "crystal ball, empty for now",
    );
  }

  function resize() {
    const { w } = fitCanvas(canvas, 1.5);
    W = w;
    cx = W / 2;
    cy = W / 2;
    R = (W / 1.16) * 0.5;
  }

  function rotate([x, y, z], yaw = rot.yaw, pitch = rot.pitch) {
    const cyw = Math.cos(yaw);
    const syw = Math.sin(yaw);
    const x1 = x * cyw + z * syw;
    const z1 = -x * syw + z * cyw;
    const cp = Math.cos(pitch);
    const sp = Math.sin(pitch);
    return [x1, y * cp - z1 * sp, y * sp + z1 * cp];
  }

  // ---------------------------------------------------------------- simulate

  function step(dt) {
    t += dt;
    const calm = reducedMotion.matches;
    if (rot.target) {
      let dy = rot.target.yaw - rot.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      rot.yaw += dy * (1 - Math.exp(-dt / 0.18));
      rot.pitch = approach(rot.pitch, rot.target.pitch, dt, 0.18);
      rot.vyaw = 0;
      rot.vpitch = 0;
      if (Math.abs(dy) < 0.002 && Math.abs(rot.pitch - rot.target.pitch) < 0.002) rot.target = null;
    } else if (!drag) {
      rot.yaw += rot.vyaw * dt;
      rot.pitch += rot.vpitch * dt;
      // let go and it settles back into its own slow turning
      const idle = pinned || hovered || calm ? 0 : 0.06;
      rot.vyaw = approach(rot.vyaw, idle, dt, 1.6);
      rot.vpitch = approach(rot.vpitch, 0, dt, 0.8);
      rot.pitch = approach(rot.pitch, clamp(rot.pitch, -0.7, 0.7), dt, 0.5);
    }
    pointer.sx = approach(pointer.sx, pointer.inside ? pointer.x : cx, dt, 0.4);
    pointer.sy = approach(pointer.sy, pointer.inside ? pointer.y : cy - R * 0.4, dt, 0.4);
    pulse = approach(pulse, 0, dt, 0.7);

    if (cycling && !pinned && !hovered && !drag) {
      featureClock += dt;
      if (!featured || featureClock >= FEATURE_EVERY) feature(nextInOrder());
    }
    if (leaving && (leaving.age += dt) > FEATURE_FADE) leaving = null;
    if (featured && !motes.includes(featured)) featured = null;

    for (const mo of motes) {
      const kind = mo.trace.kind;
      // each kind keeps its own time inside the glass
      let [x, y, z] = mo.v;
      if (!calm) {
        if (kind === "dream") {
          const d = 1 + 0.06 * Math.sin(t * 0.4 + mo.ph);
          x *= d;
          y = y * d - 0.03 * Math.sin(t * 0.3 + mo.ph);
        } else if (kind === "bubble") y -= 0.045 * Math.sin(t * 1.1 + mo.ph);
        else if (kind === "dew") y += 0.02 * Math.sin(t * 0.7 + mo.ph);
        else if (kind === "shadow") x += 0.05 * noise2(t * 0.2, mo.ph);
        else if (kind === "illusion" && Math.sin(t * 2.3 + mo.ph * 3) > 0.985) x += 0.04;
      }
      const [rx, ry, rz] = rotate([x, y, z]);
      // a glass sphere magnifies toward its rim: a cheap lens on the projected radius
      const s = 1 / (1 - rz * 0.28);
      let px = rx * s;
      let py = ry * s;
      const d = Math.hypot(px, py);
      if (d > 0) {
        const lens = Math.min(0.97, d ** 0.82) / d;
        px *= lens;
        py *= lens;
      }
      let sx = cx + px * R;
      let sy = cy + py * R;

      // the visitor's hand parts the contents a little
      let tx = 0;
      let ty = 0;
      if (pointer.inside && !drag) {
        const dx = sx - pointer.x;
        const dy = sy - pointer.y;
        const dd = Math.hypot(dx, dy);
        const reach = R * 0.28;
        if (dd < reach && mo !== hovered && mo !== pinned) {
          const f = (1 - dd / reach) ** 2 * R * 0.08;
          tx = (dx / (dd || 1)) * f;
          ty = (dy / (dd || 1)) * f;
        }
      }
      for (const rp of ripples) {
        const dd = Math.hypot(sx - rp.x, sy - rp.y);
        const front = rp.age * R * 1.4;
        const band = Math.exp(-(((dd - front) / (R * 0.08)) ** 2));
        if (band > 0.01) {
          tx += ((sx - rp.x) / (dd || 1)) * band * 14 * (1 - rp.age / rp.life);
          ty += ((sy - rp.y) / (dd || 1)) * band * 14 * (1 - rp.age / rp.life);
        }
      }
      mo.push[0] = approach(mo.push[0], tx, dt, 0.18);
      mo.push[1] = approach(mo.push[1], ty, dt, 0.18);
      sx += mo.push[0];
      sy += mo.push[1];

      if (kind === "shadow" && !calm) {
        mo.trail.push([sx, sy]);
        if (mo.trail.length > 14) mo.trail.shift();
      } else if (mo.trail.length) mo.trail.length = 0;
      mo.sx = sx;
      mo.sy = sy;
      mo.z = rz;
      mo.scale = s;
      mo.hot = approach(mo.hot, mo === hovered || mo === pinned ? 1 : 0, dt, 0.15);
      if (mo.burst !== null) {
        mo.burst += dt;
        if (mo.burst > BURST) mo.burst = null;
      }
      mo.fresh = Math.max(0, mo.fresh - dt);
      mo.feature = approach(mo.feature, mo === featured && shown(mo) ? 1 : 0, dt, 0.12);
      mo.inspired = Math.max(0, mo.inspired - dt);
    }
    ripples = ripples.filter((rp) => (rp.age += dt) < rp.life);
    streaks = streaks.filter((st) => (st.age += dt) < st.life);
  }

  // ---------------------------------------------------------------- draw

  function drawFog() {
    const n = 96;
    fctx.clearRect(0, 0, n, n);
    fctx.globalCompositeOperation = "lighter";
    let i = 0;
    for (const f of fogMix) {
      const blobs = 1 + Math.round(f.w * 4);
      for (let b = 0; b < blobs; b++, i++) {
        const a = rot.yaw * 0.8 + f.ph + b * 2.1 + t * 0.07 * (i % 2 ? 1 : -1);
        const rr = 0.18 + 0.16 * noise2(i * 3.1, t * 0.05);
        let x = n / 2 + Math.cos(a) * rr * n;
        let y = n / 2 + Math.sin(a + rot.pitch) * rr * n * 0.8;
        if (pointer.inside) {
          // fog shies from the hand
          const px = ((pointer.sx - cx) / R) * (n / 2) + n / 2;
          const py = ((pointer.sy - cy) / R) * (n / 2) + n / 2;
          const dx = x - px;
          const dy = y - py;
          const dd = Math.hypot(dx, dy) + 1;
          const shove = Math.max(0, 1 - dd / 40) * 14;
          x += (dx / dd) * shove;
          y += (dy / dd) * shove;
        }
        const g = fctx.createRadialGradient(x, y, 0, x, y, n * (0.22 + f.w * 0.18));
        g.addColorStop(0, rgba(mixRgb(f.rgb, f.deep, 0.45), 0.22 + f.w * 0.2));
        g.addColorStop(1, rgba(f.deep, 0));
        fctx.fillStyle = g;
        fctx.fillRect(0, 0, n, n);
      }
    }
    fctx.globalCompositeOperation = "source-over";
  }

  function drawGlassBody() {
    const body = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R);
    body.addColorStop(0, "rgba(46,36,84,0.55)");
    body.addColorStop(0.65, "rgba(14,10,30,0.82)");
    body.addColorStop(1, "rgba(6,4,14,0.95)");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();
  }

  function drawMote(mo) {
    const { m, sx, sy, z, hot } = mo;
    const kind = mo.trace.kind;
    const depth = (z + 1) / 2; // 0 at the back, 1 at the front
    // thoughts pass: an hour-old light is a little dimmer than a new one, a week-old one dimmer still
    const hours = (Date.now() - mo.trace.createdAt) / 3_600_000;
    const age = clamp(1 - Math.log10(1 + hours) / 4.4, 0.45, 1);
    const a = clamp(0.25 + depth * 0.75, 0, 1) * Math.max(age, hot);
    const size = (3 + depth * 3.4) * (1 + hot * 0.9 + Math.min(1, mo.fresh) * 0.3) * (W / 800 + 0.3) * crowd;
    const b = mo.burst !== null && mo.burst >= 0 ? mo.burst / BURST : -1;

    if (mo.feature > 0.02) {
      const r = size * (5 + 2 * mo.feature);
      ctx.globalAlpha = 0.45 * mo.feature;
      ctx.drawImage(glowSprite(m.a, 64), sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }
    if (mo.inspired > 0) {
      // the model is reading this one right now
      const k = mo.inspired / 2.4;
      ctx.strokeStyle = rgba([240, 210, 150], 0.7 * k);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, size * (3 + (1 - k) * 4), 0, TAU);
      ctx.stroke();
    }
    if (mo.trace.mine) {
      ctx.strokeStyle = rgba(m.a, 0.35 * a);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sx, sy, size * 2.6, t * 0.8 + mo.ph, t * 0.8 + mo.ph + 4.4);
      ctx.stroke();
    }
    if (mo.fresh > 0) {
      const g = glowSprite(m.a, 64);
      const r = size * (reducedMotion.matches ? 7 : 6 + 3 * Math.sin(t * 3));
      ctx.globalAlpha = Math.min(1, mo.fresh / 2) * 0.7;
      ctx.drawImage(g, sx - r, sy - r, r * 2, r * 2);
      ctx.globalAlpha = 1;
    }

    switch (kind) {
      case "dream": {
        const pulseA = 0.75 + 0.25 * Math.sin(t * 1.3 + mo.ph);
        const g = glowSprite(mixRgb(m.a, m.c, 0.5 + 0.5 * Math.sin(t * 0.5 + mo.ph)), 64);
        const r = size * 4.2;
        ctx.globalAlpha = a * pulseA;
        ctx.drawImage(g, sx - r, sy - r, r * 2, r * 2);
        if (b >= 0) {
          // touched: it loosens into a few rising motes and a widening halo
          ctx.globalAlpha = (1 - b) * 0.8;
          const hr = r * (1 + b * 2.4);
          ctx.drawImage(glowSprite(m.a, 64), sx - hr, sy - hr, hr * 2, hr * 2);
          for (let i = 0; i < 5; i++) {
            const mx = sx + Math.sin(i * 2.3 + mo.ph) * size * 4 * b;
            const my = sy - b * size * (8 + i * 3);
            ctx.drawImage(glowSprite(m.c, 32), mx - 4, my - 4, 8, 8);
          }
        }
        ctx.globalAlpha = 1;
        break;
      }
      case "illusion": {
        const split = size * (0.6 + hot * 1.4 + (b >= 0 ? Math.sin(b * Math.PI) * 4 : 0));
        ctx.globalCompositeOperation = "lighter";
        ctx.fillStyle = rgba(m.a, a * 0.85);
        ctx.beginPath();
        ctx.arc(sx - split, sy, size * 0.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba(m.c, a * 0.85);
        ctx.beginPath();
        ctx.arc(sx + split, sy + split * 0.3, size * 0.9, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba([255, 255, 255], a * 0.7);
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.45, 0, TAU);
        ctx.fill();
        if (b >= 0) {
          // false copies spin out, then collapse back into the one
          const k = Math.sin(b * Math.PI);
          for (let i = 0; i < 4; i++) {
            const ang = i * (TAU / 4) + b * 3;
            ctx.fillStyle = rgba(i % 2 ? m.a : m.c, 0.6 * k);
            ctx.beginPath();
            ctx.arc(sx + Math.cos(ang) * size * 6 * k, sy + Math.sin(ang) * size * 6 * k, size * 0.8, 0, TAU);
            ctx.fill();
          }
        }
        ctx.globalCompositeOperation = "source-over";
        break;
      }
      case "bubble": {
        const r = size * (1.5 + 0.12 * Math.sin(t * 3 + mo.ph)) * (b >= 0 && b < 0.5 ? 1 + b * 1.4 : 1);
        if (b < 0.5) {
          // iridescence on the cheap: the rim's hue drifts between the bubble's two colours
          ctx.strokeStyle = rgba(mixRgb(m.a, m.c, 0.5 + 0.5 * Math.sin(t * 0.9 + mo.ph)), a);
          ctx.lineWidth = 1.1;
          ctx.fillStyle = rgba(m.a, 0.08 * a);
          ctx.beginPath();
          ctx.arc(sx, sy, r, 0, TAU);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = rgba([255, 255, 255], a * 0.8);
          ctx.beginPath();
          ctx.arc(sx - r * 0.4, sy - r * 0.4, Math.max(0.6, r * 0.2), 0, TAU);
          ctx.fill();
        } else {
          // popped, and already gathering itself again
          const k = (b - 0.5) * 2;
          ctx.strokeStyle = rgba(m.a, (1 - k) * 0.8);
          ctx.beginPath();
          ctx.arc(sx, sy, r * (1 + k), 0, TAU);
          ctx.stroke();
          ctx.fillStyle = rgba(m.c, (1 - k) * 0.9);
          for (let i = 0; i < 6; i++) ctx.fillRect(sx + Math.cos(i) * r * 2.4 * k, sy + Math.sin(i) * r * 2.4 * k, 1.6, 1.6);
          ctx.globalAlpha = k;
          ctx.beginPath();
          ctx.arc(sx, sy, size * 0.8 * k, 0, TAU);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        break;
      }
      case "shadow": {
        const trail = mo.trail;
        const tl = b >= 0 ? 1 + Math.sin(b * Math.PI) * 2 : 1;
        const smoke = glowSprite([2, 0, 6], 32);
        for (let i = 0; i < trail.length; i += 2) {
          const k = i / trail.length;
          const [tx, ty] = trail[i];
          const r = size * (1.5 + (1 - k) * 2.5 * tl);
          ctx.globalAlpha = 0.5 * k * a;
          ctx.drawImage(smoke, tx - r, ty - r + (1 - k) * size * 2 * tl, r * 2, r * 2);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(4,1,10,0.95)";
        ctx.strokeStyle = rgba(m.a, a * 0.9);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(sx, sy, size * 1.2, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = rgba(m.c, a * 0.6);
        ctx.beginPath();
        ctx.arc(sx + size * 0.3, sy + size * 0.3, size * 0.45, 0, TAU);
        ctx.fill();
        if (b >= 0) {
          // touched: a ring of dark smoke unwinds downward
          ctx.globalAlpha = 0.8 * (1 - b);
          for (let i = 0; i < 7; i++) {
            const ang = i * 0.9 + b * 2;
            const rr = size * (2 + b * 6);
            const r = size * 3;
            ctx.drawImage(smoke, sx + Math.cos(ang) * rr - r, sy + Math.sin(ang) * rr * 0.5 + b * size * 6 - r, r * 2, r * 2);
          }
          ctx.globalAlpha = 1;
        }
        break;
      }
      case "dew": {
        const r = size * 1.3;
        ctx.fillStyle = rgba(m.a, a * 0.85);
        ctx.beginPath();
        ctx.arc(sx, sy, r, 0, TAU);
        ctx.fill();
        // the lower half catches green from below, as a bead on a leaf would
        ctx.fillStyle = rgba(m.c, a * 0.45);
        ctx.beginPath();
        ctx.arc(sx, sy + r * 0.25, r * 0.7, 0, Math.PI);
        ctx.fill();
        const la = Math.atan2(pointer.sy - sy, pointer.sx - sx);
        ctx.fillStyle = rgba([255, 255, 255], 0.9 * a);
        ctx.beginPath();
        ctx.arc(sx + Math.cos(la) * r * 0.45, sy + Math.sin(la) * r * 0.45, Math.max(0.6, r * 0.3), 0, TAU);
        ctx.fill();
        if (b >= 0) {
          for (let i = 0; i < 3; i++) {
            const k = clamp(b * 1.3 - i * 0.18, 0, 1);
            if (k <= 0 || k >= 1) continue;
            ctx.strokeStyle = rgba(m.a, (1 - k) * 0.7);
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.ellipse(sx, sy, r + k * size * 8, (r + k * size * 8) * 0.5, 0, 0, TAU);
            ctx.stroke();
          }
        }
        break;
      }
      case "lightning": {
        const g = glowSprite(m.a, 64);
        const flicker = 0.8 + 0.2 * Math.sin(t * 13 + mo.ph);
        const r = size * 3;
        ctx.globalCompositeOperation = "lighter";
        ctx.globalAlpha = a * flicker;
        ctx.drawImage(g, sx - r, sy - r, r * 2, r * 2);
        ctx.globalAlpha = 1;
        ctx.fillStyle = rgba([255, 255, 240], a);
        ctx.beginPath();
        ctx.arc(sx, sy, size * 0.6, 0, TAU);
        ctx.fill();
        // it crackles when a hand comes near, and discharges toward the rim when touched
        const near = pointer.inside && Math.hypot(pointer.x - sx, pointer.y - sy) < R * 0.18;
        if (!reducedMotion.matches && (near || hot > 0.5) && Math.random() < 0.35) {
          const ang = rand(0, TAU);
          drawBolt(ctx, boltPath(sx, sy, sx + Math.cos(ang) * size * 5, sy + Math.sin(ang) * size * 5, 0.5, 3), m.c, 0.7, 0.8);
        }
        if (b >= 0 && b < 0.4 && !reducedMotion.matches) {
          const dx = sx - cx;
          const dy = sy - cy;
          const d = Math.hypot(dx, dy) || 1;
          drawBolt(ctx, boltPath(sx, sy, cx + (dx / d) * R * 0.98, cy + (dy / d) * R * 0.98, 0.3, 5), m.c, (1 - b / 0.4) * 0.9, 1.1);
        }
        ctx.globalCompositeOperation = "source-over";
        break;
      }
    }
  }

  function drawFragments(sorted) {
    // the nearest few thoughts show a sliver of their words, bent by the glass
    const front = sorted.filter((mo) => mo.z > 0.35 && mo !== hovered && mo !== pinned && mo !== featured).slice(-FRAGMENTS);
    ctx.textBaseline = "middle";
    for (const mo of front) {
      const words = mo.trace.text.length > 24 ? `${mo.trace.text.slice(0, 22).trimEnd()}…` : mo.trace.text;
      const dx = (mo.sx - cx) / R;
      const bend = 1 - dx * dx * 0.45;
      ctx.save();
      ctx.translate(mo.sx + 10, mo.sy - 10);
      ctx.scale(bend, 1);
      ctx.font = `italic 500 ${Math.round(12 + mo.z * 4)}px "Cormorant Garamond", serif`;
      ctx.fillStyle = rgba(mixRgb([236, 230, 245], mo.m.a, 0.3), 0.18 + (mo.z - 0.35) * 0.9);
      ctx.fillText(words, 0, 0);
      ctx.restore();
    }
  }

  /** Wraps text to at most `lines` lines of `width`, ending in an ellipsis if it had to stop early. */
  function wrap(text, width, lines) {
    const out = [];
    let line = "";
    for (const word of text.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width <= width || !line) line = next;
      else {
        out.push(line);
        line = word;
        if (out.length === lines) break;
      }
    }
    if (out.length < lines && line) out.push(line);
    else if (line && out.length === lines) out[lines - 1] = `${out[lines - 1].replace(/[\s,.;:]+$/, "")}…`;
    while (out.length && ctx.measureText(out.at(-1)).width > width * 1.15) out[out.length - 1] = `${out.at(-1).slice(0, -2)}…`;
    return out;
  }

  /** The thought currently held up in the glass, and the one it is giving way to. */
  function drawFeatured() {
    featureBox = null;
    const draw = (mo, alpha, rise) => {
      if (!mo || alpha <= 0.01) return;
      const size = clamp(R * 0.07, 15, 24);
      ctx.font = `italic 500 ${Math.round(size)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const lines = wrap(mo.trace.text, R * 1.2, 3);
      const lh = size * 1.18;
      const top = cy + R * 0.38 - ((lines.length - 1) * lh) / 2 - rise;
      // a pool of darkness behind the words, so they read over whatever weather is in the glass
      const back = ctx.createRadialGradient(cx, top + ((lines.length - 1) * lh) / 2, 0, cx, top + ((lines.length - 1) * lh) / 2, R * 0.72);
      back.addColorStop(0, `rgba(6,4,14,${0.62 * alpha})`);
      back.addColorStop(1, "rgba(6,4,14,0)");
      ctx.fillStyle = back;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.fillStyle = rgba(mixRgb([244, 240, 250], mo.m.a, 0.22), alpha);
      lines.forEach((l, i) => ctx.fillText(l, cx, top + i * lh));
      ctx.font = `${Math.round(size * 0.95)}px "Ma Shan Zheng", serif`;
      ctx.fillStyle = rgba(mo.m.a, alpha * 0.9);
      ctx.fillText(mo.m.hanzi, cx, top - lh * 1.05);
      // a hair of light from the thought's own mote to its words
      ctx.strokeStyle = rgba(mo.m.a, 0.28 * alpha);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(mo.sx, mo.sy);
      ctx.quadraticCurveTo((mo.sx + cx) / 2, Math.min(mo.sy, top - lh * 1.6) - 10, cx, top - lh * 1.6);
      ctx.stroke();
      ctx.textAlign = "start";
      if (mo === featured) featureBox = { x0: cx - R * 0.65, x1: cx + R * 0.65, y0: top - lh * 1.6, y1: top + lines.length * lh };
    };
    const calm = reducedMotion.matches;
    if (leaving) {
      const k = leaving.age / FEATURE_FADE;
      draw(leaving.mo, 1 - k, calm ? 0 : k * 10);
    }
    if (featured && shown(featured) && !(pinned || hovered)) {
      const k = cycling ? clamp(featureClock / FEATURE_FADE, 0, 1) : 1;
      draw(featured, k, calm ? 0 : (1 - k) * -8);
    }
  }

  function drawGlassSurface() {
    // fresnel rim, coloured by what's inside
    const rim = ctx.createRadialGradient(cx, cy, R * 0.72, cx, cy, R);
    rim.addColorStop(0, "rgba(255,255,255,0)");
    rim.addColorStop(0.85, rgba(mixRgb(fogMix[0].rgb, [255, 255, 255], 0.4), 0.08));
    rim.addColorStop(1, rgba(mixRgb(fogMix[0].rgb, [255, 255, 255], 0.5), 0.32));
    ctx.fillStyle = rim;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    // the main highlight leans toward the visitor's hand, as if they were the lamp
    const lx = cx + clamp((pointer.sx - cx) / R, -1, 1) * R * 0.25 - R * 0.28;
    const ly = cy + clamp((pointer.sy - cy) / R, -1, 1) * R * 0.2 - R * 0.42;
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(-0.6);
    const hl = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
    hl.addColorStop(0, "rgba(255,255,255,0.32)");
    hl.addColorStop(0.5, "rgba(255,255,255,0.06)");
    hl.addColorStop(1, "rgba(255,255,255,0)");
    ctx.scale(1, 0.55);
    ctx.fillStyle = hl;
    ctx.beginPath();
    ctx.arc(0, 0, R * 0.36, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.55)";
    ctx.beginPath();
    ctx.ellipse(lx - R * 0.06, ly - R * 0.02, R * 0.045, R * 0.022, -0.6, 0, TAU);
    ctx.fill();

    // a low reflected glow off the stand
    const bl = ctx.createRadialGradient(cx, cy + R * 0.85, 0, cx, cy + R * 0.85, R * 0.5);
    bl.addColorStop(0, rgba(fogMix[0].rgb, 0.16));
    bl.addColorStop(1, rgba(fogMix[0].rgb, 0));
    ctx.fillStyle = bl;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fill();

    ctx.strokeStyle = "rgba(236,230,245,0.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 0.5, 0, TAU);
    ctx.stroke();
  }

  function draw() {
    const dpr = canvas.width / W;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, W);

    // the orb's own aura, brighter when something has just arrived
    const aura = ctx.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.16);
    aura.addColorStop(0, rgba(mixRgb(fogMix[0].rgb, pulseRgb, pulse), 0.16 + pulse * 0.3));
    aura.addColorStop(1, rgba(fogMix[0].rgb, 0));
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, W, W);

    drawGlassBody();
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R - 1, 0, TAU);
    ctx.clip();

    drawFog();
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(fog, cx - R, cy - R, R * 2, R * 2);
    ctx.globalCompositeOperation = "source-over";

    for (const rp of ripples) {
      const k = rp.age / rp.life;
      ctx.strokeStyle = rgba(rp.rgb, 0.35 * (1 - k));
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(rp.x, rp.y, k * R * 1.4, 0, TAU);
      ctx.stroke();
    }

    // a fuller glass carries smaller lights, so two hundred still read as separate thoughts
    crowd = clamp(1.2 - motes.length / 350, 0.7, 1.1);
    const sorted = [...motes].sort((p, q) => p.z - q.z);
    for (const mo of sorted) {
      if (shown(mo)) drawMote(mo);
      else {
        // set aside, not gone: a faint point where it hangs
        ctx.fillStyle = `rgba(236,230,245,${0.08 + 0.08 * ((mo.z + 1) / 2)})`;
        ctx.beginPath();
        ctx.arc(mo.sx, mo.sy, 1.6, 0, TAU);
        ctx.fill();
      }
    }
    drawFragments(sorted.filter(shown));
    drawFeatured();

    if (!motes.length) {
      ctx.fillStyle = "rgba(236,230,245,0.55)";
      ctx.font = `italic 500 ${Math.round(R * 0.075)}px "Cormorant Garamond", serif`;
      ctx.textAlign = "center";
      ctx.fillText("the glass is waiting", cx, cy);
      ctx.textAlign = "start";
    }
    ctx.restore();

    drawGlassSurface();

    for (const st of streaks) {
      const k = st.age / st.life;
      const e = 1 - (1 - k) ** 3;
      const g = glowSprite(st.rgb, 64);
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 6; i++) {
        const kk = Math.max(0, e - i * 0.04);
        const r = 10 - i;
        ctx.globalAlpha = (1 - k) * (1 - i / 6);
        ctx.drawImage(g, st.x0 + (st.x1 - st.x0) * kk - r, st.y0 + (st.y1 - st.y0) * kk - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    // a fine thread from the light being read out to the panel reading it
    const lit = pinned ?? hovered;
    if (lit && reveal.classList.contains("shown") && getComputedStyle(reveal).position === "absolute") {
      const cr = canvas.getBoundingClientRect();
      const rr = reveal.getBoundingClientRect();
      const tx = rr.left - cr.left;
      const ty = rr.top - cr.top + 40;
      const g = ctx.createLinearGradient(lit.sx, lit.sy, tx, ty);
      g.addColorStop(0, rgba(lit.m.a, 0.6));
      g.addColorStop(1, rgba(lit.m.a, 0.05));
      ctx.strokeStyle = g;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(lit.sx, lit.sy);
      ctx.quadraticCurveTo((lit.sx + tx) / 2, Math.min(lit.sy, ty) - 30, tx, ty);
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------- reveal

  function show(mo, { announceIt = false } = {}) {
    clearTimeout(hideTimer);
    const tr = mo.trace;
    const m = mo.m;
    reveal.style.setProperty("--r-a", rgba(m.a));
    reveal.replaceChildren();
    const head = document.createElement("div");
    head.className = "reveal-head";
    const hz = document.createElement("span");
    hz.className = "reveal-hanzi";
    hz.lang = "zh-Hant";
    hz.setAttribute("aria-hidden", "true");
    hz.textContent = m.hanzi;
    const kind = document.createElement("span");
    kind.className = "reveal-kind";
    const name = document.createElement("b");
    name.textContent = `${m.glyph} ${m.name}`;
    const when = document.createElement("time");
    when.dateTime = new Date(tr.createdAt).toISOString();
    when.textContent = `passed through ${relativeTime(tr.createdAt)}`;
    const whenWrap = document.createElement("span");
    whenWrap.append(when);
    kind.append(name, whenWrap);
    head.append(hz, kind);
    const text = document.createElement("p");
    text.className = "reveal-text";
    text.textContent = tr.text;
    reveal.append(head, text);
    if (tr.mine) {
      const mine = document.createElement("span");
      mine.className = "reveal-mine";
      mine.textContent = mo.fresh > 0 ? "yours — just let go" : "yours";
      reveal.append(mine);
    }
    reveal.classList.add("shown");
    if (announceIt) {
      announce.textContent = `${tr.mine ? "Yours. " : ""}${m.label}, ${relativeTime(tr.createdAt)}: ${tr.text}`;
    }
  }

  function hideSoon() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (pinned || hovered) return;
      reveal.classList.remove("shown");
      hideTimer = setTimeout(() => {
        if (!reveal.classList.contains("shown")) reveal.replaceChildren();
      }, 500);
    }, 1400);
  }

  /** Where a mote is, in viewport coordinates. */
  function onScreen(mo) {
    const r = canvas.getBoundingClientRect();
    return [r.left + (mo.sx / W) * r.width, r.top + (mo.sy / W) * r.height];
  }

  function touch(mo) {
    if (!reducedMotion.matches) mo.burst = 0;
    audio.play(mo.trace.kind, "touch", 0.12);
    onTouch?.(...onScreen(mo), mo.trace.kind);
  }

  function hit(x, y, finger = false) {
    let best = null;
    let score = Infinity;
    const reach = finger ? Math.max(26, R * 0.1) : Math.max(16, R * 0.06);
    for (const mo of motes) {
      if (!shown(mo)) continue;
      const d = Math.hypot(mo.sx - x, mo.sy - y);
      if (d > reach) continue;
      const s = d - mo.z * 10; // nearer the glass wins a tie
      if (s < score) [best, score] = [mo, s];
    }
    return best;
  }

  /** Turns the ball until this light faces the visitor. */
  function face(mo) {
    const [x, y, z] = mo.v;
    const yaw = Math.atan2(-x, z);
    const z1 = Math.hypot(x, z);
    rot.target = { yaw, pitch: clamp(Math.atan2(y, z1), -0.9, 0.9) };
  }

  // ---------------------------------------------------------------- input

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * W];
  };

  el.addEventListener("pointermove", (e) => {
    const [x, y] = local(e);
    pointer.x = x;
    pointer.y = y;
    pointer.inside = Math.hypot(x - cx, y - cy) < R * 1.05;
    if (drag) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) > 6) drag.moved = true;
      const k = 3.2 / W;
      rot.yaw += dx * k;
      rot.vyaw = (dx * k) / Math.max(0.008, (e.timeStamp - drag.t) / 1000);
      if (e.pointerType === "mouse") {
        rot.pitch = clamp(rot.pitch + dy * k, -1.1, 1.1);
        rot.vpitch = (dy * k) / Math.max(0.008, (e.timeStamp - drag.t) / 1000);
      }
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.t = e.timeStamp;
      return;
    }
    if (e.pointerType !== "mouse") return;
    const mo = pointer.inside ? hit(x, y) : null;
    if (mo !== hovered) {
      hovered = mo;
      el.classList.toggle("over-mote", Boolean(mo));
      if (mo) {
        touch(mo);
        show(mo);
      } else if (pinned) show(pinned);
      else hideSoon();
    }
  });

  el.addEventListener("pointerleave", () => {
    pointer.inside = false;
    if (hovered) {
      hovered = null;
      el.classList.remove("over-mote");
      if (pinned) show(pinned);
      else hideSoon();
    }
  });

  el.addEventListener("pointerdown", (e) => {
    audio.unlock();
    const [x, y] = local(e);
    if (Math.hypot(x - cx, y - cy) > R * 1.05) return;
    drag = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: e.timeStamp, moved: false };
    rot.target = null;
    el.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
  });

  const endDrag = (e, cancelled) => {
    if (!drag) return;
    const wasDrag = drag.moved;
    drag = null;
    el.classList.remove("dragging");
    if (wasDrag || cancelled) return;
    // a tap, not a turn: read the light under it, or send a ripple through the glass
    const [x, y] = local(e);
    pointer.x = x;
    pointer.y = y;
    const onWords = featureBox && featured && x > featureBox.x0 && x < featureBox.x1 && y > featureBox.y0 && y < featureBox.y1;
    const mo = hit(x, y, e.pointerType !== "mouse") ?? (onWords ? featured : null);
    if (mo) {
      pinned = mo;
      keyIndex = motes.indexOf(mo);
      touch(mo);
      show(mo, { announceIt: true });
    } else {
      pinned = null;
      if (!hovered) hideSoon();
      ripple(x, y, NEUTRAL.a);
      const near = motes.filter((m) => Math.hypot(m.sx - x, m.sy - y) < R * 0.5);
      if (near.length) audio.play(near[Math.floor(rand(0, near.length))].trace.kind, "touch", 0.25);
    }
  };
  el.addEventListener("pointerup", (e) => endDrag(e, false));
  el.addEventListener("pointercancel", (e) => endDrag(e, true));

  el.addEventListener("keydown", (e) => {
    if (!motes.some(shown)) return;
    const moves = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
    const n = motes.length;
    // step through only the lights currently shown
    const stepFrom = (from, dir) => {
      let i = from;
      do i = (i + dir + n) % n;
      while (!shown(motes[i]));
      return i;
    };
    if (e.key in moves) {
      e.preventDefault();
      keyIndex = stepFrom(keyIndex < 0 ? (moves[e.key] > 0 ? n - 1 : 0) : keyIndex, moves[e.key]);
    } else if (e.key === "Home") {
      e.preventDefault();
      keyIndex = stepFrom(n - 1, 1);
    } else if (e.key === "End") {
      e.preventDefault();
      keyIndex = stepFrom(0, -1);
    } else if (e.key === "Escape") {
      pinned = null;
      hideSoon();
      announce.textContent = "";
      return;
    } else return;
    audio.unlock();
    pinned = motes[keyIndex];
    face(pinned);
    touch(pinned);
    show(pinned, { announceIt: true });
  });

  function ripple(x, y, rgb) {
    if (reducedMotion.matches) return;
    ripples.push({ x, y, age: 0, life: 1.4, rgb });
  }

  // ---------------------------------------------------------------- loop

  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(el);
  new ResizeObserver(resize).observe(el);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (visible && W > 0) {
      step(dt);
      draw();
    }
    requestAnimationFrame(frame);
  }

  setTraces(traces);
  resize();
  requestAnimationFrame(frame);

  setInterval(() => {
    // timestamps age while the page sits open
    const lit = pinned ?? hovered;
    if (lit && reveal.classList.contains("shown")) {
      const time = reveal.querySelector("time");
      if (time) time.textContent = `passed through ${relativeTime(lit.trace.createdAt)}`;
    }
  }, 30_000);

  /** Holds a thought still and reads it out: the manual way through the cycle. */
  function pinAndShow(mo) {
    pinned = mo;
    keyIndex = motes.indexOf(mo);
    face(mo);
    touch(mo);
    show(mo, { announceIt: true });
  }

  return {
    /** Turns the living display on or off; off, the glass waits to be browsed by hand. */
    setCycling(on, { pin = true } = {}) {
      cycling = on;
      if (!on && pin && featured && shown(featured) && !pinned) pinAndShow(featured);
      if (on && pinned) {
        pinned = null;
        hideSoon();
      }
      featureClock = 0;
    },
    get cycling() {
      return cycling;
    },
    /** One step through the cycle by hand (dir 1 or -1); it stays until let go or stepped again. */
    browse(dir) {
      const mo = nextInOrder(dir);
      if (!mo) return;
      feature(mo);
      pinAndShow(mo);
    },
    /** Marks the thoughts the model is reading now; returns a function giving each one's live position. */
    inspire(ids) {
      const chosen = motes.filter((mo) => ids.includes(mo.trace.id));
      chosen.forEach((mo) => (mo.inspired = 2.4));
      return chosen.map((mo) => ({ kind: mo.trace.kind, at: () => onScreen(mo) }));
    },
    /** Shows only one kind of thought (or all, given null); the rest dim to points. */
    only(kind) {
      only = kind;
      if (pinned && !shown(pinned)) pinned = null;
      if (hovered && !shown(hovered)) hovered = null;
      if (!pinned) hideSoon();
      const matching = motes.filter(shown);
      if (kind && !reducedMotion.matches) matching.forEach((mo) => (mo.burst = rand(-0.4, 0)));
      // the burst clock counts up from a small negative delay, so they answer in a ripple, not all at once
      announce.textContent = kind
        ? `Showing only ${META[kind].name.toLowerCase()}: ${matching.length === 1 ? "one thought" : `${matching.length} thoughts`}.`
        : `Showing every thought: ${motes.length}.`;
      return matching.length;
    },
    /** Where, in viewport coordinates, a released thought should fly to. */
    centre() {
      const r = canvas.getBoundingClientRect();
      return [r.left + r.width / 2, r.top + r.height / 2];
    },
    /** A thought has reached the glass: it joins at the front, lit, and is read out. */
    receive(trace) {
      if (motes.some((mo) => mo.trace.id === trace.id)) return;
      const mo = makeMote(trace, 0, 1);
      // place it just in front of centre in the ball's current orientation
      const inv = (v) => {
        const [x, y, z] = v;
        const cp = Math.cos(-rot.pitch);
        const sp = Math.sin(-rot.pitch);
        const y1 = y * cp - z * sp;
        const z1 = y * sp + z * cp;
        const cyw = Math.cos(-rot.yaw);
        const syw = Math.sin(-rot.yaw);
        return [x * cyw + z1 * syw, y1, -x * syw + z1 * cyw];
      };
      mo.v = inv([rand(-0.12, 0.12), rand(-0.1, 0.1), 0.62]);
      mo.fresh = 8;
      motes.unshift(mo);
      order.splice(orderPos + 1, 0, mo);
      refreshFogMix();
      pulse = 1;
      pulseRgb = mo.m.a;
      ripple(cx, cy, mo.m.a);
      audio.arrive(trace.kind);
      pinned = mo;
      keyIndex = 0;
      hovered = null;
      rot.vyaw = 0;
      // let the ball settle before the light is read out
      setTimeout(() => {
        if (pinned === mo) show(mo, { announceIt: true });
      }, 60);
    },
    /** Someone else, somewhere else, just let a thought go: it falls in from above. */
    arriveFromElsewhere(trace) {
      if (motes.some((mo) => mo.trace.id === trace.id)) return false;
      const mo = makeMote(trace, Math.floor(rand(0, 20)), 20);
      mo.fresh = 5;
      motes.unshift(mo);
      // someone else's new thought is the next one the glass holds up
      order.splice(orderPos + 1, 0, mo);
      if (keyIndex >= 0) keyIndex++;
      refreshFogMix();
      if (!reducedMotion.matches) {
        streaks.push({ x0: cx + rand(-R * 0.6, R * 0.6), y0: -10, x1: cx + rand(-R * 0.3, R * 0.3), y1: cy, age: 0, life: 1.2, rgb: mo.m.a });
        setTimeout(() => {
          pulse = 0.6;
          pulseRgb = mo.m.a;
          ripple(cx, cy, mo.m.a);
        }, 900);
      }
      announce.textContent = `Someone else just let go of ${mo.m.label}: ${trace.text}`;
      return true;
    },
  };
}
