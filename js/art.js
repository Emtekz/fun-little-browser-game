// Grafik: alles wird prozedural auf Canvas gezeichnet (keine Bilddateien nötig)
import { TILE, COLS, ROWS, W, H } from './data.js';

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
function sprite(key, w, h, ax, ay, draw) {
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
function blit(g, s, x, y) { g.drawImage(s.c, x - s.ax, y - s.ay, s.w, s.h); }

// ---------------------------------------------------------------- Grundformen
const OL = 'rgba(28,16,10,0.85)';
export function circ(g, x, y, r, fill) { g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = fill; g.fill(); }
export function ell(g, x, y, rx, ry, fill, rot = 0) { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU); g.fillStyle = fill; g.fill(); }
function stroke(g, w = 1.4, col = OL) { g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
function sphereGrad(g, x, y, r, col) {
  if (FLAT) return col;
  const gr = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.08, x, y, r * 1.08);
  gr.addColorStop(0, shade(col, 0.4));
  gr.addColorStop(0.55, col);
  gr.addColorStop(1, shade(col, -0.45));
  return gr;
}
function ball(g, x, y, r, col, ol = true) {
  g.beginPath(); g.arc(x, y, r, 0, TAU);
  g.fillStyle = sphereGrad(g, x, y, r, col); g.fill();
  if (ol) stroke(g);
}
function oval(g, x, y, rx, ry, col, rot = 0, ol = true) {
  g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU);
  g.fillStyle = sphereGrad(g, x, y, Math.max(rx, ry), col); g.fill();
  if (ol) stroke(g);
}
function poly(g, pts, fill, ol = true, w = 1.4) {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
  g.fillStyle = fill; g.fill();
  if (ol) stroke(g, w);
}
function line(g, x1, y1, x2, y2, col, w) {
  g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2);
  g.lineCap = 'round'; g.lineWidth = w; g.strokeStyle = col; g.stroke();
}
function linGrad(g, x1, y1, x2, y2, stops) {
  if (FLAT) return stops[Math.floor(stops.length / 2)][1];
  const gr = g.createLinearGradient(x1, y1, x2, y2);
  for (const [o, c] of stops) gr.addColorStop(o, c);
  return gr;
}
// zwei Beine mit Laufanimation
function legs(g, p, xs, top, len, col, w) {
  for (let i = 0; i < xs.length; i++) {
    const s = Math.sin(p + i * Math.PI);
    line(g, xs[i], top, xs[i] + s * len * 0.4, -Math.max(0, Math.cos(p + i * Math.PI)) * 2, OL, w + 2);
    line(g, xs[i], top, xs[i] + s * len * 0.4, -Math.max(0, Math.cos(p + i * Math.PI)) * 2, col, w);
  }
}
function eye(g, x, y, r, col = '#fff', pupil = '#111') {
  circ(g, x, y, r, col);
  if (pupil) circ(g, x + r * 0.3, y, r * 0.55, pupil);
}

// ================================================================ Gelände
export function buildMapArt(map, path) {
  const rnd = seeded(hashStr(map.id));
  const th = map.theme;
  const blocked = new Set(), trees = [], rocks = [], pools = [];

  const nearPath = (c, r) => {
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
      const cc = c + dc, rr = r + dr;
      if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS && path.tiles.has(rr * COLS + cc)) return true;
    }
    return false;
  };
  const weights = {
    forest: [['tree', 0.6], ['rock', 0.25], ['pool', 0.15]],
    autumn: [['tree', 0.6], ['rock', 0.25], ['pool', 0.15]],
    winter: [['tree', 0.55], ['rock', 0.25], ['pool', 0.2]],
    lava: [['tree', 0.3], ['rock', 0.3], ['pool', 0.4]],
  }[th];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (path.tiles.has(r * COLS + c) || nearPath(c, r) || rnd() > 0.26) continue;
      let v = rnd(), kind = weights[0][0];
      for (const [k, w] of weights) { v -= w; if (v <= 0) { kind = k; break; } }
      blocked.add(r * COLS + c);
      const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
      if (kind === 'tree') trees.push({ x: x + (rnd() - 0.5) * 8, y: y + 8 + rnd() * 6, variant: Math.floor(rnd() * 3), scale: 0.85 + rnd() * 0.3 });
      else if (kind === 'rock') rocks.push({ x, y, s: 0.8 + rnd() * 0.4, seed: rnd() });
      else pools.push({ x, y, rx: TILE * 0.44, ry: TILE * 0.34, seed: rnd() * 10 });
    }
  }

  // ---- Hintergrund vorrendern
  const SC = 2;
  const c = document.createElement('canvas');
  c.width = W * SC; c.height = H * SC;
  const g = c.getContext('2d');
  g.scale(SC, SC);
  const pal = map.ground;

  g.fillStyle = pal[0];
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 520; i++) {
    const x = rnd() * W, y = rnd() * H, r = 15 + rnd() * 55;
    const col = pal[Math.floor(rnd() * pal.length)];
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, hexA(col, 0.55)); gr.addColorStop(1, hexA(col, 0));
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  for (let i = 0; i < 3500; i++) {
    g.fillStyle = shade(pal[Math.floor(rnd() * pal.length)], (rnd() - 0.5) * 0.4);
    g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.5, 1 + rnd() * 1.5);
  }

  if (th === 'forest' || th === 'autumn') {
    for (let i = 0; i < 5200; i++) {
      const x = rnd() * W, y = rnd() * H, h = 3 + rnd() * 5, lean = (rnd() - 0.5) * 4;
      g.strokeStyle = shade(pal[Math.floor(rnd() * pal.length)], (rnd() - 0.6) * 0.5);
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + lean * 0.3, y - h * 0.6, x + lean, y - h); g.stroke();
    }
    const flowers = th === 'forest' ? ['#f5e663', '#ff8fb5', '#ffffff', '#9ec9ff', '#c58aff'] : ['#e07a2a', '#c94a2a', '#f2c14e', '#a8401c'];
    for (let i = 0; i < 70; i++) {
      const cx = rnd() * W, cy = rnd() * H, col = flowers[Math.floor(rnd() * flowers.length)];
      for (let k = 0; k < 4 + rnd() * 5; k++) {
        const x = cx + (rnd() - 0.5) * 22, y = cy + (rnd() - 0.5) * 16;
        if (th === 'forest') { circ(g, x, y, 1.7, col); circ(g, x, y, 0.7, '#fff6b0'); }
        else ell(g, x, y, 2.6, 1.4, col, rnd() * 3);
      }
    }
  } else if (th === 'winter') {
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H;
      ell(g, x, y, 10 + rnd() * 30, 3 + rnd() * 5, 'rgba(120,150,190,0.10)');
    }
    for (let i = 0; i < 900; i++) circ(g, rnd() * W, rnd() * H, 0.8, 'rgba(255,255,255,0.95)');
    for (let i = 0; i < 260; i++) {
      const x = rnd() * W, y = rnd() * H;
      g.strokeStyle = 'rgba(90,100,70,0.6)'; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x - 1, y - 4); g.moveTo(x, y); g.lineTo(x + 1.5, y - 3.5); g.stroke();
    }
  } else if (th === 'lava') {
    for (let i = 0; i < 14; i++) {
      let x = rnd() * W, y = rnd() * H;
      const pts = [[x, y]];
      for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 60; y += (rnd() - 0.5) * 60; pts.push([x, y]); }
      for (const [w, col] of [[7, 'rgba(20,8,4,0.8)'], [3.2, '#ff5a10'], [1.4, '#ffd060']]) {
        g.strokeStyle = col; g.lineWidth = w; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.stroke();
      }
    }
    for (let i = 0; i < 600; i++) circ(g, rnd() * W, rnd() * H, 0.6 + rnd(), 'rgba(160,150,140,0.35)');
  }

  // Weg
  const pathLine = (w, col) => {
    g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'butt';
    g.beginPath(); path.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
  };
  pathLine(TILE * 1.12, 'rgba(0,0,0,0.10)');
  pathLine(TILE * 1.0, 'rgba(0,0,0,0.16)');
  pathLine(TILE * 0.88, map.pathDark);
  pathLine(TILE * 0.78, map.path);
  for (let i = 0; i < 1600; i++) {
    const s = path.segs[Math.floor(rnd() * path.segs.length)];
    const k = rnd(), lat = (rnd() - 0.5) * TILE * 0.72;
    const x = s.a.x + (s.b.x - s.a.x) * k - Math.sin(s.ang) * lat, y = s.a.y + (s.b.y - s.a.y) * k + Math.cos(s.ang) * lat;
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.12)';
    g.fillRect(x, y, 1.5, 1.5);
  }
  // Pflastersteine
  for (const s of path.segs) {
    for (let d = 0; d < s.l; d += 6.5) {
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.3) continue;
        const lat = (rnd() - 0.5) * TILE * 0.62;
        const x = s.a.x + Math.cos(s.ang) * d - Math.sin(s.ang) * lat + (rnd() - 0.5) * 3;
        const y = s.a.y + Math.sin(s.ang) * d + Math.cos(s.ang) * lat + (rnd() - 0.5) * 3;
        const rx = 2.6 + rnd() * 2.4, ry = 2 + rnd() * 1.8;
        const v = (rnd() - 0.5) * 0.35;
        ell(g, x + 0.6, y + 0.9, rx, ry, 'rgba(0,0,0,0.3)', rnd());
        g.beginPath(); g.ellipse(x, y, rx, ry, rnd(), 0, TAU);
        g.fillStyle = linGrad(g, x, y - ry, x, y + ry, [[0, shade(map.stone, clampV(v + 0.2))], [1, shade(map.stone, clampV(v - 0.2))]]); g.fill();
      }
    }
  }
  // Ränder: Grasbüschel / Schneewehen
  for (const s of path.segs) {
    for (let d = 0; d < s.l; d += 5) {
      for (const side of [-1, 1]) {
        if (rnd() < 0.45) continue;
        const lat = side * TILE * (0.42 + rnd() * 0.06);
        const x = s.a.x + Math.cos(s.ang) * d - Math.sin(s.ang) * lat, y = s.a.y + Math.sin(s.ang) * d + Math.cos(s.ang) * lat;
        if (x < 0 || x > W) continue;
        if (th === 'winter') ell(g, x, y, 3 + rnd() * 4, 2 + rnd() * 2, rnd() < 0.5 ? '#f4f8fc' : '#dfe8f1');
        else if (th === 'lava') circ(g, x, y, 1 + rnd() * 2, shade('#2a1d18', rnd() * 0.2));
        else {
          g.strokeStyle = shade(pal[1], (rnd() - 0.4) * 0.4); g.lineWidth = 1.2;
          g.beginPath();
          for (let b = 0; b < 3; b++) { g.moveTo(x, y); g.lineTo(x + (rnd() - 0.5) * 6, y - 3 - rnd() * 4); }
          g.stroke();
        }
      }
    }
  }

  // Tümpel (Grundform; Animation kommt zur Laufzeit dazu)
  for (const p of pools) drawPoolBase(g, p, th, rnd);
  for (const r of rocks) drawRock(g, r.x, r.y, r.s, th, r.seed);

  // Vignette
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.66);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.38)');
  g.fillStyle = vg; g.fillRect(0, 0, W, H);

  return { bg: c, trees, pools, blocked };
}

function drawPoolBase(g, p, th, rnd) {
  const { x, y, rx, ry } = p;
  // Uferstein-Kranz
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU + rnd() * 0.3;
    const sx = x + Math.cos(a) * rx, sy = y + Math.sin(a) * ry;
    const col = th === 'lava' ? '#2a1e19' : th === 'winter' ? '#c9d6e3' : '#8a857c';
    ell(g, sx, sy, 3 + rnd() * 3, 2.2 + rnd() * 2, shade(col, (rnd() - 0.5) * 0.3));
  }
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU);
  let gr;
  if (th === 'lava') {
    gr = g.createRadialGradient(x, y, 2, x, y, rx);
    gr.addColorStop(0, '#fff2a0'); gr.addColorStop(0.35, '#ffb020'); gr.addColorStop(0.8, '#ff5a10'); gr.addColorStop(1, '#8a1a00');
  } else if (th === 'winter') {
    gr = g.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    gr.addColorStop(0, '#e8f6ff'); gr.addColorStop(0.5, '#a9d4f0'); gr.addColorStop(1, '#7fb4dc');
  } else {
    gr = g.createRadialGradient(x, y - ry * 0.3, 2, x, y, rx);
    gr.addColorStop(0, '#5fb0d8'); gr.addColorStop(0.6, '#2f7aa8'); gr.addColorStop(1, '#1d4a6e');
  }
  g.fillStyle = gr; g.fill();
  g.lineWidth = 2; g.strokeStyle = th === 'lava' ? '#3a1408' : 'rgba(20,40,60,0.6)'; g.stroke();
  if (th === 'winter') {
    g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 0.8;
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = rnd() * TAU; g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * rx * 0.5, y + Math.sin(a) * ry * 0.5);
      g.lineTo(x + Math.cos(a + 0.3) * rx * 0.85, y + Math.sin(a + 0.3) * ry * 0.85);
    }
    g.stroke();
  } else if (th === 'lava') {
    for (let i = 0; i < 4; i++) ell(g, x + (rnd() - 0.5) * rx, y + (rnd() - 0.5) * ry, 3 + rnd() * 4, 2 + rnd() * 2, 'rgba(60,20,5,0.75)', rnd() * 3);
  } else {
    for (let i = 0; i < 3; i++) {
      const lx = x + (rnd() - 0.5) * rx, ly = y + (rnd() - 0.5) * ry;
      ell(g, lx, ly, 4, 2.4, '#4f9a3a'); circ(g, lx + 1, ly - 0.5, 1.2, '#ff9ad0');
    }
  }
}

function drawRock(g, x, y, s, th, seed) {
  const base = th === 'lava' ? '#2e2a30' : th === 'winter' ? '#8d96a3' : th === 'autumn' ? '#8f8578' : '#7f7b74';
  ell(g, x + 3, y + 10 * s, 17 * s, 6 * s, 'rgba(0,0,0,0.3)');
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, rr = (0.75 + ((Math.sin(seed * 50 + i * 7.3) + 1) / 2) * 0.35);
    pts.push([x + Math.cos(a) * 15 * s * rr, y + Math.sin(a) * 10 * s * rr - 4 * s]);
  }
  g.beginPath(); pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py))); g.closePath();
  g.fillStyle = linGrad(g, x - 10 * s, y - 14 * s, x + 10 * s, y + 8 * s, [[0, shade(base, 0.35)], [0.5, base], [1, shade(base, -0.45)]]);
  g.fill(); stroke(g, 1.2);
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(x - 4 * s, y - 12 * s); g.lineTo(x - 1 * s, y - 4 * s); g.lineTo(x + 5 * s, y + 1 * s); g.stroke();
  if (th === 'forest') ell(g, x - 4 * s, y - 9 * s, 7 * s, 3 * s, 'rgba(90,150,60,0.75)');
  if (th === 'winter') ell(g, x - 1 * s, y - 11 * s, 11 * s, 4 * s, '#f4f8fc');
  if (th === 'lava') {
    g.strokeStyle = '#ff6a1a'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(x - 6 * s, y - 2 * s); g.lineTo(x, y - 6 * s); g.lineTo(x + 6 * s, y - 3 * s); g.stroke();
  }
}

// Bäume als zwischengespeicherte Sprites
export function drawTree(g, tree, theme, time) {
  const s = treeSprite(theme, tree.variant);
  const sway = Math.sin(time * 1.3 + tree.x * 0.05) * 0.015;
  g.save();
  g.translate(tree.x, tree.y);
  g.transform(tree.scale, 0, sway * tree.scale, tree.scale, 0, 0);
  blit(g, s, 0, 0);
  g.restore();
  if (theme === 'lava') light(tree.x, tree.y - 30, 30, '255,90,20', 0.4);
}

function treeSprite(theme, variant) {
  return sprite(`tree-${theme}-${variant}`, 80, 96, 40, 86, (g) => {
    const rnd = seeded(variant * 977 + theme.length * 13);
    ell(g, 6, 0, 24, 8, 'rgba(0,0,0,0.32)');
    if (theme === 'winter') {
      poly(g, [[-4, 0], [-3, -14], [3, -14], [4, 0]], '#5a3a22');
      const layers = 4;
      for (let i = 0; i < layers; i++) {
        const y0 = -10 - i * 15, w = 26 - i * 5;
        poly(g, [[-w, y0], [0, y0 - 26], [w, y0]], linGrad(g, -w, 0, w, 0, [[0, '#2f6a4a'], [0.5, '#1f4f37'], [1, '#143a28']]));
        g.beginPath(); g.moveTo(-w + 2, y0 - 1);
        for (let k = 0; k <= 6; k++) g.lineTo(-w + 2 + ((w * 2 - 4) * k) / 6, y0 - 3 - (k % 2) * 3);
        g.lineTo(w - 4, y0 - 6); g.lineTo(0, y0 - 24); g.closePath();
        g.fillStyle = 'rgba(245,250,255,0.9)'; g.globalAlpha = 0.85;
        g.beginPath(); g.moveTo(-w * 0.45, y0 - 13); g.lineTo(0, y0 - 26); g.lineTo(w * 0.35, y0 - 15); g.quadraticCurveTo(0, y0 - 18, -w * 0.45, y0 - 13); g.fill();
        g.globalAlpha = 1;
      }
    } else if (theme === 'lava') {
      g.lineCap = 'round';
      const br = (x, y, a, len, w, depth) => {
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        line(g, x, y, x2, y2, '#1c1412', w + 1.5);
        line(g, x, y, x2, y2, '#3a2a24', w);
        if (depth > 0) {
          br(x2, y2, a - 0.5 - rnd() * 0.3, len * 0.7, w * 0.65, depth - 1);
          br(x2, y2, a + 0.4 + rnd() * 0.3, len * 0.65, w * 0.65, depth - 1);
        } else circ(g, x2, y2, 1.6, '#ff7a20');
      };
      br(0, 0, -Math.PI / 2, 26, 6, 3);
    } else {
      // Laubbaum
      poly(g, [[-6, 0], [-4, -26], [4, -26], [6, 0]], linGrad(g, -6, 0, 6, 0, [[0, '#4a2e16'], [0.5, '#7a4e2a'], [1, '#3a2210']]));
      line(g, -2, -24, -10, -36, '#5a3a1e', 3); line(g, 2, -26, 10, -38, '#5a3a1e', 3);
      const cols = theme === 'autumn'
        ? [['#c9541c', '#e88a2a', '#f2c14e'], ['#a8401c', '#d8642a', '#f0a040'], ['#b8862b', '#e0b040', '#f5d76a']][variant]
        : [['#2f6e2a', '#3f8f3a', '#6fbf4a'], ['#2a5e2a', '#3a7f36', '#5aa844'], ['#356e30', '#4a9440', '#7acb58']][variant];
      const blobs = [];
      for (let i = 0; i < 9; i++) blobs.push([(rnd() - 0.5) * 34, -42 - (rnd() - 0.3) * 26, 11 + rnd() * 7]);
      blobs.sort((a, b) => a[1] - b[1]);
      for (const [bx, by, br] of blobs) { g.beginPath(); g.arc(bx, by, br + 1.5, 0, TAU); g.fillStyle = OL; g.fill(); }
      for (const [bx, by, br] of blobs) ball(g, bx, by, br, cols[0], false);
      for (const [bx, by, br] of blobs) circ(g, bx - br * 0.25, by - br * 0.3, br * 0.6, hexA(cols[1].startsWith('#') ? cols[1] : '#3f8f3a', 0.9));
      for (let i = 0; i < 14; i++) circ(g, (rnd() - 0.5) * 36, -48 - rnd() * 22, 2 + rnd() * 2.5, cols[2]);
      if (theme === 'autumn') for (let i = 0; i < 6; i++) ell(g, (rnd() - 0.5) * 40, 2 + rnd() * 4, 2.5, 1.3, cols[1], rnd() * 3);
    }
  });
}

// animierte Ebene über den Tümpeln
export function drawPools(g, pools, theme, time) {
  for (const p of pools) {
    if (theme === 'lava') {
      const pulse = 0.5 + 0.5 * Math.sin(time * 2 + p.seed);
      glow(g, p.x, p.y, p.rx * 1.6, '255,120,20', 0.25 + pulse * 0.25);
      for (let i = 0; i < 2; i++) {
        const k = (time * 0.6 + p.seed + i * 0.5) % 1;
        const bx = p.x + Math.sin(p.seed * 3 + i * 2) * p.rx * 0.5, by = p.y + Math.cos(p.seed * 2 + i) * p.ry * 0.4;
        circ(g, bx, by, 1 + k * 3, `rgba(255,230,140,${1 - k})`);
      }
      light(p.x, p.y, p.rx * 2.4, '255,120,30', 0.9);
    } else if (theme !== 'winter') {
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1;
      for (let i = 0; i < 2; i++) {
        const k = (time * 0.3 + p.seed + i * 0.5) % 1;
        g.globalAlpha = 1 - k;
        g.beginPath(); g.ellipse(p.x + (i ? 5 : -6), p.y + (i ? 2 : -3), 3 + k * 9, 1.5 + k * 4, 0, 0, TAU); g.stroke();
      }
      g.globalAlpha = 1;
    }
  }
}

// ================================================================ Portal & Burg
export function drawPortal(g, x, y, time) {
  ell(g, x + 4, y + 22, 18, 6, 'rgba(0,0,0,0.3)');
  // Steinpfeiler
  for (const s of [-1, 1]) {
    const py = y + s * 26;
    poly(g, [[x - 7, py + 9], [x - 5, py - 9], [x + 5, py - 9], [x + 7, py + 9]], linGrad(g, x - 7, 0, x + 7, 0, [[0, '#4a4550'], [0.5, '#7a7482'], [1, '#3a3540']]));
    glow(g, x, py - 2, 6, '200,120,255', 0.6 + Math.sin(time * 3 + s) * 0.3);
  }
  g.save();
  g.translate(x, y);
  const gr = g.createRadialGradient(0, 0, 2, 0, 0, 26);
  gr.addColorStop(0, 'rgba(250,220,255,0.95)'); gr.addColorStop(0.35, 'rgba(170,80,240,0.85)'); gr.addColorStop(1, 'rgba(60,0,120,0.1)');
  g.fillStyle = gr; g.beginPath(); g.ellipse(0, 0, 12, 24, 0, 0, TAU); g.fill();
  g.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    g.strokeStyle = `rgba(235,200,255,${0.8 - i * 0.15})`;
    g.beginPath(); g.ellipse(0, 0, 10 - i * 2.2, 21 - i * 5, 0, time * (2.5 + i) + i * 1.3, time * (2.5 + i) + i * 1.3 + 3.8); g.stroke();
  }
  g.restore();
  glow(g, x, y, 40, '170,80,255', 0.5);
  light(x, y, 90, '170,80,255', 1);
}

export function drawCastle(g, x, y, time, dmg) {
  ell(g, x + 2, y + 30, 34, 10, 'rgba(0,0,0,0.38)');
  const stone = (x1, y1, w, h, base) => {
    g.fillStyle = linGrad(g, x1, 0, x1 + w, 0, [[0, shade(base, -0.3)], [0.4, shade(base, 0.15)], [1, shade(base, -0.4)]]);
    g.fillRect(x1, y1, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.22)'; g.lineWidth = 0.8; g.beginPath();
    for (let yy = y1 + 5; yy < y1 + h; yy += 5) { g.moveTo(x1, yy); g.lineTo(x1 + w, yy); }
    g.stroke();
    g.strokeStyle = OL; g.lineWidth = 1.2; g.strokeRect(x1, y1, w, h);
  };
  // Mauer & Tor
  stone(x - 12, y - 20, 26, 44, '#9a9186');
  for (let i = 0; i < 4; i++) stone(x - 12 + i * 7, y - 25, 5, 6, '#a59c8f');
  g.fillStyle = '#20150d';
  g.beginPath(); g.moveTo(x - 8, y + 24); g.lineTo(x - 8, y + 4); g.arc(x, y + 4, 8, Math.PI, 0); g.lineTo(x + 8, y + 24); g.fill();
  g.strokeStyle = '#6a6a6a'; g.lineWidth = 1;
  g.beginPath();
  for (let i = -6; i <= 6; i += 3) { g.moveTo(x + i, y - 2); g.lineTo(x + i, y + 24); }
  for (let j = 2; j < 24; j += 4) { g.moveTo(x - 8, y + j); g.lineTo(x + 8, y + j); }
  g.stroke();
  // Türme
  for (const s of [-1, 1]) {
    const ty = y + s * 30;
    stone(x - 13, ty - 20, 26, 30, '#8d8478');
    for (let i = 0; i < 4; i++) stone(x - 13 + i * 7, ty - 25, 5, 6, '#a59c8f');
    poly(g, [[x - 15, ty - 24], [x, ty - 50], [x + 15, ty - 24]], linGrad(g, x - 15, 0, x + 15, 0, [[0, '#7a5ac8'], [0.5, '#5a3aa0'], [1, '#3a2470']]));
    g.fillStyle = '#ffd36a'; g.fillRect(x - 2, ty - 12, 4, 6);
    light(x, ty - 9, 30, '255,200,110', 0.7);
    // Flagge
    line(g, x, ty - 50, x, ty - 64, '#3a2a1a', 1.5);
    g.fillStyle = '#f2c14e';
    g.beginPath(); g.moveTo(x, ty - 64);
    g.quadraticCurveTo(x - 8, ty - 62 + Math.sin(time * 5 + s) * 2.5, x - 16, ty - 60 + Math.sin(time * 5 + s + 1) * 2);
    g.lineTo(x, ty - 56); g.fill();
  }
  // Fackeln am Tor
  for (const s of [-1, 1]) {
    const fx = x - 13, fy = y + s * 10 - 2;
    line(g, fx, fy + 6, fx, fy, '#3a2a1a', 2);
    const fl = 4 + Math.sin(time * 15 + s * 3) * 1.2;
    poly(g, [[fx - 2.5, fy], [fx, fy - fl - 3], [fx + 2.5, fy]], '#ffb030', false);
    glow(g, fx, fy - 3, 14, '255,160,60', 0.8);
    light(fx, fy - 3, 55, '255,170,80', 0.9);
  }
  // Schaden: Risse
  if (dmg > 0.3) {
    g.strokeStyle = 'rgba(20,10,5,0.8)'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(x + 6, y - 18); g.lineTo(x + 2, y - 10); g.lineTo(x + 7, y - 4); g.stroke();
  }
  if (dmg > 0.6) {
    g.beginPath(); g.moveTo(x - 9, y + 32); g.lineTo(x - 4, y + 26); g.lineTo(x - 8, y + 20); g.stroke();
  }
}

// ================================================================ Türme
function plinth(g, accent, L) {
  ell(g, 4, 16, 23, 8, 'rgba(0,0,0,0.38)');
  const side = linGrad(g, -18, 0, 18, 0, [[0, '#4f4b46'], [0.42, '#a8a29a'], [1, '#433f3b']]);
  g.fillStyle = side;
  g.fillRect(-18, -4, 36, 14);
  g.beginPath(); g.ellipse(0, 10, 18, 8, 0, 0, Math.PI); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.9;
  g.beginPath(); g.ellipse(0, 3, 18, 8, 0, 0, Math.PI); g.stroke();
  g.beginPath();
  for (const bx of [-12, -2, 9]) { g.moveTo(bx, 5 + Math.abs(bx) * -0.1 + 4); g.lineTo(bx, 14 - Math.abs(bx) * 0.25); }
  for (const bx of [-7, 4, 14]) { g.moveTo(bx, -2); g.lineTo(bx, 8 - Math.abs(bx) * 0.2); }
  g.stroke();
  g.beginPath(); g.ellipse(0, 10, 18, 8, 0, 0, Math.PI); g.lineTo(18, -4); g.lineTo(-18, -4); g.closePath(); stroke(g, 1.2);
  ell(g, 0, -4, 18, 8, '#c4bdb1');
  g.beginPath(); g.ellipse(0, -4, 18, 8, 0, 0, TAU); stroke(g, 1.2);
  ell(g, 0, -4, 14.5, 6.2, '#aaa397');
  g.strokeStyle = accent; g.lineWidth = 2;
  g.beginPath(); g.ellipse(0, -4, 16.3, 7.1, 0, 0, TAU); g.stroke();
  if (L >= 3) { g.strokeStyle = '#e8b84a'; g.lineWidth = 2; g.beginPath(); g.ellipse(0, 10, 18, 8, 0, 0.15, Math.PI - 0.15); g.stroke(); }
  if (L >= 4) for (const bx of [-10, 0, 10]) { circ(g, bx, 6 + Math.abs(bx) * 0.15, 2.2, accent); circ(g, bx, 6 + Math.abs(bx) * 0.15, 1, '#fff'); }
}

const TOWER_STATIC = {
  archer(g, L) {
    plinth(g, '#3f8f3a', L);
    for (const px of [-6, 6]) poly(g, [[px - 2, -6], [px - 2, -34], [px + 2, -34], [px + 2, -6]], '#4e2f14');
    line(g, -12, -8, 12, -28, '#4e2f14', 2.2); line(g, 12, -8, -12, -28, '#4e2f14', 2.2);
    for (const px of [-12, 12]) poly(g, [[px - 2.6, -2], [px - 2.6, -36], [px + 2.6, -36], [px + 2.6, -2]], linGrad(g, px - 3, 0, px + 3, 0, [[0, '#5a3818'], [0.5, '#9a6634'], [1, '#4a2e12']]));
    g.fillStyle = '#5a3818'; g.fillRect(-18, -38, 36, 4); g.strokeStyle = OL; g.lineWidth = 1; g.strokeRect(-18, -38, 36, 4);
    ell(g, 0, -38, 18, 7.5, '#8a5a2c');
    g.save(); g.beginPath(); g.ellipse(0, -38, 18, 7.5, 0, 0, TAU); g.clip();
    g.strokeStyle = 'rgba(60,35,15,0.6)'; g.lineWidth = 1;
    for (let i = -16; i <= 16; i += 5) { g.beginPath(); g.moveTo(i, -46); g.lineTo(i, -30); g.stroke(); }
    g.restore();
    g.beginPath(); g.ellipse(0, -38, 18, 7.5, 0, 0, TAU); stroke(g, 1.2);
    for (let a = Math.PI; a <= TAU + 0.01; a += Math.PI / 6) {
      const px = Math.cos(a) * 17, py = -38 + Math.sin(a) * 7;
      line(g, px, py, px, py - 7, '#6b4220', 2.4);
    }
    g.beginPath(); g.ellipse(0, -44, 17, 7, 0, Math.PI, TAU); g.lineWidth = 2; g.strokeStyle = '#7a4e26'; g.stroke();
    if (L >= 3) for (const px of [-12, 12]) circ(g, px, -37, 2.4, '#e8b84a');
  },
  cannon(g, L) {
    plinth(g, '#b8862b', L);
    g.fillStyle = linGrad(g, -17, 0, 17, 0, [[0, '#4a4540'], [0.4, '#8f8980'], [1, '#3a3632']]);
    g.fillRect(-16, -18, 32, 14);
    g.beginPath(); g.ellipse(0, -4, 16, 7, 0, 0, Math.PI); g.fill();
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 0.8;
    g.beginPath(); g.ellipse(0, -11, 16, 7, 0, 0, Math.PI); g.stroke();
    g.beginPath(); g.ellipse(0, -4, 16, 7, 0, 0, Math.PI); g.lineTo(16, -18); g.lineTo(-16, -18); g.closePath(); stroke(g, 1.2);
    ell(g, 0, -18, 16, 7, '#6a645c');
    ell(g, 0, -18, 12, 5, '#544f48');
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU + 0.2;
      const mx = Math.cos(a) * 14.5, my = -18 + Math.sin(a) * 6.3;
      poly(g, [[mx - 3, my + 1], [mx - 3, my - 5], [mx + 3, my - 5], [mx + 3, my + 1]], shade('#9a948a', Math.sin(a) * 0.15), true, 1);
    }
  },
  frost(g, L) {
    plinth(g, '#5bc8f0', L);
    poly(g, [[-10, -4], [-6, -24], [6, -24], [10, -4]], linGrad(g, -10, 0, 10, 0, [[0, '#55606e'], [0.45, '#a9b6c4'], [1, '#46505c']]));
    ell(g, 0, -24, 7, 3, '#cfe0ee');
    const n = 2 + L;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.4, sx = Math.cos(a) * 13, sy = -4 + Math.sin(a) * 5.5;
      const h = 9 + (i % 2) * 5;
      poly(g, [[sx - 3, sy], [sx + (Math.cos(a) * 3), sy - h], [sx + 3, sy]], linGrad(g, sx - 3, sy - h, sx + 3, sy, [[0, '#ffffff'], [1, '#5ab8e8']]), true, 1);
    }
  },
  storm(g, L) {
    plinth(g, '#f5d742', L);
    for (const s of [-1, 1]) poly(g, [[s * 4, -4], [s * 14, 2], [s * 5, -16]], '#3a3a44', true, 1);
    poly(g, [[-7, -4], [-3, -42], [3, -42], [7, -4]], linGrad(g, -7, 0, 7, 0, [[0, '#2a2a33'], [0.45, '#6c6c7c'], [1, '#22222a']]));
    for (let i = 0; i < 1 + L; i++) {
      const cy = -10 - i * 7, rx = 9.5 - i * 1.3;
      g.beginPath(); g.ellipse(0, cy, rx, 3, 0, 0, TAU);
      g.lineWidth = 3.4; g.strokeStyle = OL; g.stroke();
      g.lineWidth = 2.4; g.strokeStyle = '#c87533'; g.stroke();
      g.beginPath(); g.ellipse(0, cy, rx, 3, 0, 0.2, 1.6); g.lineWidth = 1; g.strokeStyle = '#ffc890'; g.stroke();
    }
    ell(g, 0, -42, 4, 2, '#8a8a9a');
  },
  arcane(g, L) {
    plinth(g, '#a35cf0', L);
    poly(g, [[-10, -4], [-5, -40], [0, -47], [0, -4]], '#4c3170');
    poly(g, [[0, -4], [0, -47], [5, -40], [10, -4]], '#2c1a45');
    g.beginPath(); g.moveTo(-10, -4); g.lineTo(-5, -40); g.lineTo(0, -47); g.lineTo(5, -40); g.lineTo(10, -4); stroke(g, 1.3);
    const runes = [[-5, -12], [-4, -20], [-3, -28], [-2.5, -35]];
    g.lineWidth = 1.3; g.strokeStyle = '#d6a8ff';
    for (let i = 0; i < Math.min(runes.length, L + 1); i++) {
      const [rx, ry] = runes[i];
      g.beginPath(); g.moveTo(rx - 1.5, ry - 2); g.lineTo(rx + 1, ry); g.lineTo(rx - 1.5, ry + 2); g.moveTo(rx + 1.5, ry - 2); g.lineTo(rx + 1.5, ry + 2); g.stroke();
    }
  },
  fire(g, L) {
    plinth(g, '#ff6a2a', L);
    poly(g, [[-9, -4], [-7, -15], [7, -15], [9, -4]], linGrad(g, -9, 0, 9, 0, [[0, '#3a302b'], [0.45, '#6a5a50'], [1, '#2a221e']]));
    for (const s of [-1, 0, 1]) line(g, s * 8, -14, s * 15, -24, '#2a2420', 2.5);
    g.beginPath(); g.moveTo(-16, -24); g.quadraticCurveTo(-14, -12, 0, -11); g.quadraticCurveTo(14, -12, 16, -24); g.closePath();
    g.fillStyle = linGrad(g, -16, 0, 16, 0, [[0, '#2a2420'], [0.4, '#5a4a40'], [1, '#1e1a17']]); g.fill(); stroke(g, 1.3);
    ell(g, 0, -24, 16, 5, '#3a302b');
    g.beginPath(); g.ellipse(0, -24, 16, 5, 0, 0, TAU); stroke(g, 1.2);
    const gr = FLAT ? '#ff7a20' : (() => { const x = g.createRadialGradient(0, -24, 1, 0, -24, 13); x.addColorStop(0, '#fff0a0'); x.addColorStop(0.5, '#ff8a20'); x.addColorStop(1, '#8a2000'); return x; })();
    ell(g, 0, -24, 13, 3.8, gr);
    if (L >= 3) for (const s of [-1, 1]) poly(g, [[s * 15, -24], [s * 21, -32], [s * 17, -22]], '#d8d0c0', true, 1);
  },
};

export function drawTower(g, t, time) {
  const L = t.level;
  const st = sprite(`tw-${t.type}-${L}-${FLAT ? 1 : 0}`, 64, 96, 32, 70, (x) => TOWER_STATIC[t.type](x, L));
  blit(g, st, t.x, t.y);
  const x = t.x, y = t.y, fl = t.flash || 0, a = t.angle;
  g.save();
  switch (t.type) {
    case 'archer': {
      const ay = y - 44;
      ball(g, x, ay + 2, 6.5, '#2f6e2a');
      ball(g, x + Math.cos(a) * 1.5, ay - 5, 4.3, '#e8c39a');
      g.beginPath(); g.arc(x + Math.cos(a) * 1.5, ay - 5.5, 4.8, Math.PI * 0.95, Math.PI * 2.05); g.fillStyle = '#245a20'; g.fill();
      g.translate(x, ay - 1); g.rotate(a);
      g.beginPath(); g.arc(3, 0, 10, -1.25, 1.25); g.lineWidth = 3.2; g.strokeStyle = OL; g.stroke();
      g.lineWidth = 2.2; g.strokeStyle = L >= 4 ? '#e8b84a' : '#8a5222'; g.stroke();
      const pull = fl > 0.5 ? 0 : 4;
      g.strokeStyle = '#eee'; g.lineWidth = 0.8;
      g.beginPath(); g.moveTo(3 + Math.cos(-1.25) * 10, Math.sin(-1.25) * 10); g.lineTo(3 - pull, 0); g.lineTo(3 + Math.cos(1.25) * 10, Math.sin(1.25) * 10); g.stroke();
      if (fl < 0.5) line(g, 3 - pull, 0, 16, 0, '#e8d8b0', 1.6);
      g.restore(); g.save();
      // Geländer vorne
      g.beginPath(); g.ellipse(x, y - 44, 17, 7, 0, 0, Math.PI); g.lineWidth = 3.2; g.strokeStyle = OL; g.stroke();
      g.lineWidth = 2; g.strokeStyle = '#8a5a2c'; g.stroke();
      for (let k = 0.3; k < Math.PI; k += Math.PI / 5) {
        const px = x + Math.cos(k) * 17, py = y - 38 + Math.sin(k) * 7;
        line(g, px, py, px, py - 7, '#7a4e26', 2.2);
      }
      if (L >= 2) {
        const bx = x + 14, by = y - 38;
        line(g, bx, by, bx, by - 24, '#4a2e12', 1.6);
        g.fillStyle = L >= 4 ? '#e8b84a' : '#3f8f3a';
        g.beginPath(); g.moveTo(bx, by - 24);
        g.quadraticCurveTo(bx + 6, by - 23 + Math.sin(time * 5 + x) * 2, bx + 12, by - 22 + Math.sin(time * 5 + x + 1) * 2.5);
        g.lineTo(bx + 10, by - 18); g.lineTo(bx, by - 16); g.fill();
      }
      light(x, y - 40, 34, '255,190,110', 0.55);
      break;
    }
    case 'cannon': {
      g.translate(x, y - 24);
      ball(g, 0, 2, 7, '#5a3a1e');
      const barrels = L >= 4 ? [-3.5, 3.5] : [0];
      g.rotate(a);
      const rc = -fl * 5;
      for (const off of barrels) {
        g.save(); g.translate(rc, off);
        const len = 20 + L * 1.5;
        poly(g, [[-4, -5.5], [len, -4], [len, 4], [-4, 5.5]], linGrad(g, 0, -5, 0, 5, [[0, '#5a4220'], [0.35, '#e0b860'], [1, '#4a3418']]));
        g.fillStyle = '#3a2a12'; g.fillRect(4, -5, 2.5, 10); g.fillRect(len - 6, -4.6, 2.5, 9.2);
        poly(g, [[len - 1, -5.5], [len + 3, -5.5], [len + 3, 5.5], [len - 1, 5.5]], '#c09040');
        circ(g, len + 3, 0, 2.5, '#111');
        g.restore();
      }
      circ(g, -4, 0, 4.5, '#3a3a3a');
      if (fl > 0.6) glow(g, 30, 0, 16 * fl, '255,200,90', fl);
      g.restore(); g.save();
      if (fl > 0.4) light(x, y - 24, 70, '255,190,90', fl);
      break;
    }
    case 'frost': {
      const bob = Math.sin(time * 2.4 + x) * 2.5;
      const cy = y - 42 + bob, sc = 1 + L * 0.07;
      glow(g, x, cy, 30 + fl * 10, '120,210,255', 0.45 + fl * 0.4);
      const rot = time * 1.2 + x;
      const ring = [];
      for (let i = 0; i < 4; i++) { const an = rot + i * Math.PI / 2; ring.push({ an, px: Math.cos(an) * 9 * sc, py: Math.sin(an) * 3.5 * sc }); }
      const top = [0, -17 * sc], bot = [0, 12 * sc];
      const faces = [];
      for (let i = 0; i < 4; i++) {
        const p1 = ring[i], p2 = ring[(i + 1) % 4];
        const mid = (p1.an + p2.an) / 2 + (i === 3 ? Math.PI : 0);
        faces.push({ p1, p2, depth: Math.sin(mid), lit: Math.cos(mid - 2.4) });
      }
      faces.sort((f1, f2) => f1.depth - f2.depth);
      g.translate(x, cy);
      for (const f of faces) {
        const l = 0.5 + f.lit * 0.35;
        for (const tip of [top, bot]) {
          g.beginPath(); g.moveTo(tip[0], tip[1]); g.lineTo(f.p1.px, f.p1.py); g.lineTo(f.p2.px, f.p2.py); g.closePath();
          g.fillStyle = `rgba(${Math.round(120 + l * 135)},${Math.round(200 + l * 55)},255,0.92)`;
          g.fill();
          g.lineWidth = 0.8; g.strokeStyle = 'rgba(255,255,255,0.7)'; g.stroke();
        }
      }
      g.restore(); g.save();
      for (let i = 0; i < L + 1; i++) {
        const an = time * 1.6 + (i * TAU) / (L + 1);
        const sx = x + Math.cos(an) * 17, sy = cy + Math.sin(an) * 6 + 4;
        poly(g, [[sx, sy - 4], [sx + 2, sy], [sx, sy + 4], [sx - 2, sy]], '#e6fbff', false);
      }
      light(x, cy, 60, '140,220,255', 0.85);
      break;
    }
    case 'storm': {
      const oy = y - 50;
      const r0 = 6 + L * 0.6;
      glow(g, x, oy, 26 + fl * 16, '255,235,120', 0.6 + fl * 0.4);
      ball(g, x, oy, r0, '#ffe14a', false);
      circ(g, x - 1.5, oy - 1.5, r0 * 0.45, '#fffbe0');
      const arcs = 1 + (Math.random() < 0.5 ? 1 : 0) + (fl > 0.5 ? 2 : 0);
      for (let k = 0; k < arcs; k++) {
        const i = Math.floor(Math.random() * (1 + L));
        const ty = y - 10 - i * 7, tx = x + (Math.random() < 0.5 ? -1 : 1) * (9.5 - i * 1.3);
        g.beginPath(); g.moveTo(x, oy);
        for (let s = 1; s <= 4; s++) { const kk = s / 4; g.lineTo(x + (tx - x) * kk + rand(-3, 3), oy + (ty - oy) * kk + rand(-2, 2)); }
        g.strokeStyle = 'rgba(255,255,210,0.9)'; g.lineWidth = 1.1; g.stroke();
      }
      light(x, oy, 60 + fl * 30, '255,240,150', 0.8 + fl * 0.3);
      break;
    }
    case 'arcane': {
      const oy = y - 60 + Math.sin(time * 2 + x) * 2.5;
      glow(g, x, oy, 28 + fl * 14, '190,120,255', 0.55 + fl * 0.45);
      ball(g, x, oy, 6.5, '#a35cf0', false);
      circ(g, x - 2, oy - 2, 2.6, '#f4e8ff');
      const rings = Math.min(3, 1 + Math.floor(L / 2));
      for (let i = 0; i < rings; i++) {
        const tilt = i * 0.9, rr = 13 + i * 3.5, sp = (i % 2 ? -1 : 1) * (1.6 + i * 0.4);
        g.save(); g.translate(x, oy); g.rotate(tilt * 0.4);
        g.beginPath(); g.ellipse(0, 0, rr, 4.5 + i, 0, 0, TAU); g.strokeStyle = 'rgba(210,170,255,0.55)'; g.lineWidth = 1; g.stroke();
        for (let k = 0; k < 3; k++) {
          const an = time * sp + (k * TAU) / 3;
          circ(g, Math.cos(an) * rr, Math.sin(an) * (4.5 + i), 1.7, '#f0dcff');
        }
        g.restore();
      }
      if (L >= 3) for (const s of [-1, 1]) {
        const fy = y - 30 + Math.sin(time * 1.7 + s) * 3;
        poly(g, [[x + s * 16, fy - 4], [x + s * 20, fy], [x + s * 17, fy + 4], [x + s * 13, fy + 1]], '#4c3170', true, 1);
      }
      light(x, oy, 65, '200,140,255', 0.85);
      break;
    }
    case 'fire': {
      const fy = y - 25;
      glow(g, x, fy - 8, 34 + fl * 22, '255,120,30', 0.6 + fl * 0.4);
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      const layers = [['#c8300a', 16, 13], ['#ff7a1a', 12, 10], ['#ffd040', 8, 7], ['#fff6c0', 4, 4]];
      for (const [col, h, w] of layers) {
        for (let i = -1; i <= 1; i++) {
          const fh = (h + L * 1.5) * (1 + fl * 0.5) * (0.85 + 0.25 * Math.sin(time * 13 + i * 2.1 + x + h));
          const fx = x + i * w * 0.45;
          g.beginPath(); g.moveTo(fx - w * 0.5, fy);
          g.quadraticCurveTo(fx - w * 0.5, fy - fh * 0.6, fx + Math.sin(time * 7 + i) * 2, fy - fh);
          g.quadraticCurveTo(fx + w * 0.5, fy - fh * 0.6, fx + w * 0.5, fy);
          g.fillStyle = col; g.globalAlpha = 0.7; g.fill();
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = op;
      light(x, fy - 6, 75 + fl * 30, '255,130,40', 1);
      break;
    }
  }
  g.restore();
  // Stufen-Sterne
  for (let i = 0; i < L; i++) {
    const px = x - (L - 1) * 3.6 + i * 7.2, py = y + 21;
    poly(g, [[px, py - 3.2], [px + 2.6, py], [px, py + 3.2], [px - 2.6, py]], '#f2c14e', true, 0.8);
  }
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

function crownShape(g, x, y, w) {
  g.beginPath();
  g.moveTo(x - w / 2, y); g.lineTo(x - w / 2, y - 7); g.lineTo(x - w / 4, y - 3);
  g.lineTo(x, y - 9); g.lineTo(x + w / 4, y - 3); g.lineTo(x + w / 2, y - 7); g.lineTo(x + w / 2, y); g.closePath();
  g.fillStyle = linGrad(g, x, y - 9, x, y, [[0, '#fff0a0'], [1, '#c8902a']]); g.fill(); stroke(g, 1);
  circ(g, x, y - 3, 1.4, '#e0302a');
}
function wing(g, x, y, s, flap, col) {
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
  if (e.type === 'assassin') g.globalAlpha *= e.blinkFade != null ? e.blinkFade : 0.92;
  ART[e.type](g, e, t);
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

// ================================================================ Projektile & Effekte
export function drawProjectile(g, p) {
  switch (p.kind) {
    case 'arrow': {
      g.save(); g.translate(p.x, p.y); g.rotate(p.ang || 0);
      g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-24, 0); g.lineTo(-10, 0); g.stroke();
      line(g, -10, 0, 6, 0, '#d8c090', 1.8);
      poly(g, [[9, 0], [4, -2.6], [4, 2.6]], '#e0e0e8', false);
      poly(g, [[-11, 0], [-14, -3], [-8, 0], [-14, 3]], '#c0392b', false);
      g.restore();
      break;
    }
    case 'ball': {
      const gx = p.sx + (p.tx - p.sx) * Math.min(1, p.t / p.dur), gy = p.sy + 14 + (p.ty - p.sy) * Math.min(1, p.t / p.dur);
      ell(g, gx, gy, 4, 1.8, 'rgba(0,0,0,0.3)');
      ball(g, p.x, p.y, 4.8, '#2a2a2a');
      glow(g, p.x - 3, p.y + 1, 6, '255,150,60', 0.4);
      break;
    }
    case 'frost': {
      glow(g, p.x, p.y, 13, '150,220,255', 0.9);
      g.save(); g.translate(p.x, p.y); g.rotate((p.ang || 0) + performance.now() / 80);
      poly(g, [[0, -5], [2.4, 0], [0, 5], [-2.4, 0]], '#f4feff', false);
      g.restore();
      light(p.x, p.y, 30, '150,220,255', 0.6);
      break;
    }
    case 'arcane': {
      glow(g, p.x, p.y, 18, '190,120,255', 1);
      circ(g, p.x, p.y, 3.4, '#ffffff');
      light(p.x, p.y, 45, '200,140,255', 0.8);
      break;
    }
  }
}

export function drawEffect(g, fx, time) {
  switch (fx.type) {
    case 'ring': {
      const k = 1 - fx.life / fx.max;
      g.beginPath(); g.arc(fx.x, fx.y, fx.r0 + (fx.r1 - fx.r0) * k, 0, TAU);
      g.strokeStyle = `rgba(${fx.color},${(1 - k) * 0.9})`;
      g.lineWidth = 4 * (1 - k) + 1; g.stroke();
      g.fillStyle = `rgba(${fx.color},${(1 - k) * 0.14})`; g.fill();
      if (fx.bright) light(fx.x, fx.y, fx.r1 * 1.4, fx.color, (1 - k));
      break;
    }
    case 'bolt': {
      const a = fx.life / fx.max;
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      g.lineJoin = 'round'; g.lineCap = 'round';
      for (const [w, c] of [[9, `rgba(255,230,90,${a * 0.25})`], [4, `rgba(255,245,160,${a * 0.6})`], [1.6, `rgba(255,255,255,${a})`]]) {
        g.strokeStyle = c; g.lineWidth = w;
        g.beginPath(); fx.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke();
        for (const br of fx.branches) { g.beginPath(); br.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y))); g.stroke(); }
      }
      g.globalCompositeOperation = op;
      for (const p of fx.hits) { glow(g, p.x, p.y, 16, '255,240,150', a); light(p.x, p.y, 50, '255,240,150', a); }
      break;
    }
    case 'meteor': {
      const k = 1 - fx.t / fx.max;
      const sx = fx.x + 260 * (1 - k), sy = fx.y - 420 * (1 - k);
      g.beginPath(); g.arc(fx.x, fx.y, fx.radius * (0.3 + 0.7 * k), 0, TAU);
      g.strokeStyle = `rgba(255,120,40,${0.3 + k * 0.5})`; g.lineWidth = 2; g.setLineDash([6, 5]); g.stroke(); g.setLineDash([]);
      const op = g.globalCompositeOperation;
      g.globalCompositeOperation = 'lighter';
      const gr = g.createLinearGradient(sx, sy, sx + 90, sy - 150);
      gr.addColorStop(0, 'rgba(255,210,90,0.95)'); gr.addColorStop(1, 'rgba(255,60,10,0)');
      g.strokeStyle = gr; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(sx, sy); g.lineTo(sx + 90, sy - 150); g.stroke();
      g.globalCompositeOperation = op;
      ball(g, sx, sy, 13, '#6a3a20');
      glow(g, sx, sy, 34, '255,140,40', 1);
      light(sx, sy, 120, '255,150,50', 1);
      break;
    }
    case 'death': {
      const k = 1 - fx.life / fx.max;
      g.save();
      g.globalAlpha = 1 - k;
      const e = fx.e;
      g.translate(e.x, e.y + e.r * 0.45);
      g.rotate((e.face || 1) * k * 0.9);
      g.scale(1 - k * 0.4, 1 - k * 0.6);
      g.translate(-e.x, -(e.y + e.r * 0.45));
      drawEnemy(g, e, fx.time, { noBar: true });
      g.restore();
      break;
    }
    case 'scorch': {
      const a = Math.min(1, fx.life / 3) * 0.45;
      g.globalAlpha = a;
      g.drawImage(scorchSprite(), fx.x - fx.r, fx.y - fx.r * 0.6, fx.r * 2, fx.r * 1.2);
      g.globalAlpha = 1;
      break;
    }
  }
}

function scorchSprite() {
  return sprite('scorch', 64, 64, 32, 32, (g) => {
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 30);
    gr.addColorStop(0, 'rgba(10,5,0,0.9)'); gr.addColorStop(0.6, 'rgba(30,15,5,0.5)'); gr.addColorStop(1, 'rgba(30,15,5,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, 30, 0, TAU); g.fill();
  }).c;
}

// Kleines Porträt (Bestiarium, Wellenvorschau) – passt sich der echten Größe der Figur an
const bboxCache = new Map();
function portraitEnemy(type, def) {
  return { type, def, x: 0, y: -def.r * 0.45, r: def.r, wob: 0, face: 1, hp: 1, maxHp: 1, slowT: 0, burnT: 0 };
}
function measure(type, def) {
  let b = bboxCache.get(type);
  if (b) return b;
  const S = 260, c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d');
  g.translate(S / 2, S * 0.75);
  const prev = lightSink; lightSink = null;
  drawEnemy(g, portraitEnemy(type, def), 0.4, { noBar: true, noShadow: !!def.flying });
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
export function drawPortrait(canvas, type, def, time = 0) {
  const g = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  const b = measure(type, def);
  const bw = Math.max(10, b.x1 - b.x0), bh = Math.max(10, b.y1 - b.y0);
  const k = Math.min((w * 0.86) / bw, (h * 0.86) / bh);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, w, h);
  g.setTransform(k, 0, 0, k, w / 2 - ((b.x0 + b.x1) / 2) * k, h / 2 - ((b.y0 + b.y1) / 2) * k);
  const prev = lightSink; lightSink = null;
  drawEnemy(g, portraitEnemy(type, def), time, { noBar: true, noShadow: !!def.flying });
  lightSink = prev;
}
