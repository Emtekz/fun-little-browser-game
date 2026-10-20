// Monster-Grafik (übernommen aus Runenwacht) + gemeinsame Zeichen-Helfer

export const TAU = Math.PI * 2;
const rand = (a, b) => a + Math.random() * (b - a);

export function seeded(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clampV = (v) => Math.max(-0.9, Math.min(0.9, v));
function hashStr(s) { let h = 2166136261; for (const ch of s) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h; }

// ---------------------------------------------------------------- Farben
const shadeCache = new Map();
export function shade(hex, amt) {
  const k = hex + amt;
  let v = shadeCache.get(k);
  if (v) return v;
  const n = parseInt(hex.slice(1), 16);
  let r = n >> 16, gg = (n >> 8) & 255, b = n & 255;
  if (amt > 0) { r += (255 - r) * amt; gg += (255 - gg) * amt; b += (255 - b) * amt; }
  else { r *= 1 + amt; gg *= 1 + amt; b *= 1 + amt; }
  v = `rgb(${r | 0},${gg | 0},${b | 0})`;
  shadeCache.set(k, v);
  return v;
}
function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

// ---------------------------------------------------------------- Qualität & Lichtquellen
let FLAT = false;
export function setFlat(v) { FLAT = v; }
let lightSink = null;
export function setLightSink(fn) { lightSink = fn; }
export function light(x, y, r, color, a = 1) { if (lightSink) lightSink(x, y, r, color, a); }

const glowCache = new Map();
export function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, `rgba(${color},1)`);
  gr.addColorStop(0.3, `rgba(${color},0.5)`);
  gr.addColorStop(1, `rgba(${color},0)`);
  x.fillStyle = gr;
  x.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}
// additiver Schein
export function glow(g, x, y, r, color, a = 1) {
  if (a <= 0) return;
  const op = g.globalCompositeOperation, ga = g.globalAlpha;
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = ga * Math.min(1, a);
  g.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  g.globalAlpha = ga;
  g.globalCompositeOperation = op;
}

// ---------------------------------------------------------------- Sprite-Cache
const spriteCache = new Map();
export function sprite(key, w, h, ax, ay, draw) {
  let s = spriteCache.get(key);
  if (s) return s;
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const x = c.getContext('2d');
  x.scale(2, 2);
  x.translate(ax, ay);
  draw(x);
  s = { c, w, h, ax, ay };
  spriteCache.set(key, s);
  return s;
}
export function blit(g, s, x, y) { g.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h); }

// ---------------------------------------------------------------- Grundformen
export const OL = 'rgba(28,16,10,0.85)';
export function circ(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
export function ell(g, x, y, rx, ry, fill, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fillStyle = fill; g.fill(); }
export function stroke(g, w = 1.4, col = OL) { g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
export function sphereGrad(g, x, y, r, col) {
  if (FLAT) return col;
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.08);
  gr.addColorStop(0, shade(col, 0.4));
  gr.addColorStop(0.55, col);
  gr.addColorStop(1, shade(col, -0.45));
  return gr;
}
export function ball(g, x, y, r, col, ol = true) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = sphereGrad(g, x, y, r, col); g.fill();
  if (ol) stroke(g);
}
export function oval(g, x, y, rx, ry, col, rot = 0, ol = true) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fillStyle = sphereGrad(g, x, y, Math.max(rx, ry), col); g.fill();
  if (ol) stroke(g);
}
export function poly(g, pts, fill, ol = true, w = 1.4) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (ol) stroke(g, w);
}
export function line(g, x1, y1, x2, y2, col, w) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = col; g.stroke();
}
export function linGrad(g, x1, y1, x2, y2, stops) {
  if (FLAT) return stops[Math.floor(stops.length / 2)][1];
  const gr = g.createLinearGradient(x1, y1, x2, y2);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
// zwei Beine mit Laufanimation
export function legs(g, p, xs, top, len, col, w) {
  for (let i = 0; i < xs.length; i++) {
    const s = Math.sin(p + i * Math.PI);
    line(g, xs[i], top, xs[i] + s * len * 0.4, -Math.max(0, Math.cos(p + i * Math.PI)) * 2, OL, w + 2);
    line(g, xs[i], top, xs[i] + s * len * 0.4, -Math.max(0, Math.cos(p + i * Math.PI)) * 2, col, w);
  }
}
export function eye(g, x, y, r, col = '#fff', pupil = '#111') {
  circ(g, x, y, r, col);
  if (pupil) circ(g, x + r * 0.3, y, r * 0.55, pupil);
}

// ================================================================ Gegner
// Jede Funktion zeichnet mit (0,0) = Fußpunkt, Blickrichtung nach rechts.
const ART = {
  goblin(g, e, t) {
    const p = t * 12;
    legs(g, p, [-2.5, 2.5], -7, 7, '#4a3218', 2.4);
    ball(g, 0, -10, 6.5, '#6a4424');
    line(g, -1, -13, 4, -6, '#3a2410', 1.2);
    for (const s of [-1, 1]) poly(g, [[s * 3 + 1, -19], [s * 14 + 1, -24], [s * 4 + 1, -15]], e.def.color, true, 1);
    ball(g, 1, -18, 6.8, e.def.color);
    eye(g, 3.5, -19, 1.9, '#ffe55a'); eye(g, 7, -19, 1.6, '#ffe55a');
    poly(g, [[3, -14], [8, -15], [6, -13]], '#3a5a1a', false);
    line(g, 6, -9, 13, -14, OL, 3); line(g, 6, -9, 13, -14, '#d8d8e0', 1.6);
  },
  orc(g, e, t) {
    const p = t * 9;
    legs(g, p, [-3.5, 3.5], -9, 9, '#3a2a1a', 3.6);
    oval(g, 0, -14, 8.5, 9, '#5a3a22');
    ball(g, 0, -15, 7.5, e.def.color);
    ball(g, -5, -19, 4.5, '#8a8a92');
    ball(g, 2, -25, 6.5, e.def.color);
    g.beginPath(); g.arc(2, -26, 6.8, Math.PI * 1.05, Math.PI * 1.95); g.fillStyle = '#6a6a72'; g.fill(); stroke(g, 1);
    eye(g, 5, -26, 1.4, '#ff4a2a', null); eye(g, 7.5, -26, 1.2, '#ff4a2a', null);
    poly(g, [[5, -21], [6, -24], [7, -21]], '#fffbe8', false); poly(g, [[7.5, -21], [8.5, -24], [9.5, -21]], '#fffbe8', false);
    const sw = Math.sin(t * 4) * 0.3;
    g.save(); g.translate(7, -13); g.rotate(-0.4 + sw);
    line(g, 0, 0, 0, -16, '#5a3a1a', 2.2);
    g.beginPath(); g.moveTo(0, -16); g.quadraticCurveTo(9, -15, 7, -7); g.lineTo(0, -10); g.closePath(); g.fillStyle = '#b8bcc4'; g.fill(); stroke(g, 1);
    g.restore();
  },
  wolf(g, e, t) {
    const p = t * 16, c = e.def.color;
    g.beginPath(); g.moveTo(-9, -11); g.quadraticCurveTo(-17, -16 + Math.sin(p * 0.7) * 3, -20, -10); g.lineWidth = 4.5; g.strokeStyle = OL; g.stroke();
    g.lineWidth = 3; g.strokeStyle = c; g.stroke();
    for (const [lx, ph] of [[-7, 0], [-4, Math.PI], [5, Math.PI * 0.5], [8, Math.PI * 1.5]]) {
      const s = Math.sin(p + ph);
      line(g, lx, -8, lx + s * 4, 0, OL, 4); line(g, lx, -8, lx + s * 4, 0, shade(c, -0.15), 2.4);
    }
    oval(g, 0, -11, 11, 6, c);
    ball(g, 10, -15, 5.5, c);
    oval(g, 15, -13.5, 4.5, 2.6, shade(c, 0.1));
    circ(g, 19, -14, 1.3, '#111');
    poly(g, [[7, -19], [8, -25], [11, -19]], c, true, 1);
    poly(g, [[10, -19], [12, -24], [13, -18]], shade(c, -0.1), true, 1);
    circ(g, 12, -16, 1.4, '#ff3a2a');
    glow(g, 12, -16, 4, '255,60,40', 0.6);
  },
  bat(g, e, t) {
    const flap = Math.sin(t * 18);
    for (const s of [-1, 1]) {
      g.save(); g.scale(1, 1);
      const wy = -10 - flap * 9 * (s > 0 ? 1 : 0.85);
      g.beginPath(); g.moveTo(0, -10);
      g.lineTo(s * 8, wy - 2); g.lineTo(s * 20, wy + 1);
      g.quadraticCurveTo(s * 15, -8, s * 13, -5); g.quadraticCurveTo(s * 8, -8, s * 6, -4); g.closePath();
      g.fillStyle = s > 0 ? '#4a2a70' : '#3a1f58'; g.fill(); stroke(g, 1.1);
      line(g, s * 2, -10, s * 13, -5, 'rgba(0,0,0,0.4)', 0.8);
      g.restore();
    }
    ball(g, 0, -9, 6, e.def.color);
    poly(g, [[-4, -13], [-3, -19], [-1, -14]], e.def.color, true, 1); poly(g, [[1, -14], [3, -19], [4, -13]], e.def.color, true, 1);
    circ(g, 2, -10, 1.4, '#ff3a3a'); circ(g, -1.5, -10, 1.2, '#ff3a3a');
    glow(g, 1, -10, 5, '255,60,60', 0.5);
  },
  skeleton(g, e, t) {
    const p = t * 10, bone = e.revived ? '#c8c0a8' : '#ece6d4';
    legs(g, p, [-2.5, 2.5], -9, 9, bone, 1.8);
    line(g, 0, -9, 0, -19, bone, 2.2);
    for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(0.5, -12 - i * 2.6, 4.5 - i * 0.4, 1.4, 0, Math.PI * 1.1, Math.PI * 1.9 + 0.8); g.lineWidth = 1.3; g.strokeStyle = bone; g.stroke(); }
    ball(g, -6, -15, 4.5, '#6a4a2a');
    circ(g, -6, -15, 1.4, '#b8a070');
    ball(g, 1.5, -23, 5.5, bone);
    oval(g, 4, -19.5, 3, 1.8, shade(bone, -0.1));
    circ(g, 3.4, -24, 1.5, '#1a1a1a'); circ(g, 6.2, -24, 1.3, '#1a1a1a');
    const ec = e.revived ? '120,255,120' : '120,230,255';
    glow(g, 4.5, -24, 5, ec, 0.9);
    const sw = Math.sin(t * 4) * 0.25;
    g.save(); g.translate(5, -14); g.rotate(-0.6 + sw);
    line(g, 0, 0, 0, -15, OL, 3); line(g, 0, 0, 0, -15, '#c8ccd4', 1.8);
    line(g, -3, -1, 3, -1, '#6a4a2a', 2);
    g.restore();
  },
  slime(g, e, t) {
    const r = e.r, sq = Math.sin(t * 6) * 0.13;
    g.globalAlpha = 0.88;
    oval(g, 0, -r * 0.6, r * (1.08 + sq), r * (0.78 - sq), e.def.color);
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) circ(g, Math.sin(t + i * 2) * r * 0.4, -r * 0.5 + Math.cos(t * 0.8 + i) * r * 0.2, r * 0.1, 'rgba(255,255,255,0.35)');
    oval(g, -r * 0.4, -r * 0.95, r * 0.28, r * 0.15, 'rgba(255,255,255,0.75)', -0.4, false);
    eye(g, r * 0.25, -r * 0.65, r * 0.17); eye(g, r * 0.62, -r * 0.65, r * 0.15);
  },
  spider(g, e, t) {
    const p = t * 18;
    for (let i = 0; i < 4; i++) {
      for (const s of [-1, 1]) {
        const ph = p + i * 1.4 + (s > 0 ? Math.PI : 0), sw = Math.sin(ph) * 2.5;
        const bx = -2 + i * 2.5, kx = bx + (i - 1.5) * 5 + sw, ky = -13 - s * 1;
        g.beginPath(); g.moveTo(bx, -7); g.lineTo(kx, ky); g.lineTo(kx + (i - 1.5) * 3 + sw, 0);
        g.lineWidth = 2.6; g.strokeStyle = OL; g.stroke(); g.lineWidth = 1.4; g.strokeStyle = s > 0 ? '#4a3a4a' : '#2a1e2a'; g.stroke();
      }
    }
    oval(g, -6, -9, 8, 6.5, e.def.color);
    poly(g, [[-8, -12], [-6, -9], [-8, -6], [-4, -9]], '#c0202a', false);
    ball(g, 4, -8, 4.6, shade(e.def.color, 0.15));
    for (const [ex, ey] of [[6, -10], [7.5, -8.5], [5, -8], [7, -11]]) circ(g, ex, ey, 0.9, '#ff3030');
    glow(g, 6.5, -9.5, 4, '255,40,40', 0.6);
  },
  shaman(g, e, t) {
    const sway = Math.sin(t * 6) * 1;
    legs(g, t * 10, [-2, 2], -6, 6, '#3a2a1a', 2.2);
    poly(g, [[-8, -4], [-4 + sway, -20], [5 + sway, -20], [8, -4]], linGrad(g, -8, 0, 8, 0, [[0, '#6a1a1a'], [0.5, e.def.color], [1, '#5a1414']]));
    for (const [fx, col] of [[-3, '#3fa0ff'], [0, '#f2c14e'], [3, '#3fd06a']]) poly(g, [[fx + sway - 1.5, -25], [fx + sway, -33], [fx + sway + 1.5, -25]], col, true, 0.8);
    ball(g, 1 + sway, -23, 5, '#e8d7b0');
    circ(g, 2.5 + sway, -24, 1.2, '#1a1a1a'); circ(g, 5 + sway, -24, 1.1, '#1a1a1a');
    line(g, 9, 0, 10, -30, OL, 3.2); line(g, 9, 0, 10, -30, '#7a5a2a', 2);
    ball(g, 10, -32, 3.2, '#8aff6a', false);
    glow(g, 10, -32, 12, '120,255,100', 0.8 + Math.sin(t * 5) * 0.2);
    light(e.x, e.y - 30, 30, '120,255,100', 0.5);
  },
  ghost(g, e, t) {
    const fl = 0.55 + Math.sin(t * 7) * 0.15;
    g.globalAlpha = fl;
    g.beginPath();
    g.moveTo(-8, -10); g.arc(0, -20, 8, Math.PI, 0);
    g.lineTo(8, -6);
    for (let i = 0; i <= 4; i++) g.lineTo(8 - i * 4, -3 + Math.sin(t * 8 + i * 1.7) * 2.5 - (i % 2) * 3);
    g.closePath();
    g.fillStyle = linGrad(g, 0, -28, 0, -2, [[0, '#ffffff'], [0.6, e.def.color], [1, 'rgba(160,200,255,0.2)']]);
    g.fill(); stroke(g, 1, 'rgba(60,90,140,0.7)');
    g.globalAlpha = 1;
    oval(g, 1.5, -20, 1.8, 2.8, '#1a2840', 0, false); oval(g, 5.5, -20, 1.6, 2.6, '#1a2840', 0, false);
    oval(g, 3.5, -14, 1.6, 2, '#1a2840', 0, false);
    glow(g, 0, -16, 20, '170,220,255', 0.35);
    light(e.x, e.y - 16, 30, '170,220,255', 0.45);
  },
  golem(g, e, t) {
    const p = t * 7, c = e.def.color;
    for (const [lx, ph] of [[-5, 0], [5, Math.PI]]) {
      const s = Math.sin(p + ph);
      poly(g, [[lx - 3.5 + s * 2, -1], [lx - 3.5, -10], [lx + 3.5, -10], [lx + 3.5 + s * 2, -1]], shade(c, -0.15), true, 1.2);
    }
    g.beginPath(); g.roundRect(-11, -29, 22, 21, 5);
    g.fillStyle = linGrad(g, -11, -29, 11, -8, [[0, shade(c, 0.3)], [0.5, c], [1, shade(c, -0.4)]]); g.fill(); stroke(g, 1.5);
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(-4, -29); g.lineTo(-1, -21); g.lineTo(-6, -14); g.moveTo(6, -27); g.lineTo(3, -20); g.stroke();
    ell(g, -5, -27, 5, 2, 'rgba(90,150,60,0.8)');
    const sw = Math.sin(p) * 2;
    ball(g, -13, -16 + sw, 5.5, shade(c, -0.05)); ball(g, 13, -16 - sw, 5.5, shade(c, -0.05));
    g.beginPath(); g.roundRect(-3, -36, 12, 9, 3); g.fillStyle = shade(c, 0.1); g.fill(); stroke(g, 1.2);
    circ(g, 3, -32, 1.6, '#ffb040'); circ(g, 7, -32, 1.5, '#ffb040');
    glow(g, 5, -32, 7, '255,160,50', 0.8);
    g.strokeStyle = '#ffa030'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(-3, -19); g.lineTo(0, -16); g.lineTo(3, -19); g.stroke();
  },
  knight(g, e, t) {
    const p = t * 9, steel = e.def.color;
    // Banner auf dem Rücken
    line(g, -7, -10, -9, -40, '#3a2a1a', 1.8);
    g.beginPath(); g.moveTo(-9, -40);
    g.quadraticCurveTo(-15, -38 + Math.sin(t * 5) * 2, -20, -37 + Math.sin(t * 5 + 1) * 3);
    g.lineTo(-18, -30); g.lineTo(-8.5, -31); g.closePath(); g.fillStyle = '#4a1a2a'; g.fill(); stroke(g, 1);
    circ(g, -14, -34, 1.8, '#e8b84a');
    legs(g, p, [-3, 3], -9, 9, shade(steel, -0.2), 3.4);
    oval(g, 0, -16, 8, 8.5, steel);
    ball(g, 1, -27, 6, shade(steel, 0.1));
    g.fillStyle = '#111'; g.fillRect(2, -28, 6, 1.6);
    glow(g, 5, -27, 5, '255,60,40', 0.7);
    poly(g, [[0, -33], [-4, -40], [2, -34]], '#c0202a', true, 1);
    g.beginPath(); g.moveTo(5, -21); g.lineTo(14, -21); g.lineTo(14, -12); g.quadraticCurveTo(14, -5, 9.5, -3); g.quadraticCurveTo(5, -5, 5, -12); g.closePath();
    g.fillStyle = linGrad(g, 5, -21, 14, -3, [[0, '#5a5f6a'], [1, '#2a2d34']]); g.fill(); stroke(g, 1.3);
    circ(g, 9.5, -13, 2.2, '#d8d0c0'); circ(g, 8.8, -13.5, 0.6, '#111'); circ(g, 10.2, -13.5, 0.6, '#111');
  },
  firelem(g, e, t) {
    glow(g, 0, -16, 26, '255,120,30', 0.8);
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (const [col, sc] of [['#c8300a', 1], ['#ff7a1a', 0.75], ['#ffd040', 0.5]]) {
      for (let i = -2; i <= 2; i++) {
        const h = (24 - Math.abs(i) * 4) * sc * (0.85 + 0.2 * Math.sin(t * 12 + i * 1.7));
        const fx = i * 4 * sc;
        g.beginPath(); g.moveTo(fx - 5 * sc, -2);
        g.quadraticCurveTo(fx - 6 * sc, -h * 0.6, fx + Math.sin(t * 8 + i) * 2, -h - 4);
        g.quadraticCurveTo(fx + 6 * sc, -h * 0.6, fx + 5 * sc, -2);
        g.fillStyle = col; g.globalAlpha = 0.75; g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = op;
    ball(g, 0, -12, 5, '#3a1a0a', false);
    circ(g, 1.5, -13, 1.4, '#fff8c0'); circ(g, 4, -13, 1.3, '#fff8c0');
    light(e.x, e.y - 14, 55, '255,130,40', 0.9);
  },
  gargoyle(g, e, t) {
    const flap = Math.sin(t * 9), c = e.def.color;
    for (const s of [-1, 1]) {
      const wy = -16 - flap * 8;
      g.beginPath(); g.moveTo(-1, -13);
      g.lineTo(s * 9, wy - 3); g.lineTo(s * 21, wy + 2); g.lineTo(s * 17, -10); g.lineTo(s * 12, -9); g.lineTo(s * 7, -6); g.closePath();
      g.fillStyle = s > 0 ? shade(c, -0.1) : shade(c, -0.3); g.fill(); stroke(g, 1.1);
    }
    g.beginPath(); g.moveTo(-6, -8); g.quadraticCurveTo(-14, -4, -14, -12); g.lineWidth = 2; g.strokeStyle = shade(c, -0.2); g.stroke();
    oval(g, 0, -11, 7, 7, c);
    ball(g, 4, -18, 5, c);
    poly(g, [[2, -22], [0, -28], [4, -23]], '#d8d0c0', true, 0.8); poly(g, [[5, -22], [6, -28], [7, -22]], '#d8d0c0', true, 0.8);
    circ(g, 6, -18.5, 1.3, '#ffd23a'); circ(g, 8, -18.5, 1.2, '#ffd23a');
    glow(g, 7, -18.5, 5, '255,210,60', 0.6);
  },
  assassin(g, e, t) {
    const p = t * 13, c = e.def.color;
    g.beginPath(); g.moveTo(-1, -20);
    g.quadraticCurveTo(-10, -22 + Math.sin(t * 9) * 2, -17, -18 + Math.sin(t * 9 + 1) * 3);
    g.lineTo(-15, -15); g.quadraticCurveTo(-8, -17, -1, -17); g.fillStyle = '#8a3ac8'; g.fill(); stroke(g, 0.9);
    legs(g, p, [-2.5, 2.5], -8, 8, '#1a1424', 2.4);
    poly(g, [[-7, -5], [-3, -22], [4, -22], [7, -5]], linGrad(g, -7, 0, 7, 0, [[0, '#1e1828'], [0.5, c], [1, '#17121f']]));
    ball(g, 1, -24, 5.5, '#241c30');
    oval(g, 3.5, -24, 3.6, 3, '#0a0810', 0, false);
    circ(g, 3, -24.5, 1, '#d080ff'); circ(g, 5.2, -24.5, 0.9, '#d080ff');
    glow(g, 4, -24.5, 5, '200,110,255', 0.8);
    for (const s of [-1, 1]) line(g, s * 5 + 2, -12, s * 5 + 9, -16 + s * 2, '#e0e4ec', 1.4);
  },
  minotaur(g, e, t) {
    const rage = e.enraged, p = t * (rage ? 14 : 8), c = e.def.color;
    legs(g, p, [-4, 4], -11, 11, shade(c, -0.25), 4.4);
    for (const lx of [-4, 4]) ell(g, lx + Math.sin(p + (lx > 0 ? Math.PI : 0)) * 4.4, 0, 3, 1.5, '#222');
    oval(g, 0, -20, 11, 11, c);
    oval(g, 2, -18, 6, 7, shade(c, 0.2), 0, false);
    g.fillStyle = '#3a2a1a'; g.fillRect(-10, -13, 20, 3);
    circ(g, 0, -11.5, 2, '#e8b84a');
    ball(g, 6, -33, 7, shade(c, -0.05));
    oval(g, 11, -30, 4.5, 3.5, shade(c, 0.25));
    circ(g, 12.5, -30.5, 0.9, '#111');
    g.beginPath(); g.arc(13, -28, 2, 0.3, Math.PI - 0.3); g.lineWidth = 1.2; g.strokeStyle = '#e8b84a'; g.stroke();
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(4 + s * 3, -38); g.quadraticCurveTo(4 + s * 12, -42, 4 + s * 11, -50);
      g.lineWidth = 4; g.strokeStyle = OL; g.stroke(); g.lineWidth = 2.6; g.strokeStyle = '#f0e6d0'; g.stroke();
    }
    circ(g, 8.5, -35, 1.4, rage ? '#ff2a1a' : '#1a1a1a');
    if (rage) glow(g, 8.5, -35, 6, '255,40,20', 1);
    g.save(); g.translate(11, -20); g.rotate(-0.5 + Math.sin(t * (rage ? 8 : 3)) * 0.4);
    line(g, 0, 0, 0, -24, '#4a2e12', 2.6);
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -22); g.quadraticCurveTo(s * 10, -24, s * 9, -14); g.lineTo(0, -16); g.closePath(); g.fillStyle = '#b8bcc4'; g.fill(); stroke(g, 1); }
    g.restore();
  },
  imp(g, e, t) {
    const flap = Math.sin(t * 20);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(0, -11); g.lineTo(s * 6, -16 - flap * 6); g.lineTo(s * 13, -14 - flap * 5); g.quadraticCurveTo(s * 8, -10, s * 4, -7); g.closePath();
      g.fillStyle = '#5a0e0e'; g.fill(); stroke(g, 0.9);
    }
    g.beginPath(); g.moveTo(-3, -6); g.quadraticCurveTo(-10, -2 + Math.sin(t * 6) * 2, -12, -7); g.lineWidth = 1.2; g.strokeStyle = '#8a1a1a'; g.stroke();
    poly(g, [[-12, -7], [-14, -9], [-11, -10]], '#8a1a1a', false);
    ball(g, 0, -9, 5, e.def.color);
    poly(g, [[-3, -13], [-4, -18], [-1, -14]], '#2a1a1a', false); poly(g, [[1, -14], [3, -18], [3, -13]], '#2a1a1a', false);
    circ(g, 2, -10, 1.2, '#ffe14a'); circ(g, 4, -10, 1.1, '#ffe14a');
    glow(g, 0, -9, 12, '255,90,40', 0.5);
    light(e.x, e.y - 30, 25, '255,100,40', 0.5);
  },
  necro(g, e, t) {
    const sway = Math.sin(t * 3) * 1.2;
    g.beginPath(); g.moveTo(-9, 0); g.lineTo(-5 + sway, -24); g.lineTo(5 + sway, -24); g.lineTo(9, 0);
    for (let i = 0; i <= 6; i++) g.lineTo(9 - i * 3, (i % 2) * -3);
    g.closePath();
    g.fillStyle = linGrad(g, -9, 0, 9, 0, [[0, '#141a14'], [0.5, e.def.color], [1, '#0e130e']]); g.fill(); stroke(g, 1.3);
    line(g, -1 + sway, -22, -3, -2, '#4aff6a', 1.2);
    ball(g, sway, -27, 6.5, '#1a221a');
    oval(g, 2.5 + sway, -27, 4, 3.6, '#050805', 0, false);
    circ(g, 2 + sway, -27.5, 1.1, '#6aff6a'); circ(g, 4.5 + sway, -27.5, 1, '#6aff6a');
    glow(g, 3 + sway, -27.5, 6, '100,255,110', 0.9);
    line(g, 10, 0, 11, -34, OL, 3.2); line(g, 10, 0, 11, -34, '#4a3a2a', 2);
    ball(g, 11, -36, 4, '#e8e2d0');
    circ(g, 10, -36.5, 0.9, '#111'); circ(g, 12.5, -36.5, 0.9, '#111');
    glow(g, 11, -37, 14, '90,255,110', 0.7 + Math.sin(t * 6) * 0.2);
    light(e.x, e.y - 34, 40, '100,255,110', 0.6);
  },
  ent(g, e, t) {
    const p = t * 5;
    for (const [lx, ph] of [[-7, 0], [7, Math.PI]]) {
      const s = Math.sin(p + ph);
      g.beginPath(); g.moveTo(lx - 4, -12); g.quadraticCurveTo(lx + s * 3, -6, lx + s * 5 - 5, 0); g.lineTo(lx + s * 5 + 5, 0); g.quadraticCurveTo(lx + s * 3 + 2, -6, lx + 4, -12); g.closePath();
      g.fillStyle = '#4a3018'; g.fill(); stroke(g, 1.2);
    }
    g.beginPath(); g.moveTo(-11, -10); g.lineTo(-9, -40); g.lineTo(9, -40); g.lineTo(11, -10); g.closePath();
    g.fillStyle = linGrad(g, -11, 0, 11, 0, [[0, '#3a2412'], [0.45, '#7a5432'], [1, '#2e1c0e']]); g.fill(); stroke(g, 1.5);
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
    g.beginPath(); for (const bx of [-6, -1, 4]) { g.moveTo(bx, -38); g.quadraticCurveTo(bx + 2, -25, bx - 1, -12); } g.stroke();
    oval(g, 2, -28, 2.4, 3, '#0a0602', 0, false); oval(g, 7, -28, 2.2, 2.8, '#0a0602', 0, false);
    circ(g, 2, -28, 1.2, '#8aff5a'); circ(g, 7, -28, 1.1, '#8aff5a');
    glow(g, 4.5, -28, 8, '140,255,90', 0.7);
    oval(g, 4.5, -20, 3.5, 1.8, '#0a0602', 0, false);
    const sw = Math.sin(t * 2) * 0.2;
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 9, -32); g.rotate(s * (0.9 + sw));
      line(g, 0, 0, 0, -16, '#4a3018', 3.5); line(g, 0, -10, s * -5, -16, '#4a3018', 2);
      ball(g, 0, -18, 5, '#3a7a2a'); g.restore();
    }
    const blobs = [[-8, -46, 9], [6, -48, 10], [0, -54, 9], [-12, -40, 6], [12, -41, 6]];
    for (const [bx, by, br] of blobs) ball(g, bx, by, br, '#3f8a2f');
    for (const [bx, by, br] of blobs) circ(g, bx - br * 0.3, by - br * 0.3, br * 0.45, 'rgba(120,200,80,0.6)');
  },
  troll(g, e, t) {
    const p = t * 6, c = e.def.color;
    legs(g, p, [-6, 6], -12, 12, shade(c, -0.2), 6);
    g.save(); g.translate(16, -24); g.rotate(-1.1 + Math.sin(t * 3) * 0.5);
    line(g, 0, 0, 0, -26, OL, 8); line(g, 0, 0, 0, -26, '#6a4422', 6);
    ball(g, 0, -27, 6, '#5a3a1e');
    for (const [sx, sy] of [[-5, -28], [5, -26], [0, -33]]) poly(g, [[sx - 1.5, sy], [sx * 1.4, sy - 4 + (sx === 0 ? -1 : 0)], [sx + 1.5, sy]], '#ddd', false);
    g.restore();
    oval(g, 0, -24, 18, 16, c);
    oval(g, 2, -19, 11, 9, shade(c, 0.25), 0, false);
    ball(g, 7, -40, 9, c);
    poly(g, [[5, -33], [6, -38], [8, -33]], '#fffbe8', true, 0.8); poly(g, [[10, -33], [11.5, -38], [13, -33]], '#fffbe8', true, 0.8);
    eye(g, 7, -43, 2.2, '#ffe14a'); eye(g, 12, -43, 2, '#ffe14a');
    ball(g, 14, -39, 2.6, shade(c, 0.1));
    crownShape(g, 6, -48, 14);
  },
  dragon(g, e, t) {
    const flap = Math.sin(t * 5), c = e.def.color;
    // hinterer Flügel
    wing(g, -2, -24, -1, flap, '#6a1414');
    g.beginPath(); g.moveTo(-14, -20); g.quadraticCurveTo(-30, -14 + Math.sin(t * 3) * 6, -40, -22 + Math.sin(t * 3 + 1) * 5);
    g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 6; g.strokeStyle = c; g.stroke();
    poly(g, [[-40, -22 + Math.sin(t * 3 + 1) * 5], [-47, -28 + Math.sin(t * 3 + 1) * 5], [-45, -17 + Math.sin(t * 3 + 1) * 5]], shade(c, -0.2));
    oval(g, 0, -22, 18, 10, c);
    oval(g, 2, -17, 12, 4.5, '#e8a040', 0, false);
    g.beginPath(); g.moveTo(12, -26); g.quadraticCurveTo(22, -34, 24, -40); g.lineWidth = 9; g.strokeStyle = OL; g.stroke(); g.lineWidth = 7; g.strokeStyle = c; g.stroke();
    ball(g, 27, -42, 7, c);
    poly(g, [[30, -45], [40, -42], [40, -39], [30, -38]], shade(c, -0.05));
    for (const hx of [22, 26]) poly(g, [[hx, -46], [hx - 6, -56], [hx + 2, -48]], '#f0e0b0', true, 1);
    eye(g, 29, -45, 1.8, '#ffe14a', '#3a1a00');
    for (let i = 0; i < 5; i++) poly(g, [[-12 + i * 5, -31], [-10 + i * 5, -37], [-8 + i * 5, -31]], '#f2c14e', true, 0.8);
    wing(g, 2, -26, 1, flap, c);
    glow(g, 41, -40, 10, '255,140,40', 0.5 + Math.random() * 0.3);
    light(e.x, e.y - 40, 60, '255,120,40', 0.7);
  },
  lich(g, e, t) {
    const c = e.def.color;
    glow(g, 0, -24, 40, '170,90,255', 0.55);
    g.beginPath(); g.moveTo(-14, 0);
    for (let i = 0; i <= 7; i++) g.lineTo(-14 + i * 4, (i % 2) * -5 + Math.sin(t * 5 + i) * 1.5);
    g.lineTo(9, -30); g.lineTo(-7, -30); g.closePath();
    g.fillStyle = linGrad(g, -14, 0, 14, 0, [[0, '#2a1240'], [0.5, c], [1, '#1e0c30']]); g.fill(); stroke(g, 1.5);
    g.strokeStyle = '#e8b84a'; g.lineWidth = 1.3; g.beginPath(); g.moveTo(1, -30); g.lineTo(1, -4); g.stroke();
    ball(g, 1, -36, 7.5, '#e8e2d0');
    oval(g, 4, -31, 4, 2.4, '#d8d0bc');
    circ(g, 2.5, -37, 2, '#0a0a14'); circ(g, 6.5, -37, 1.8, '#0a0a14');
    glow(g, 4.5, -37, 8, '120,240,255', 1);
    crownShape(g, 1, -43, 14);
    line(g, 15, 0, 16, -44, OL, 3.6); line(g, 15, 0, 16, -44, '#3a2a4a', 2.4);
    poly(g, [[16, -54], [20, -47], [16, -42], [12, -47]], '#c080ff');
    glow(g, 16, -48, 16, '200,120,255', 0.9 + Math.sin(t * 4) * 0.2);
    for (const s of [-1, 1]) ball(g, s * 8 + 4, -20, 2.4, '#e8e2d0');
    light(e.x, e.y - 40, 80, '180,100,255', 0.9);
  },
  hydra(g, e, t) {
    const c = e.def.color;
    legs(g, t * 6, [-8, 8], -10, 10, shade(c, -0.25), 6);
    g.beginPath(); g.moveTo(-14, -20); g.quadraticCurveTo(-26, -14, -28, -6); g.lineWidth = 7; g.strokeStyle = OL; g.stroke(); g.lineWidth = 5; g.strokeStyle = c; g.stroke();
    const heads = [[-6, -44, 0], [6, -50, 2], [16, -42, 4]];
    for (const [hx, hy, ph] of heads) {
      const sx = hx + Math.sin(t * 2.5 + ph) * 4, sy = hy + Math.cos(t * 2 + ph) * 3;
      g.beginPath(); g.moveTo(hx * 0.4, -26); g.quadraticCurveTo(hx * 0.6 + 6, (hy - 26) / 2 - 14, sx, sy);
      g.lineWidth = 9; g.strokeStyle = OL; g.stroke(); g.lineWidth = 7; g.strokeStyle = shade(c, 0.05); g.stroke();
    }
    oval(g, 0, -20, 17, 12, c);
    oval(g, 2, -15, 11, 5, '#c8d880', 0, false);
    for (const [hx, hy, ph] of heads) {
      const sx = hx + Math.sin(t * 2.5 + ph) * 4, sy = hy + Math.cos(t * 2 + ph) * 3;
      serpentHead(g, sx, sy, c, t + ph);
    }
  },
  hydrahead(g, e, t) {
    const c = e.def.color;
    oval(g, 0, -8, 10, 7, c);
    const sx = 6 + Math.sin(t * 3) * 3, sy = -26 + Math.cos(t * 2.5) * 2;
    g.beginPath(); g.moveTo(2, -12); g.quadraticCurveTo(0, -22, sx, sy);
    g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 6; g.strokeStyle = c; g.stroke();
    serpentHead(g, sx, sy, c, t);
  },
  demon(g, e, t) {
    const c = e.def.color, p = t * 6;
    glow(g, 0, -28, 46, '255,70,20', 0.5 + Math.sin(t * 4) * 0.1);
    wing(g, -4, -36, -1, Math.sin(t * 3) * 0.5, '#2a0a0a');
    legs(g, p, [-6, 6], -14, 14, '#3a0e0e', 5.5);
    for (const lx of [-6, 6]) ell(g, lx + Math.sin(p + (lx > 0 ? Math.PI : 0)) * 5.6, 0, 3.5, 1.6, '#111');
    oval(g, 0, -28, 15, 15, c);
    oval(g, 3, -25, 8, 9, shade(c, 0.2), 0, false);
    ball(g, 5, -46, 8, c);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(5 + s * 4, -51); g.quadraticCurveTo(5 + s * 14, -54, 5 + s * 10, -64);
      g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = '#2a2020'; g.stroke();
    }
    circ(g, 8, -47, 1.8, '#ffe14a'); circ(g, 11.5, -47, 1.6, '#ffe14a');
    glow(g, 10, -47, 7, '255,220,60', 1);
    poly(g, [[6, -41], [13, -42], [10, -39]], '#1a0505', false);
    wing(g, 2, -38, 1, Math.sin(t * 3) * 0.5, '#4a0e0e');
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (let i = -2; i <= 2; i++) {
      const fh = 8 + 4 * Math.sin(t * 11 + i * 2);
      const fx = 5 + i * 3;
      g.beginPath(); g.moveTo(fx - 2, -53); g.quadraticCurveTo(fx, -53 - fh, fx + 2, -53); g.fillStyle = 'rgba(255,150,40,0.85)'; g.fill();
    }
    g.globalCompositeOperation = op;
    light(e.x, e.y - 40, 90, '255,90,30', 1);
  },
};

export function crownShape(g, x, y, w) {
  g.beginPath();
  g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - 7); g.lineTo(x - w / 4, y - 3);
  g.lineTo(x, y - 9); g.lineTo(x + w / 4, y - 3); g.lineTo(x + w / 2, y - 7); g.lineTo(x + w / 2, y); g.closePath();
  g.fillStyle = linGrad(g, x, y - 9, x, y, [[0, '#fff0a0'], [1, '#c8902a']]); g.fill(); stroke(g, 1);
  circ(g, x, y - 3, 1.4, '#e0302a');
}
export function wing(g, x, y, s, flap, col) {
  const up = -flap * 14;
  g.beginPath(); g.moveTo(x, y);
  g.lineTo(x - 6 + s * 2, y - 22 + up); g.lineTo(x + 18 * (s > 0 ? 1 : 0.6), y - 30 + up);
  g.quadraticCurveTo(x + 18, y - 14 + up * 0.5, x + 22, y - 6);
  g.quadraticCurveTo(x + 12, y - 10, x + 8, y - 2); g.closePath();
  g.fillStyle = col; g.fill(); stroke(g, 1.3);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x - 6 + s * 2, y - 22 + up); g.lineTo(x + 10, y - 6); g.moveTo(x + 18 * (s > 0 ? 1 : 0.6), y - 30 + up); g.lineTo(x + 14, y - 6); g.stroke();
}
function serpentHead(g, x, y, c, t) {
  oval(g, x, y, 7, 5.5, c, -0.2);
  const jaw = Math.max(0, Math.sin(t * 3)) * 3;
  poly(g, [[x + 4, y - 3], [x + 12, y - 1], [x + 4, y + 1]], shade(c, 0.1), true, 1);
  poly(g, [[x + 4, y + 1], [x + 11, y + 2 + jaw], [x + 3, y + 4]], shade(c, -0.2), true, 1);
  poly(g, [[x - 3, y - 4], [x - 8, y - 10], [x - 1, y - 5]], '#e8e0c0', true, 0.8);
  circ(g, x + 2, y - 2.5, 1.4, '#ffe14a');
}

ART.slimelet = ART.slime;
export const ENEMY_ART = ART;

// fly: zusätzliche Flughöhe, hop: Sprunghöhe
export function enemyLift(e, time) {
  if (e.def.flying) return 20 + Math.sin((time + e.wob) * 3) * 3;
  if (e.type === 'ghost' || e.type === 'lich') return 4 + Math.sin((time + e.wob) * 2.5) * 2.5;
  return e.hop || 0;
}

export function drawEnemy(g, e, time, opt = {}) {
  const r = e.r, t = time + e.wob;
  const lift = enemyLift(e, time);
  const fx = e.x, fy = e.y + r * 0.45;
  const sc = opt.scale || 1;
  if (!opt.noShadow) ell(g, fx, fy, r * (lift > 6 ? 0.65 : 0.95) * sc, r * 0.32 * sc, `rgba(0,0,0,${lift > 6 ? 0.18 : 0.32})`);
  g.save();
  g.translate(fx, fy - lift);
  if (sc !== 1) g.scale(sc, sc);
  if (e.face < 0) g.scale(-1, 1);
  if (e.lean) g.rotate(e.lean);
  if (e.type === 'assassin') g.globalAlpha *= e.blinkFade != null ? e.blinkFade : 0.92;
  ART[e.art || e.type](g, e, t);
  if (opt.extra) opt.extra(g, e, t);
  g.restore();

  const cy = fy - lift - r * 0.95 * sc;
  if (e.hitFlash > 0) glow(g, fx, cy, r * 1.6, '255,255,255', Math.min(1, e.hitFlash * 12) * 0.7);
  if (e.slowT > 0) {
    glow(g, fx, cy, r * 1.5, '120,200,255', 0.35);
    for (let i = 0; i < 3; i++) {
      const an = t * 2 + (i * TAU) / 3, sx = fx + Math.cos(an) * r * 0.9, sy = cy + Math.sin(an) * r * 0.5;
      poly(g, [[sx, sy - 3], [sx + 1.8, sy], [sx, sy + 3], [sx - 1.8, sy]], '#dff6ff', false);
    }
  }
  if (e.burnT > 0) {
    const op = g.globalCompositeOperation;
    g.globalCompositeOperation = 'lighter';
    for (let i = -1; i <= 1; i++) {
      const h = r * (0.8 + 0.4 * Math.sin(t * 14 + i * 2));
      const bx = fx + i * r * 0.45;
      g.beginPath(); g.moveTo(bx - 3, cy + r * 0.4); g.quadraticCurveTo(bx, cy + r * 0.4 - h * 1.4, bx + 3, cy + r * 0.4);
      g.fillStyle = 'rgba(255,140,40,0.75)'; g.fill();
    }
    g.globalCompositeOperation = op;
    light(fx, cy, r * 3, '255,130,40', 0.6);
  }
  if (e.enraged) glow(g, fx, cy, r * 2, '255,50,20', 0.4);
  if (e.shielded) {
    g.beginPath(); g.arc(fx, cy, r * 1.15, 0, TAU);
    g.strokeStyle = `rgba(232,184,74,${0.35 + Math.sin(t * 6) * 0.15})`; g.lineWidth = 1.5; g.stroke();
  }

  if (!opt.noBar && (e.hp < e.maxHp || e.def.boss)) {
    const big = e.def.boss || e.type === 'hydrahead';
    const bw = Math.max(20, r * 2.2), bh = big ? 5 : 3.5, bx = fx - bw / 2, by = fy - lift - r * 2.3 - 8;
    g.fillStyle = 'rgba(0,0,0,0.65)';
    g.beginPath(); g.roundRect(bx - 1.5, by - 1.5, bw + 3, bh + 3, 2); g.fill();
    const f = Math.max(0, Math.min(1, e.hp / e.maxHp)), fs = Math.max(f, Math.min(1, (e.hpShown ?? e.hp) / e.maxHp));
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.fillRect(bx, by, bw * fs, bh);
    g.fillStyle = f > 0.5 ? '#6ee05a' : f > 0.25 ? '#f2c14e' : '#ff4a3a';
    g.fillRect(bx, by, bw * f, bh);
    if (e.def.res && e.def.res.phys > 0) { g.fillStyle = 'rgba(200,210,230,0.9)'; g.fillRect(bx, by + bh - 1, bw * f, 1); }
  }
}

// Kleines Porträt (Bestiarium, Wellenvorschau) – passt sich der echten Größe der Figur an
const bboxCache = new Map();
function portraitEnemy(type, def) {
  return { type, art: def.art, def, x: 0, y: -def.r * 0.45, r: def.r, wob: 0, face: 1, hp: 1, maxHp: 1, slowT: 0, burnT: 0 };
}
function measure(type, def, extra) {
  let b = bboxCache.get(type);
  if (b) return b;
  const S = 260, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S * 0.75);
  const prev = lightSink; lightSink = null;
  drawEnemy(g, portraitEnemy(type, def), 0.4, { noBar: true, noShadow: !!def.flying, extra });
  lightSink = prev;
  const d = g.getImageData(0, 0, S, S).data;
  let x0 = S, y0 = S, x1 = 0, y1 = 0;
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (d[(y * S + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  b = { x0: x0 - S / 2, y0: y0 - S * 0.75, x1: x1 - S / 2, y1: y1 - S * 0.75 };
  bboxCache.set(type, b);
  return b;
}
export function drawPortrait(canvas, type, def, time = 0, extra = null) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const b = measure(type, def, extra);
  const bw = Math.max(10, b.x1 - b.x0), bh = Math.max(10, b.y1 - b.y0);
  const k = Math.min((w * 0.86) / bw, (h * 0.86) / bh);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(k, 0, 0, k, w / 2 - ((b.x0 + b.x1) / 2) * k, h / 2 - ((b.y0 + b.y1) / 2) * k);
  const prev = lightSink; lightSink = null;
  drawEnemy(g, portraitEnemy(type, def), time, { noBar: true, noShadow: !!def.flying, extra });
  lightSink = prev;
}
