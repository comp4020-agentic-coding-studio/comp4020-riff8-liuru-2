// Every sound but the Bubble music is synthesised here with the Web Audio API:
// six small palettes, one per as-if, so nothing depends on a remote file and
// nothing needs a licence beyond this repo's own.

import { rand } from "./util.js";

const MUTE_KEY = "liuru-muted";
const MUSIC_URL = "/assets/bubble_background_music.mp3";
const MUSIC_LEVEL = 0.2;

let ctx = null;
let master = null;
let dry = null;
let verbIn = null;
let noiseBuf = null;
let brownBuf = null;
let music = null; // { gain, source } once playing
let musicBuffer = null;
let musicWanted = false;
let muted = sessionStorage.getItem(MUTE_KEY) === "1";
const lastPlayed = new Map();
const listeners = new Set();

export const isMuted = () => muted;
export const isReady = () => ctx !== null;
export const onChange = (fn) => listeners.add(fn);

/** Called from a user gesture: the only moment a browser lets audio begin. */
export function unlock() {
  if (ctx) {
    if (ctx.state === "suspended" && !document.hidden) ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -14;
  limiter.ratio.value = 8;
  master.connect(limiter).connect(ctx.destination);
  dry = ctx.createGain();
  dry.connect(master);

  const verb = ctx.createConvolver();
  verb.buffer = impulse(2.8, 2.4);
  verbIn = ctx.createGain();
  verbIn.gain.value = 0.6;
  verbIn.connect(verb).connect(master);

  noiseBuf = makeNoise(false);
  brownBuf = makeNoise(true);

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) ctx.suspend();
    else ctx.resume();
  });
  if (musicWanted) startMusic();
  listeners.forEach((fn) => fn());
}

export function setMuted(value) {
  muted = value;
  sessionStorage.setItem(MUTE_KEY, value ? "1" : "0");
  if (ctx) {
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(value ? 0 : 0.9, t, 0.08);
  }
  listeners.forEach((fn) => fn());
}

function impulse(seconds, decay) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** decay;
  }
  return buf;
}

function makeNoise(brown) {
  const len = ctx.sampleRate * 2;
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else d[i] = white;
  }
  return buf;
}

/** Routes a node to the dry bus and, by `send`, to the reverb; panned if asked. */
function out(node, { pan = 0, send = 0.3 } = {}) {
  let tail = node;
  if (pan) {
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    tail = tail.connect(p);
  }
  tail.connect(dry);
  if (send > 0) {
    const s = ctx.createGain();
    s.gain.value = send;
    tail.connect(s).connect(verbIn);
  }
  return tail;
}

function tone(freq, o = {}) {
  const {
    type = "sine",
    at = 0,
    attack = 0.005,
    decay = 0.6,
    gain = 0.1,
    glideTo,
    glideTime = 0.1,
    pan = 0,
    panTo,
    send = 0.3,
    reverse = false,
    filter,
  } = o;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t + glideTime);
  const g = ctx.createGain();
  if (reverse) {
    // swells in and stops dead: a sound played backwards
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.linearRampToValueAtTime(0.0001, t + attack + 0.03);
  } else {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }
  let chain = osc.connect(g);
  if (filter) {
    const f = ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filter;
    chain = chain.connect(f);
  }
  const p = ctx.createStereoPanner();
  p.pan.setValueAtTime(pan, t);
  if (panTo !== undefined) p.pan.linearRampToValueAtTime(panTo, t + attack + (reverse ? 0 : decay * 0.5));
  out(chain.connect(p), { send });
  osc.start(t);
  osc.stop(t + attack + (reverse ? 0.05 : decay) + 0.05);
}

function noise(o = {}) {
  const {
    at = 0,
    dur = 0.3,
    attack = 0.01,
    gain = 0.1,
    type = "bandpass",
    freq = 1000,
    freqTo,
    q = 1,
    pan = 0,
    send = 0.2,
    brown = false,
  } = o;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource();
  src.buffer = brown ? brownBuf : noiseBuf;
  src.loop = true;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (freqTo) f.frequency.exponentialRampToValueAtTime(freqTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  out(src.connect(f).connect(g), { pan, send });
  src.start(t, rand(0, 1.5));
  src.stop(t + dur + 0.05);
}

const BELL = [1, 2.76, 5.4, 8.93];
const bell = (f, at = 0, gain = 0.05, pan = 0) =>
  BELL.forEach((r, i) => tone(f * r, { at, gain: gain / (i + 1) ** 1.3, decay: 2.6 / (i + 1), pan, send: 0.7 }));

const pop = (at = 0, gain = 0.11, f0 = rand(320, 620)) => {
  tone(f0, { at, glideTo: f0 * 2.7, glideTime: 0.07, attack: 0.004, decay: 0.08, gain, pan: rand(-0.5, 0.5), send: 0.15 });
  noise({ at: at + 0.06, dur: 0.02, gain: gain * 0.3, type: "highpass", freq: 4000, send: 0 });
};

const plink = (at = 0, gain = 0.09, f = rand(1400, 2300)) => {
  tone(f, { at, glideTo: f * 0.55, glideTime: 0.05, attack: 0.002, decay: 0.22, gain, pan: rand(-0.4, 0.4), send: 0.55 });
  tone(f * 0.8, { at: at + 0.11, glideTo: f * 0.45, glideTime: 0.05, attack: 0.002, decay: 0.16, gain: gain * 0.35, send: 0.6 });
};

const crackle = (at = 0, gain = 0.07, grains = 8) => {
  let t = at;
  for (let i = 0; i < grains; i++) {
    noise({ at: t, dur: rand(0.004, 0.012), attack: 0.001, gain: gain * rand(0.4, 1), type: "highpass", freq: rand(2500, 6000), pan: rand(-0.6, 0.6), send: 0.05 });
    t += rand(0.006, 0.03);
  }
};

const whoosh = (at = 0, dur = 0.6, gain = 0.07, from = 1100, to = 180) =>
  noise({ at, dur, attack: dur * 0.45, gain, type: "bandpass", freq: from, freqTo: to, q: 1.4, pan: rand(-0.3, 0.3), send: 0.4 });

const zap = (at = 0, gain = 0.05) => {
  tone(1500, { at, type: "sawtooth", glideTo: 70, glideTime: 0.22, attack: 0.002, decay: 0.24, gain, filter: 3200, send: 0.2 });
  crackle(at, 0.06, 6);
};

const PENTA = [587.3, 659.3, 740, 880, 987.8, 1174.7, 1318.5];

const RECIPES = {
  dream: {
    hover: () => bell(PENTA[Math.floor(rand(3, 7))], 0, 0.045, rand(-0.4, 0.4)),
    touch: () => bell(PENTA[Math.floor(rand(2, 7))], 0, 0.035, rand(-0.5, 0.5)),
    select: () => {
      [293.7, 370, 440, 554.4].forEach((f, i) =>
        tone(f, { type: i % 2 ? "triangle" : "sine", attack: 0.7, decay: 2.8, gain: 0.03, pan: (i - 1.5) * 0.3, send: 0.8, filter: 1800 }),
      );
      bell(1174.7, 0.25, 0.04);
    },
    release: () => PENTA.forEach((f, i) => bell(f, i * 0.11, 0.035, (i / 6) * 1.2 - 0.6)),
  },
  illusion: {
    hover: () => {
      const f = rand(620, 920);
      tone(f, { type: "triangle", reverse: true, attack: 0.32, gain: 0.05, pan: -0.8, panTo: 0.8, send: 0.5 });
      tone(f * 1.006, { type: "sine", reverse: true, attack: 0.32, gain: 0.04, pan: 0.8, panTo: -0.8, send: 0.5 });
    },
    touch: () => tone(rand(900, 1300), { reverse: true, attack: 0.22, gain: 0.04, pan: rand(-1, 1), panTo: rand(-1, 1), send: 0.6 }),
    select: () => {
      tone(1200, { attack: 0.01, decay: 1.8, gain: 0.04, pan: -0.5, send: 0.6 });
      tone(1207, { attack: 0.01, decay: 1.8, gain: 0.04, pan: 0.5, send: 0.6 });
      tone(480, { type: "triangle", reverse: true, attack: 0.5, gain: 0.05, glideTo: 720, glideTime: 0.5, send: 0.4 });
    },
    release: () => {
      [440, 554.4, 659.3].forEach((f, i) => tone(f, { type: "triangle", reverse: true, attack: 0.7, gain: 0.04, pan: i - 1, panTo: 0, send: 0.5 }));
      tone(2200, { at: 0.72, glideTo: 300, glideTime: 0.6, decay: 0.7, gain: 0.03, pan: 0.6, panTo: -0.6, send: 0.7 });
    },
  },
  bubble: {
    hover: () => pop(0, 0.09),
    touch: () => pop(0, 0.08, rand(500, 800)),
    pop: () => pop(0, 0.12, rand(260, 520)),
    select: () => {
      pop(0, 0.1, 380);
      pop(0.09, 0.08, 520);
    },
    release: () => {
      let t = 0;
      for (let i = 0; i < 7; i++) {
        pop(t, 0.09, 300 + i * 70);
        t += rand(0.05, 0.12);
      }
    },
  },
  shadow: {
    hover: () => {
      whoosh(0, 0.55, 0.06);
      tone(55, { attack: 0.2, decay: 0.7, gain: 0.08, send: 0.3 });
    },
    touch: () => whoosh(0, 0.45, 0.05, 700, 150),
    select: () => {
      [55, 82.4].forEach((f) => tone(f, { attack: 0.6, decay: 2.4, gain: 0.08, send: 0.5 }));
      tone(110, { type: "sawtooth", attack: 0.8, decay: 2, gain: 0.025, filter: 320, send: 0.6 });
      whoosh(0.1, 0.8, 0.05);
    },
    release: () => {
      whoosh(0, 1.4, 0.09, 1600, 90);
      tone(48, { at: 0.9, attack: 0.02, decay: 1.2, gain: 0.16, glideTo: 36, glideTime: 0.8, send: 0.4 });
    },
  },
  dew: {
    hover: () => plink(0, 0.08),
    touch: () => plink(0, 0.07, rand(1700, 2600)),
    select: () => {
      tone(1568, { type: "triangle", decay: 1.3, gain: 0.03, pan: -0.3, send: 0.7 });
      tone(2093, { type: "sine", at: 0.06, decay: 1.4, gain: 0.03, pan: 0.3, send: 0.7 });
      plink(0.15, 0.08);
    },
    release: () => {
      let t = 0;
      for (let i = 0; i < 8; i++) {
        plink(t, 0.07, 2400 - i * 160 + rand(-60, 60));
        t += rand(0.06, 0.16);
      }
    },
  },
  lightning: {
    hover: () => crackle(0, 0.06, 7),
    touch: () => crackle(0, 0.06, 5),
    select: () => zap(0, 0.045),
    release: () => {
      zap(0, 0.05);
      noise({ at: 0.18, dur: 2.2, attack: 0.06, gain: 0.16, type: "lowpass", freq: 420, freqTo: 110, brown: true, send: 0.5 });
    },
  },
};

/** Plays one kind's sound for one action, at most once per `gap` seconds. */
export function play(kind, action, gap = 0.12) {
  if (!ctx || muted || ctx.state !== "running") return;
  const recipe = RECIPES[kind]?.[action];
  if (!recipe) return;
  const key = `${kind}:${action}`;
  const now = ctx.currentTime;
  if (now - (lastPlayed.get(key) ?? -1) < gap) return;
  lastPlayed.set(key, now);
  recipe();
}

/** The orb taking in a thought: a low warm swell under the kind's own sound. */
export function arrive(kind) {
  if (!ctx || muted) return;
  [130.8, 196, 261.6].forEach((f, i) => tone(f, { attack: 0.4, decay: 2.2, gain: 0.035, pan: (i - 1) * 0.4, send: 0.8, filter: 1200 }));
  play(kind, "touch", 0);
}

// ---- the Bubble music: the one recorded sound, looped while Bubble is chosen

export function wantMusic(on) {
  musicWanted = on;
  if (!ctx) return;
  if (on) startMusic();
  else stopMusic();
}

async function startMusic() {
  if (music) return;
  const gain = ctx.createGain();
  gain.gain.value = 0.0001;
  gain.connect(master);
  music = { gain, source: null };
  try {
    if (!musicBuffer) {
      const res = await fetch(MUSIC_URL);
      if (!res.ok) throw new Error(`music: ${res.status}`);
      musicBuffer = await ctx.decodeAudioData(await res.arrayBuffer());
    }
  } catch (err) {
    console.warn("bubble music unavailable", err);
    music = null;
    return;
  }
  if (!musicWanted || music?.gain !== gain) return;
  const source = ctx.createBufferSource();
  source.buffer = musicBuffer;
  source.loop = true;
  source.connect(gain);
  source.start();
  music.source = source;
  gain.gain.setTargetAtTime(MUSIC_LEVEL, ctx.currentTime, 0.6);
}

function stopMusic() {
  if (!music) return;
  const { gain, source } = music;
  music = null;
  const t = ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setTargetAtTime(0.0001, t, 0.4);
  if (source) source.stop(t + 2);
  setTimeout(() => gain.disconnect(), 2200);
}
