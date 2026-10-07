// The six as-ifs, as the client draws and sounds them. The server's own copy
// (src/templates.ts) owns the words; this owns the colours.

export const KINDS = ["dream", "illusion", "bubble", "shadow", "dew", "lightning"];

export const META = {
  dream: { hanzi: "夢", glyph: "☁", name: "Dream", label: "a dream", a: [195, 180, 255], b: [44, 36, 112], c: [242, 220, 168] },
  illusion: { hanzi: "幻", glyph: "◈", name: "Illusion", label: "an illusion", a: [255, 122, 217], b: [27, 53, 80], c: [111, 242, 255] },
  bubble: { hanzi: "泡", glyph: "○", name: "Bubble", label: "a bubble", a: [143, 244, 230], b: [23, 63, 79], c: [255, 179, 223] },
  shadow: { hanzi: "影", glyph: "◐", name: "Shadow", label: "a shadow", a: [179, 147, 255], b: [18, 10, 28], c: [178, 58, 90] },
  dew: { hanzi: "露", glyph: "•", name: "Dew", label: "dew", a: [154, 217, 255], b: [18, 51, 58], c: [159, 240, 196] },
  lightning: { hanzi: "電", glyph: "⚡", name: "Lightning", label: "a flash of lightning", a: [255, 232, 107], b: [26, 35, 80], c: [140, 182, 255] },
};

export const NEUTRAL = { a: [201, 194, 230], b: [58, 49, 104], c: [233, 217, 176] };

export const rgba = ([r, g, b], a = 1) => `rgba(${r | 0},${g | 0},${b | 0},${a})`;
