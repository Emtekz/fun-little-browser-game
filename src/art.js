// Kristallwacht – Grafik für Spielfeld, Burgmauer, Verteidiger & Mana
// Verteidiger werden in lokalen Koordinaten gezeichnet: ein Feld = 64 Einheiten, (0,0) = Feldmitte.
import {
  TAU, OL, seeded, shade, circ, ell, ball, oval, poly, line, linGrad, stroke, eye, glow, light, wing,
} from './monsters.js';

const rand = (a, b) => a + Math.random() * (b - a);

// ================================================================ Spielfeld (vorgerendert)
// L: Layout mit pt(x, lane) -> Bildschirmpunkt, cs = Feldgröße, w/h = Bühnengröße (CSS-Pixel)
export function renderBoard(L, dpr) {
  const c = document.createElement('canvas');
  c.width = Math.round(L.w * dpr);
  c.height = Math.round(L.h * dpr);
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const rnd = seeded(1234);
  const cs = L.cs;
  const R = (x0, x1, l0, l1) => {
    const a = L.pt(x0, l0), b = L.pt(x1, l1);
    return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
  };

  // Hintergrund: dunkler Wald rundherum
  const bg = g.createLinearGradient(0, 0, 0, L.h);
  bg.addColorStop(0, '#16261a'); bg.addColorStop(1, '#0d1810');
  g.fillStyle = bg; g.fillRect(0, 0, L.w, L.h);
  const lawn = R(0, 9, -0.5, 4.5);
  const all = R(-1.2, 10.6, -0.85, 4.85);
  for (let i = 0; i < 260; i++) {
    const x = rnd() * L.w, y = rnd() * L.h;
    if (x > all.x - 10 && x < all.x + all.w + 10 && y > all.y - 10 && y < all.y + all.h + 10) continue;
    const r = cs * (0.25 + rnd() * 0.35);
    ball(g, x, y, r, ['#1f3f22', '#24482a', '#1a3520'][Math.floor(rnd() * 3)], false);
  }

  // Monster-Seite: düsterer Waldboden
  const sp = R(9, 10.6, -0.85, 4.85);
  g.fillStyle = '#2a2a1e'; g.fillRect(sp.x, sp.y, sp.w, sp.h);
  for (let i = 0; i < 400; i++) {
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(90,80,50,0.25)';
    g.fillRect(sp.x + rnd() * sp.w, sp.y + rnd() * sp.h, 2, 2);
  }
  for (let l = 0; l < 5; l++) {
    const p = R(9, 10.6, l - 0.32, l + 0.32);
    g.fillStyle = 'rgba(110,85,55,0.55)';
    g.beginPath(); g.roundRect(p.x, p.y, p.w, p.h, cs * 0.2); g.fill();
  }

  // Hecken-Rand an den langen Seiten
  const hedge = (l) => {
    for (let x = -0.7; x <= 10.5; x += 0.22) {
      const p = L.pt(x, l);
      const col = x > 9 ? '#24361f' : ['#2f6a2a', '#357a30', '#2a5e26'][Math.floor(rnd() * 3)];
      ball(g, p.x + rand(-2, 2), p.y + rand(-2, 2), cs * (0.16 + rnd() * 0.08), col, false);
    }
  };
  hedge(-0.68); hedge(4.68);

  // Rasen mit Schachbrettmuster
  for (let l = 0; l < 5; l++) {
    for (let col = 0; col < 9; col++) {
      const r = R(col, col + 1, l - 0.5, l + 0.5);
      const base = (col + l) % 2 ? '#66b847' : '#59a93d';
      const gr = g.createRadialGradient(r.x + r.w * 0.4, r.y + r.h * 0.35, 2, r.x + r.w / 2, r.y + r.h / 2, r.w * 0.75);
      gr.addColorStop(0, shade(base, 0.12)); gr.addColorStop(1, shade(base, -0.12));
      g.fillStyle = gr;
      g.beginPath(); g.roundRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, cs * 0.08); g.fill();
      for (let k = 0; k < 26; k++) {
        const x = r.x + 4 + rnd() * (r.w - 8), y = r.y + 4 + rnd() * (r.h - 8), h = cs * (0.04 + rnd() * 0.05);
        g.strokeStyle = shade(base, (rnd() - 0.5) * 0.4); g.lineWidth = 1;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - h); g.stroke();
      }
      if (rnd() < 0.35) {
        const fx = r.x + rnd() * r.w, fy = r.y + rnd() * r.h;
        const fc = ['#f5e663', '#ff8fb5', '#ffffff', '#9ec9ff'][Math.floor(rnd() * 4)];
        for (let k = 0; k < 3; k++) circ(g, fx + rand(-5, 5), fy + rand(-4, 4), cs * 0.025, fc);
      }
    }
  }
  // Übergang Rasen -> Waldboden
  const edge = R(8.9, 9.6, -0.5, 4.5);
  const eg = L.portrait ? g.createLinearGradient(0, edge.y + edge.h, 0, edge.y) : g.createLinearGradient(edge.x, 0, edge.x + edge.w, 0);
  eg.addColorStop(0, 'rgba(42,42,30,0)'); eg.addColorStop(0.4, 'rgba(42,42,30,0.7)'); eg.addColorStop(1, 'rgba(42,42,30,1)');
  g.fillStyle = eg; g.fillRect(edge.x, edge.y, edge.w, edge.h);
  // tote Bäume und Felsen auf der Monsterseite
  for (let l = -0.5; l <= 4.5; l += 1) {
    const p = L.pt(10.1 + rnd() * 0.3, l);
    deadTree(g, p.x, p.y, cs * 0.012 * (0.9 + rnd() * 0.3), rnd);
  }

  // Burgseite: Pflaster
  const yard = R(-1.2, 0, -0.85, 4.85);
  g.fillStyle = '#5e5850'; g.fillRect(yard.x, yard.y, yard.w, yard.h);
  for (let i = 0; i < 220; i++) {
    const x = yard.x + rnd() * yard.w, y = yard.y + rnd() * yard.h;
    g.beginPath(); g.ellipse(x, y, cs * 0.07, cs * 0.05, rnd() * 3, 0, TAU);
    g.fillStyle = shade('#8a8378', (rnd() - 0.5) * 0.35); g.fill();
    g.lineWidth = 0.8; g.strokeStyle = 'rgba(0,0,0,0.3)'; g.stroke();
  }
  // Mauer
  const wall = R(-1.2, -0.72, -0.85, 4.85);
  g.fillStyle = linGrad(g, wall.x, wall.y, wall.x + wall.w, wall.y + wall.h, [[0, '#8d857a'], [0.5, '#a39b8f'], [1, '#6f685f']]);
  g.fillRect(wall.x, wall.y, wall.w, wall.h);
  const bs = cs * 0.16;
  g.strokeStyle = 'rgba(30,20,10,0.35)'; g.lineWidth = 1;
  for (let y = wall.y; y < wall.y + wall.h; y += bs * 0.6) {
    g.beginPath(); g.moveTo(wall.x, y); g.lineTo(wall.x + wall.w, y); g.stroke();
    const off = (Math.round((y - wall.y) / (bs * 0.6)) % 2) * bs * 0.5;
    for (let x = wall.x + off; x < wall.x + wall.w; x += bs) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + bs * 0.6); g.stroke(); }
  }
  // Zinnen zur Spielfeldseite
  for (let l = -0.85; l < 4.85; l += 0.3) {
    const a = L.pt(-0.72, l), b = L.pt(-0.58, l + 0.18);
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
    g.fillStyle = linGrad(g, x, y, x + w, y + h, [[0, '#b0a89b'], [1, '#7a7368']]);
    g.fillRect(x, y, w, h); g.strokeStyle = OL; g.lineWidth = 1; g.strokeRect(x, y, w, h);
  }
  g.strokeStyle = OL; g.lineWidth = 1.5; g.strokeRect(wall.x, wall.y, wall.w, wall.h);
  // Vignette
  const vg = g.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.35, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.75);
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)');
  g.fillStyle = vg; g.fillRect(0, 0, L.w, L.h);
  return c;
}

function deadTree(g, x, y, s, rnd) {
  ell(g, x + 4 * s, y + 4 * s, 18 * s, 6 * s, 'rgba(0,0,0,0.35)');
  const br = (x0, y0, a, len, w, depth) => {
    const x1 = x0 + Math.cos(a) * len, y1 = y0 + Math.sin(a) * len;
    line(g, x0, y0, x1, y1, '#120d0a', w + 1.5);
    line(g, x0, y0, x1, y1, '#3a2c22', w);
    if (depth > 0) {
      br(x1, y1, a - 0.5 - rnd() * 0.3, len * 0.7, w * 0.65, depth - 1);
      br(x1, y1, a + 0.45 + rnd() * 0.3, len * 0.65, w * 0.65, depth - 1);
    }
  };
  br(x, y, -Math.PI / 2, 26 * s, 6 * s, 3);
}

// ================================================================ dynamische Umgebung
export function drawTorch(g, x, y, s, t) {
  line(g, x, y + 8 * s, x, y, '#3a2a1a', 2.5 * s);
  const h = (7 + Math.sin(t * 15 + x) * 1.6) * s;
  poly(g, [[x - 3.5 * s, y], [x, y - h - 3 * s], [x + 3.5 * s, y]], '#ffb030', false);
  poly(g, [[x - 1.8 * s, y], [x, y - h * 0.6], [x + 1.8 * s, y]], '#fff2a0', false);
  glow(g, x, y - 3 * s, 16 * s, '255,160,60', 0.8);
  light(x, y - 3 * s, 70 * s, '255,170,80', 0.9);
}

// Mana-Kristall (s = Größenfaktor)
export function drawOrb(g, x, y, s, t, a = 1) {
  g.save();
  g.globalAlpha *= a;
  glow(g, x, y, 26 * s, '110,210,255', 0.9);
  const sq = Math.cos(t * 3);
  g.translate(x, y);
  const w = 9 * s * Math.max(0.25, Math.abs(sq));
  poly(g, [[0, -13 * s], [w, -2 * s], [0, 13 * s], [-w, -2 * s]], linGrad(g, -w, -13 * s, w, 13 * s, [[0, '#e8fbff'], [0.5, '#58c8ff'], [1, '#2a6ad8']]), true, 1.2);
  poly(g, [[0, -13 * s], [w * 0.4, -2 * s], [0, 4 * s], [-w * 0.5, -2 * s]], 'rgba(255,255,255,0.55)', false);
  const sp = (t * 2) % 1;
  circ(g, -6 * s + sp * 4 * s, -9 * s, 1.6 * s * (1 - sp), '#ffffff');
  g.restore();
  light(x, y, 50 * s, '110,210,255', 0.8 * a);
}

// Bannrune in der Burgmauer (stößt bei Durchbruch alle Monster der Reihe zurück)
export function drawBannRune(g, x, y, s, t, ready, recharge) {
  g.beginPath(); g.roundRect(x - 11 * s, y - 13 * s, 22 * s, 26 * s, 5 * s);
  g.fillStyle = linGrad(g, x - 11 * s, y - 13 * s, x + 11 * s, y + 13 * s, [[0, '#6a6458'], [1, '#3e3a33']]); g.fill(); stroke(g, 1.3);
  const pulse = ready ? 0.65 + Math.sin(t * 3) * 0.35 : 0.12;
  const col = ready ? '120,230,255' : '120,130,140';
  if (ready) glow(g, x, y, 22 * s, col, pulse * 0.8);
  g.strokeStyle = `rgba(${col},${0.45 + pulse * 0.55})`; g.lineWidth = 2 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x, y - 8 * s); g.lineTo(x, y + 8 * s); g.moveTo(x - 6 * s, y - 3 * s); g.lineTo(x, y + 2 * s); g.lineTo(x + 6 * s, y - 3 * s); g.stroke();
  if (!ready) {
    for (let i = 0; i < 3; i++) circ(g, x + (i - 1) * 5 * s, y + 17 * s, 1.8 * s, i < 3 - recharge ? '#9ee8ff' : 'rgba(0,0,0,0.5)');
    g.strokeStyle = 'rgba(20,10,5,0.8)'; g.lineWidth = 1 * s;
    g.beginPath(); g.moveTo(x - 7 * s, y - 12 * s); g.lineTo(x - 2 * s, y - 4 * s); g.lineTo(x - 5 * s, y + 3 * s); g.stroke();
  } else light(x, y, 40 * s, col, pulse * 0.7);
}

// wehende Banner an der Mauer
export function drawBanner(g, x, y, s, t, col) {
  const bw = 10 * s, bh = 22 * s;
  line(g, x - bw * 0.7, y - bh / 2, x + bw * 0.7, y - bh / 2, '#3a2a1a', 2 * s);
  const w1 = Math.sin(t * 3 + x * 0.05) * 2.5 * s, w2 = Math.sin(t * 3 + 1 + x * 0.05) * 3.5 * s;
  g.beginPath(); g.moveTo(x - bw / 2, y - bh / 2);
  g.lineTo(x + bw / 2, y - bh / 2);
  g.quadraticCurveTo(x + bw / 2 + w1, y, x + bw / 2 + w2, y + bh / 2);
  g.lineTo(x + w2 * 0.6, y + bh / 2 - 4 * s);
  g.lineTo(x - bw / 2 + w2, y + bh / 2);
  g.quadraticCurveTo(x - bw / 2 + w1, y, x - bw / 2, y - bh / 2);
  g.fillStyle = col; g.fill(); stroke(g, 1);
  g.fillStyle = '#f2c14e'; g.fillRect(x - bw / 2, y - bh / 2, bw, 2.2 * s);
}

// Irrlicht: schwebendes Mana-Wesen, das man fangen kann
export function drawWisp(g, x, y, s, t, a = 1) {
  g.save(); g.globalAlpha *= a;
  glow(g, x, y, 30 * s, '120,255,220', 0.55 + Math.sin(t * 6) * 0.15);
  glow(g, x, y, 12 * s, '220,255,250', 0.9);
  circ(g, x, y, 4.5 * s, '#f4fffd');
  const blink = Math.sin(t * 1.7) > 0.95 ? 0.2 : 1;
  ell(g, x - 1.6 * s, y - 0.5 * s, 0.8 * s, 1.1 * s * blink, '#1a5a60');
  ell(g, x + 1.6 * s, y - 0.5 * s, 0.8 * s, 1.1 * s * blink, '#1a5a60');
  g.restore();
  light(x, y, 70 * s, '120,255,220', 0.9 * a);
}

// ---------------------------------------------------------------- Lebendige Umgebung
// Vorberechnete Grasbüschel & Blumen (logische Koordinaten), damit sie im Wind wehen können
export function buildLife() {
  const rnd = seeded(777);
  const tufts = [], flowers = [];
  for (let l = 0; l < 5; l++) for (let c = 0; c < 9; c++) {
    for (let k = 0; k < 3; k++) tufts.push({ x: c + 0.1 + rnd() * 0.8, l: l - 0.4 + rnd() * 0.8, h: 0.08 + rnd() * 0.07, col: ['#4a9a30', '#5cb03c', '#3f8a2a', '#72c24e'][Math.floor(rnd() * 4)] });
    if (rnd() < 0.35) flowers.push({ x: c + 0.15 + rnd() * 0.7, l: l - 0.35 + rnd() * 0.7, col: ['#ffe066', '#ff8fc8', '#ffffff', '#a8c8ff', '#ff9a50'][Math.floor(rnd() * 5)] });
  }
  return { tufts, flowers };
}

export function drawLife(g, L, life, t, night) {
  const cs = L.cs, day = 1 - night;
  // Wolkenschatten ziehen über die Wiese
  if (day > 0.05) {
    for (let i = 0; i < 3; i++) {
      const u = ((t * 0.012 * (1 + i * 0.3) + i * 0.37) % 1.4) - 0.2;
      const p = L.pt(-1 + u * 12, 0.8 + i * 1.5 + Math.sin(t * 0.05 + i) * 0.5);
      g.globalAlpha = 0.09 * day;
      ell(g, p.x, p.y, cs * (1.6 + i * 0.3), cs * (0.9 + i * 0.2), '#0a2010', 0.3);
      g.globalAlpha = 1;
    }
  }
  // Gras im Wind
  g.lineCap = 'round';
  for (const tf of life.tufts) {
    const p = L.pt(tf.x, tf.l);
    const wind = Math.sin(t * 1.8 - tf.x * 0.9 + tf.l * 0.3) * 0.5 + Math.sin(t * 4.3 + tf.x * 5) * 0.15;
    const h = tf.h * cs;
    g.strokeStyle = tf.col; g.lineWidth = Math.max(1, cs * 0.018);
    g.beginPath();
    for (const o of [-0.35, 0, 0.35]) {
      g.moveTo(p.x + o * h * 0.4, p.y);
      g.quadraticCurveTo(p.x + o * h * 0.6 + wind * h * 0.3, p.y - h * 0.6, p.x + o * h + wind * h * 0.8, p.y - h * (1 - Math.abs(o) * 0.3));
    }
    g.stroke();
  }
  // Blumen nicken im Wind
  for (const f of life.flowers) {
    const p = L.pt(f.x, f.l);
    const wind = Math.sin(t * 1.8 - f.x * 0.9 + f.l * 0.3) * 0.5;
    const hx = p.x + wind * cs * 0.04, hy = p.y - cs * 0.09;
    g.strokeStyle = '#3f8a2a'; g.lineWidth = Math.max(1, cs * 0.015);
    g.beginPath(); g.moveTo(p.x, p.y); g.quadraticCurveTo(p.x, hy + cs * 0.04, hx, hy); g.stroke();
    for (let k = 0; k < 5; k++) circ(g, hx + Math.cos(k * 1.26 + wind) * cs * 0.022, hy + Math.sin(k * 1.26 + wind) * cs * 0.022, cs * 0.018, f.col);
    circ(g, hx, hy, cs * 0.012, '#ffd23a');
  }
  // Schmetterlinge (tagsüber)
  if (day > 0.1) {
    const cols = ['#ff9ad0', '#9ad8ff', '#ffe066', '#c8a0ff'];
    for (let i = 0; i < 4; i++) {
      const x = 4.5 + 4.2 * Math.sin(t * 0.11 * (1 + i * 0.3) + i * 1.7);
      const l = 2 + 2.3 * Math.sin(t * 0.15 * (1 + i * 0.2) + i * 2.9);
      const p = L.pt(x, l);
      const y = p.y - cs * (0.35 + Math.sin(t * 2 + i) * 0.08);
      const f = Math.abs(Math.sin(t * 16 + i * 3));
      g.globalAlpha = day;
      for (const sd of [-1, 1]) ell(g, p.x + sd * cs * 0.035 * f, y, cs * 0.035 * f + 0.5, cs * 0.045, cols[i], sd * 0.4);
      ell(g, p.x, y, cs * 0.01, cs * 0.03, '#2a1a10');
      g.globalAlpha = 1;
    }
  }
  // Vogelschwarm zieht ab und zu vorbei
  const fp = (t % 31) / 31;
  if (fp < 0.3 && day > 0.3) {
    const k = fp / 0.3;
    for (let i = 0; i < 5; i++) {
      const bx = -cs + k * (L.w + 2 * cs) - i * cs * 0.35, by = L.h * 0.12 + Math.abs(i - 2) * cs * 0.18 + Math.sin(t * 2 + i) * 3;
      const f = Math.sin(t * 12 + i) * cs * 0.05;
      g.strokeStyle = `rgba(20,20,30,${0.6 * day})`; g.lineWidth = Math.max(1.2, cs * 0.02);
      g.beginPath(); g.moveTo(bx - cs * 0.09, by - f); g.quadraticCurveTo(bx - cs * 0.04, by - cs * 0.03, bx, by); g.quadraticCurveTo(bx + cs * 0.04, by - cs * 0.03, bx + cs * 0.09, by - f); g.stroke();
    }
  }
}

// Sonnenstrahlen (nach dem Licht gezeichnet)
export function drawSunRays(g, L, t, day) {
  if (day < 0.05) return;
  const op = g.globalCompositeOperation;
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = L.w * (0.15 + i * 0.25) + Math.sin(t * 0.2 + i) * L.w * 0.04;
    const w = L.cs * (0.6 + 0.3 * Math.sin(t * 0.3 + i * 2));
    const gr = g.createLinearGradient(x, 0, x - L.h * 0.5, L.h);
    gr.addColorStop(0, `rgba(255,240,190,${0.07 * day})`); gr.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w - L.h * 0.5, L.h); g.lineTo(x - L.h * 0.5 - w, L.h); g.closePath(); g.fill();
  }
  g.globalCompositeOperation = op;
}

// ================================================================ Verteidiger
function star(g, x, y, s) {
  poly(g, [[x, y - 3.4 * s], [x + 2.6 * s, y], [x, y + 3.4 * s], [x - 2.6 * s, y]], '#f2c14e', true, 0.8);
}
function leaf(g, x, y, dx, dy, col) {
  g.beginPath(); g.moveTo(x, y);
  g.quadraticCurveTo(x + dx * 0.5, y + dy - 8, x + dx, y + dy);
  g.quadraticCurveTo(x + dx * 0.4, y + dy + 6, x, y);
  g.fillStyle = col; g.fill(); stroke(g, 1.1);
}

const DEF = {
  miner(g, d, t) {
    const sw = d.swing || 0, full = d.pile >= d.pileMax;
    // Kristallader rechts
    const vx = 15, vy = 16;
    glow(g, vx, vy - 6, 16, '110,210,255', 0.35 + sw * 0.6);
    for (const [ox, oy, h, w] of [[-4, 2, 9, 3.2], [5, 2, 11, 3.6], [0, 0, 16, 4.4]]) {
      poly(g, [[vx + ox - w, vy + oy], [vx + ox, vy + oy - h], [vx + ox + w, vy + oy]], linGrad(g, vx + ox - w, vy + oy - h, vx + ox + w, vy + oy, [[0, '#f0fdff'], [0.5, '#6ad8ff'], [1, '#2a6ad8']]), true, 1);
    }
    // Kristallstapel links
    const n = d.pileMax ? Math.min(5, Math.ceil(((d.pile || 0) / d.pileMax) * 5)) : 0;
    const spots = [[-18, 20], [-11, 21], [-15, 15], [-22, 15], [-18, 10]];
    for (let i = 0; i < n; i++) {
      const [px, py] = spots[i];
      poly(g, [[px, py - 6], [px + 3, py], [px, py + 2], [px - 3, py]], linGrad(g, px - 3, py - 6, px + 3, py + 2, [[0, '#ffffff'], [1, '#3a9aff']]), true, 0.8);
    }
    if (n) { glow(g, -17, 15, 14 + n * 2, '110,210,255', 0.3 + (full ? 0.4 + Math.sin(t * 6) * 0.2 : 0)); light(-17, 15, 30 + n * 6, '110,210,255', 0.5); }
    // Gnom
    const bob = full ? Math.sin(t * 1.5) * 0.8 : 0;
    g.save(); g.translate(-2, 0); g.rotate(sw * 0.12);
    line(g, -3, 10, -4, 19, OL, 5); line(g, -3, 10, -4, 19, '#4a3a5a', 3.4);
    line(g, 3, 10, 4, 19, OL, 5); line(g, 3, 10, 4, 19, '#4a3a5a', 3.4);
    ell(g, -5, 20, 4, 2, '#3a2414'); ell(g, 5, 20, 4, 2, '#3a2414');
    oval(g, 0, 4 + bob, 9, 9, '#3a6ad0');
    g.fillStyle = '#5a3a1e'; g.fillRect(-9, 7 + bob, 18, 2.6);
    ball(g, 1, -9 + bob, 7, '#f1c8a0');
    g.beginPath(); g.moveTo(-5, -7 + bob); g.quadraticCurveTo(-6, 6 + bob, 2, 7 + bob); g.quadraticCurveTo(9, 6 + bob, 8, -7 + bob); g.quadraticCurveTo(2, -3 + bob, -5, -7 + bob);
    g.fillStyle = '#f4f4f0'; g.fill(); stroke(g, 1);
    ball(g, 5, -8 + bob, 2.4, '#e8a080');
    if (full) { line(g, 1.5, -11 + bob, 4.5, -11 + bob, '#1a1a1a', 1.2); line(g, -3, -11 + bob, 0, -11 + bob, '#1a1a1a', 1.2); }
    else { circ(g, 3, -11 + bob, 1.2, '#1a1a1a'); circ(g, -1, -11 + bob, 1.1, '#1a1a1a'); }
    const flop = Math.sin(t * 2) * 2 + (full ? 5 : 0);
    g.beginPath(); g.moveTo(-7, -12 + bob); g.quadraticCurveTo(-3, -30 + bob, -12 - flop, -30 + bob); g.quadraticCurveTo(-1, -22 + bob, 9, -12 + bob); g.closePath();
    g.fillStyle = d.level >= 3 ? '#e8b84a' : '#c8302a'; g.fill(); stroke(g, 1.1);
    g.beginPath(); g.ellipse(1, -12 + bob, 8.5, 2.6, 0, 0, TAU); g.fillStyle = '#e8e0d0'; g.fill(); stroke(g, 0.9);
    // Spitzhacke
    const a = full ? 0.9 : 0.35 - (1 - sw) * 2.1;
    g.save(); g.translate(5, 0 + bob); g.rotate(a);
    line(g, 0, 0, 16, 0, OL, 3.6); line(g, 0, 0, 16, 0, '#7a5a2a', 2.2);
    g.beginPath(); g.moveTo(16, -7); g.quadraticCurveTo(20, 0, 16, 7); g.lineTo(15, 0); g.closePath();
    g.fillStyle = '#b8bcc4'; g.fill(); stroke(g, 1);
    g.restore();
    line(g, 2, 2 + bob, 6, 0 + bob, '#f1c8a0', 3);
    g.restore();
    if (full) {
      g.font = 'bold 9px Georgia'; g.fillStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(t * 3) * 0.4) + ')';
      g.fillText('z', 10, -22 - (t * 6 % 6)); g.fillText('z', 14, -28 - ((t * 6 + 3) % 6));
    }
  },

  archer(g, d, t) {
    const ch = d.charge || 0, br = Math.sin(t * 2) * 0.6;
    // Umhang
    poly(g, [[-5, -12 + br], [-14, 16], [-3, 12]], '#1f4a1c');
    // Beine
    line(g, -3, 6, -5, 19, OL, 5); line(g, -3, 6, -5, 19, '#2f5a2a', 3.4);
    line(g, 3, 6, 4, 19, OL, 5); line(g, 3, 6, 4, 19, '#2f5a2a', 3.4);
    ell(g, -5, 20, 4, 2, '#5a3a1e'); ell(g, 5, 20, 4, 2, '#5a3a1e');
    // Körper
    oval(g, 0, -1 + br, 8, 10.5, '#3f8f3a');
    g.fillStyle = '#6a4424'; g.fillRect(-8, 2 + br, 16, 2.6);
    circ(g, 0, 3.3 + br, 1.6, '#f2c14e');
    // Kopf
    g.beginPath(); g.moveTo(-4, -22 + br); g.quadraticCurveTo(-12, -14 + br, -9, -2 + br); g.lineTo(-4, -12 + br); g.closePath();
    g.fillStyle = '#f0d070'; g.fill(); stroke(g, 1);
    ball(g, 1, -16 + br, 6.6, '#f1cfa6');
    poly(g, [[-3, -18 + br], [-13, -24 + br], [-4, -14 + br]], '#f1cfa6', true, 1);
    g.beginPath(); g.arc(1, -17 + br, 7, Math.PI * 1.02, Math.PI * 1.98); g.lineTo(6, -15 + br); g.fillStyle = '#2f6e2a'; g.fill(); stroke(g, 1);
    circ(g, 4.5, -15.5 + br, 1.2, '#1a3a5a');
    // Bogen
    const bx = 9, by = -4 + br;
    g.beginPath(); g.arc(bx - 6, by, 15, -1.15, 1.15);
    g.lineWidth = 3.6; g.strokeStyle = OL; g.stroke();
    g.lineWidth = 2.4; g.strokeStyle = d.level >= 3 ? '#e8b84a' : '#8a5222'; g.stroke();
    const tx = bx - 6 + Math.cos(-1.15) * 15, ty = by + Math.sin(-1.15) * 15, ux = bx - 6 + Math.cos(1.15) * 15, uy = by + Math.sin(1.15) * 15;
    const pull = bx - 6 + 6 - ch * 9;
    g.strokeStyle = '#eee'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(tx, ty); g.lineTo(pull, by); g.lineTo(ux, uy); g.stroke();
    if (ch > 0.25) { line(g, pull, by, pull + 20, by, '#e8d8b0', 1.8); poly(g, [[pull + 23, by], [pull + 18, by - 2.5], [pull + 18, by + 2.5]], '#ddd', false); }
    line(g, 1, -2 + br, bx - 2, by, '#f1cfa6', 2.6);
    if (d.level >= 2) glow(g, bx + 10, by, 8, '255,240,180', 0.3);
  },

  wall(g, d, t) {
    const dmg = 1 - d.hp / d.maxHp;
    const br = Math.sin(t * 1.2) * 0.6;
    ball(g, -22, 4, 7, '#7d766b'); ball(g, 22, 4, 7, '#7d766b');
    g.beginPath(); g.roundRect(-20, -26 + br, 40, 46 - br, 12);
    g.fillStyle = linGrad(g, -20, -26, 20, 20, [[0, '#b7afa2'], [0.5, '#8d857a'], [1, '#5e584f']]); g.fill(); stroke(g, 1.8);
    g.beginPath(); g.ellipse(-4, -24 + br, 15, 5, -0.1, 0, TAU); g.fillStyle = '#5a9a3a'; g.fill();
    circ(g, -12, -23 + br, 3, '#6aaa44'); circ(g, 6, -25 + br, 2.5, '#6aaa44');
    const lv = d.level;
    const ec = lv >= 3 ? '255,210,90' : '120,230,255';
    for (const ex of [-7, 7]) { circ(g, ex, -8 + br, 3, `rgb(${ec})`); glow(g, ex, -8 + br, 8, ec, 0.8); }
    g.strokeStyle = 'rgba(30,20,10,0.6)'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-6, 3 + br); g.quadraticCurveTo(0, dmg > 0.5 ? 0 : 5, 6, 3 + br); g.stroke();
    if (lv >= 2) { g.strokeStyle = `rgba(${ec},0.7)`; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-14, 12); g.lineTo(-10, 8); g.lineTo(-6, 12); g.moveTo(6, 12); g.lineTo(10, 8); g.lineTo(14, 12); g.stroke(); }
    g.strokeStyle = 'rgba(20,10,5,0.85)'; g.lineWidth = 1.5;
    if (dmg > 0.33) { g.beginPath(); g.moveTo(10, -24); g.lineTo(6, -16); g.lineTo(11, -10); g.lineTo(8, -2); g.stroke(); }
    if (dmg > 0.66) { g.beginPath(); g.moveTo(-18, -6); g.lineTo(-10, -2); g.lineTo(-14, 6); g.moveTo(-2, 20); g.lineTo(2, 12); g.lineTo(-3, 8); g.stroke(); poly(g, [[14, -26], [20, -20], [20, -26]], '#2a241e', false); }
  },

  root(g, d, t) {
    const ready = (d.cdT || 0) <= 0, act = d.active || 0;
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU + 0.3, sw = Math.sin(t * 1.3 + i) * 0.06;
      g.beginPath(); g.moveTo(Math.cos(a) * 4, 13 + Math.sin(a) * 2);
      g.quadraticCurveTo(Math.cos(a + 0.5 + sw) * 14, 13 + Math.sin(a + 0.5) * 6, Math.cos(a + 0.2) * 24, 14 + Math.sin(a + 0.2) * 8);
      g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = i % 2 ? '#5a3a1e' : '#6e4a26'; g.stroke();
    }
    const pulse = ready ? 0.6 + Math.sin(t * 3) * 0.3 : 0.15;
    g.strokeStyle = `rgba(140,255,120,${pulse})`; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(0, 13, 9, 3.5, 0, 0, TAU); g.moveTo(-5, 13); g.lineTo(5, 13); g.moveTo(0, 10.5); g.lineTo(0, 15.5); g.stroke();
    if (ready) { glow(g, 0, 13, 16, '140,255,120', pulse * 0.6); light(0, 12, 35, '140,255,120', pulse * 0.6); }
    if (act > 0) {
      for (let i = 0; i < 5; i++) {
        const x0 = (i - 2) * 7, h = 26 * Math.min(1, act * 2.5);
        g.beginPath(); g.moveTo(x0, 16);
        g.bezierCurveTo(x0 + 8 * Math.sin(t * 5 + i), 16 - h * 0.4, x0 - 8 * Math.cos(t * 4 + i), 16 - h * 0.8, x0 + Math.sin(t * 6 + i) * 3, 16 - h);
        g.lineWidth = 4.4; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3; g.strokeStyle = '#4a8a2a'; g.stroke();
        ell(g, x0 + 3, 16 - h * 0.6, 3, 1.6, '#6ac04a', 0.6);
      }
    }
    if (!ready) {
      const p = 1 - d.cdT / d.cdMax;
      g.beginPath(); g.arc(0, -2, 6, -Math.PI / 2, -Math.PI / 2 + p * TAU); g.strokeStyle = 'rgba(160,255,140,0.9)'; g.lineWidth = 2; g.stroke();
    }
  },

  frost(g, d, t) {
    const br = Math.sin(t * 2) * 0.6, ch = d.charge || 0;
    glow(g, 0, 0, 30, '140,220,255', 0.25);
    g.beginPath(); g.moveTo(-12, 20); g.lineTo(-6, -10 + br); g.lineTo(6, -10 + br); g.lineTo(12, 20); g.closePath();
    g.fillStyle = linGrad(g, -12, 0, 12, 0, [[0, '#1e3a8a'], [0.5, '#3f6ad8'], [1, '#18307a']]); g.fill(); stroke(g, 1.4);
    g.strokeStyle = '#d8f0ff'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-12, 19); g.lineTo(12, 19); g.moveTo(0, -9 + br); g.lineTo(0, 19); g.stroke();
    ball(g, 0, -15 + br, 6.2, '#f1cfa6');
    poly(g, [[-5, -13 + br], [5, -13 + br], [3, -2 + br], [0, 2 + br], [-3, -2 + br]], '#f4f8ff', true, 1);
    circ(g, 3, -16 + br, 1.1, '#1a2a4a');
    poly(g, [[-11, -18 + br], [4 + Math.sin(t) * 2, -46 + br], [11, -18 + br]], linGrad(g, -11, 0, 11, 0, [[0, '#1a2a6a'], [0.5, '#3050b8'], [1, '#14205a']]), true, 1.3);
    g.beginPath(); g.ellipse(0, -18 + br, 13, 3.6, 0, 0, TAU); g.fillStyle = '#24387e'; g.fill(); stroke(g, 1);
    circ(g, -2, -28 + br, 1.4, '#f2c14e'); circ(g, 2, -36 + br, 1.1, '#f2c14e');
    line(g, 12, 20, 13, -22 + br, OL, 3.6); line(g, 12, 20, 13, -22 + br, '#7a5a2a', 2.4);
    const cy = -27 + br;
    glow(g, 13, cy, 14 + ch * 10, '160,230,255', 0.6 + ch * 0.4);
    poly(g, [[13, cy - 8], [17, cy], [13, cy + 6], [9, cy]], linGrad(g, 9, cy - 8, 17, cy + 6, [[0, '#ffffff'], [1, '#58b8ff']]), true, 1);
    for (let i = 0; i < d.level + 1; i++) {
      const a = t * 2 + (i * TAU) / (d.level + 1);
      circ(g, 13 + Math.cos(a) * 9, cy + Math.sin(a) * 4, 1.4, '#e8faff');
    }
    light(13, cy, 55, '150,220,255', 0.7);
  },

  bomb(g, d, t) {
    const pulse = 0.6 + Math.sin(t * 4) * 0.3;
    glow(g, 0, 12, 26, '255,120,30', pulse * 0.6);
    g.save(); g.translate(0, 12); g.scale(1, 0.4);
    g.beginPath(); g.arc(0, 0, 24, 0, TAU); g.lineWidth = 3; g.strokeStyle = `rgba(255,170,60,${pulse})`; g.stroke();
    g.beginPath(); g.arc(0, 0, 17, 0, TAU); g.lineWidth = 1.5; g.stroke();
    g.rotate(t * 0.8);
    for (let i = 0; i < 6; i++) {
      g.rotate(TAU / 6);
      g.beginPath(); g.moveTo(-3, -20); g.lineTo(0, -24); g.lineTo(3, -20); g.lineTo(0, -17); g.closePath();
      g.fillStyle = '#ffd060'; g.fill();
    }
    g.restore();
    poly(g, [[0, 4], [5, 12], [0, 18], [-5, 12]], `rgba(255,200,90,${pulse})`, false);
    light(0, 10, 45, '255,140,40', pulse * 0.7);
  },

  dwarf(g, d, t) {
    const br = Math.sin(t * 2.2) * 0.5, ch = d.charge || 0;
    line(g, -4, 8, -5, 19, OL, 6); line(g, -4, 8, -5, 19, '#4a3a2a', 4.4);
    line(g, 4, 8, 5, 19, OL, 6); line(g, 4, 8, 5, 19, '#4a3a2a', 4.4);
    ell(g, -6, 20, 5, 2.4, '#2a1e14'); ell(g, 6, 20, 5, 2.4, '#2a1e14');
    oval(g, 0, 1 + br, 12, 11, '#8a5a2a');
    g.beginPath(); g.arc(0, 1 + br, 10, Math.PI * 1.1, Math.PI * 1.9); g.lineTo(0, 1 + br); g.fillStyle = '#9aa2ae'; g.fill(); stroke(g, 1);
    g.fillStyle = '#3a2410'; g.fillRect(-11, 6 + br, 22, 3);
    ball(g, 1, -11 + br, 7, '#f1c8a0');
    g.beginPath(); g.moveTo(-6, -9 + br); g.quadraticCurveTo(-8, 8 + br, 2, 10 + br); g.quadraticCurveTo(10, 8 + br, 9, -9 + br);
    g.quadraticCurveTo(2, -4 + br, -6, -9 + br);
    g.fillStyle = linGrad(g, 0, -9, 0, 10, [[0, '#d8682a'], [1, '#a03a14']]); g.fill(); stroke(g, 1.1);
    circ(g, 4, -12 + br, 1.3, '#1a1a1a');
    g.beginPath(); g.arc(1, -13 + br, 7.6, Math.PI, 0); g.fillStyle = linGrad(g, -7, -20, 8, -13, [[0, '#c8ccd4'], [1, '#6a707a']]); g.fill(); stroke(g, 1.1);
    g.fillStyle = '#e8b84a'; g.fillRect(-6.6, -14.4 + br, 15.2, 2);
    for (const s of [-1, 1]) {
      g.beginPath(); g.moveTo(1 + s * 6, -17 + br); g.quadraticCurveTo(1 + s * 13, -19 + br, 1 + s * 12, -27 + br);
      g.lineWidth = 3.6; g.strokeStyle = OL; g.stroke(); g.lineWidth = 2.4; g.strokeStyle = '#f0e6d0'; g.stroke();
    }
    // Armbrust
    const cy = -1 + br;
    g.fillStyle = '#6a4220'; g.fillRect(2, cy - 2, 22, 4); g.strokeStyle = OL; g.lineWidth = 1; g.strokeRect(2, cy - 2, 22, 4);
    g.beginPath(); g.arc(18, cy, 10, -1.3, 1.3); g.lineWidth = 3.2; g.strokeStyle = OL; g.stroke(); g.lineWidth = 2; g.strokeStyle = d.level >= 3 ? '#e8b84a' : '#9aa2ae'; g.stroke();
    const sx = 18 + Math.cos(1.3) * 10, sp = 14 - ch * 6;
    g.strokeStyle = '#ddd'; g.lineWidth = 0.9;
    g.beginPath(); g.moveTo(sx, cy - 9.6); g.lineTo(sp, cy); g.lineTo(sx, cy + 9.6); g.stroke();
    if (ch > 0.2) line(g, sp, cy, sp + 14, cy, '#3a3a3a', 2);
  },

  portal(g, d, t) {
    const ready = (d.cdT || 0) <= 0, flash = d.flash || 0;
    const k = ready ? 1 : 0.35;
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU;
      ell(g, Math.cos(a) * 24, 13 + Math.sin(a) * 9, 4, 2.6, shade('#6a6478', Math.sin(a) * 0.2));
    }
    g.save(); g.translate(0, 13); g.scale(1, 0.38);
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 22);
    gr.addColorStop(0, 'rgba(20,0,40,0.95)'); gr.addColorStop(0.6, `rgba(110,40,190,${0.8 * k + flash * 0.2})`); gr.addColorStop(1, `rgba(200,140,255,${0.6 * k})`);
    g.beginPath(); g.arc(0, 0, 22, 0, TAU); g.fillStyle = gr; g.fill();
    g.rotate(-t * (ready ? 2.5 : 0.6));
    g.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      g.rotate(TAU / 3);
      g.beginPath(); g.arc(6, 0, 12, 0.2, 2.2); g.strokeStyle = `rgba(220,180,255,${0.75 * k})`; g.stroke();
    }
    g.restore();
    if (ready) { glow(g, 0, 10, 26 + flash * 20, '170,90,255', 0.5 + flash * 0.5); light(0, 10, 50, '170,90,255', 0.7); }
    else {
      const p = 1 - d.cdT / d.cdMax;
      g.beginPath(); g.arc(0, -4, 6, -Math.PI / 2, -Math.PI / 2 + p * TAU); g.strokeStyle = 'rgba(210,170,255,0.9)'; g.lineWidth = 2; g.stroke();
    }
  },

  storm(g, d, t) {
    const ch = d.charge || 0;
    poly(g, [[-13, 20], [-9, 4], [9, 4], [13, 20]], linGrad(g, -13, 0, 13, 0, [[0, '#55506a'], [0.5, '#9a94ae'], [1, '#433e55']]));
    g.beginPath(); g.ellipse(0, 4, 9, 3, 0, 0, TAU); g.fillStyle = '#b8b2c8'; g.fill(); stroke(g, 1);
    for (const s of [-1, 1]) line(g, s * 9, 6, s * 13, -6, '#c87533', 2);
    const cy = -18 + Math.sin(t * 2.3) * 2.5;
    glow(g, 0, cy, 30 + ch * 18, '200,170,255', 0.55 + ch * 0.45);
    g.save(); g.translate(0, cy); g.rotate(Math.sin(t) * 0.15);
    poly(g, [[0, -18], [8, -4], [5, 12], [0, 16], [-5, 12], [-8, -4]], linGrad(g, -8, -18, 8, 16, [[0, '#fff6c0'], [0.4, '#c8a0ff'], [1, '#5a2ab8']]), true, 1.3);
    poly(g, [[0, -18], [3, -4], [0, 14], [-3, -4]], 'rgba(255,255,255,0.4)', false);
    g.restore();
    const arcs = 1 + (Math.random() < 0.4 ? 1 : 0) + (ch > 0.7 ? 2 : 0);
    for (let k = 0; k < arcs; k++) {
      const a = Math.random() * TAU;
      g.beginPath(); g.moveTo(0, cy);
      let x = 0, y = cy;
      for (let s = 0; s < 3; s++) { x += Math.cos(a) * 6 + rand(-3, 3); y += Math.sin(a) * 6 + rand(-3, 3); g.lineTo(x, y); }
      g.strokeStyle = 'rgba(255,250,210,0.9)'; g.lineWidth = 1; g.stroke();
    }
    for (let i = 0; i < d.level; i++) {
      const a = t * 2.5 + (i * TAU) / d.level;
      circ(g, Math.cos(a) * 16, cy + Math.sin(a) * 5, 1.8, '#fff2a0');
    }
    light(0, cy, 70, '210,180,255', 0.8);
  },

  dragon(g, d, t) {
    const ch = d.charge || 0, br = Math.sin(t * 2) * 0.8, fire = d.fireT > 0;
    oval(g, -2, 15, 18, 7, '#6e675e');
    wing(g, -6, -2 + br, -1, Math.sin(t * 3) * 0.25, '#7a1a14');
    g.beginPath(); g.moveTo(-10, 10); g.quadraticCurveTo(-24, 14, -22, 2 + Math.sin(t * 3) * 3);
    g.lineWidth = 5.4; g.strokeStyle = OL; g.stroke(); g.lineWidth = 4; g.strokeStyle = '#c0392b'; g.stroke();
    oval(g, -2, 4 + br, 12, 10, '#c0392b');
    oval(g, 1, 7 + br, 7, 6, '#f0a050', 0, false);
    g.beginPath(); g.moveTo(4, -2 + br); g.quadraticCurveTo(8, -12 + br, 10, -16 + br);
    g.lineWidth = 8; g.strokeStyle = OL; g.stroke(); g.lineWidth = 6.2; g.strokeStyle = '#c0392b'; g.stroke();
    const hx = 13, hy = -18 + br;
    ball(g, hx, hy, 7.5, '#c8402e');
    const jaw = fire ? 4 : ch * 2;
    poly(g, [[hx + 3, hy - 3], [hx + 14, hy - 1], [hx + 13, hy + 2], [hx + 3, hy + 2]], '#c8402e', true, 1);
    poly(g, [[hx + 3, hy + 2], [hx + 12, hy + 2 + jaw], [hx + 3, hy + 5]], '#a02a1e', true, 1);
    for (const hxo of [-3, 1]) poly(g, [[hx + hxo, hy - 6], [hx + hxo - 6, hy - 15], [hx + hxo + 2, hy - 7]], '#f0e0b0', true, 0.8);
    eye(g, hx + 2, hy - 2.5, 2, '#ffe14a', '#3a1a00');
    wing(g, -2, -4 + br, 1, Math.sin(t * 3) * 0.25, '#d8483a');
    if (fire || ch > 0.6) glow(g, hx + 14, hy + 1, 10 + (fire ? 10 : 0), '255,150,40', fire ? 1 : ch);
    if (d.level >= 2) for (let i = 0; i < 3; i++) poly(g, [[-8 + i * 5, -6 + br], [-6 + i * 5, -11 + br], [-4 + i * 5, -6 + br]], d.level >= 3 ? '#f2c14e' : '#7a1a14', true, 0.8);
    light(hx + 10, hy, 50, '255,130,40', 0.5 + (fire ? 0.5 : 0));
  },
};

const GROUND = new Set(['root', 'bomb', 'portal']);
export function drawDefender(g, d, t, opt = {}) {
  if (!GROUND.has(d.type)) ell(g, 2, 21, 20, 6.5, 'rgba(0,0,0,0.32)');
  DEF[d.type](g, d, t + (d.wob || 0));
  if (d.hitFlash > 0) glow(g, 0, -4, 30, '255,120,100', Math.min(1, d.hitFlash * 6) * 0.7);
  if (!opt.noUi) {
    for (let i = 0; i < d.level; i++) star(g, -(d.level - 1) * 4 + i * 8, 28, 1);
    if (d.hp < d.maxHp && d.maxHp < 1e6) {
      const f = Math.max(0, d.hp / d.maxHp);
      g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(-16, -40, 32, 5);
      g.fillStyle = f > 0.5 ? '#6ee05a' : f > 0.25 ? '#f2c14e' : '#ff4a3a';
      g.fillRect(-15, -39, 30 * f, 3);
    }
  }
}

// Rüstungs-Zusatz für Monster (Helm / Schild), wird im Monster-Koordinatensystem gezeichnet
export function drawArmor(g, e) {
  if (!e.armor || e.armor <= 0) return;
  const f = e.armor / e.maxArmor;
  if (e.def.armorKind === 'helm') {
    g.save(); g.translate(1, -22); g.rotate(-0.15);
    g.beginPath(); g.moveTo(-8, 3); g.lineTo(-6.5, -6); g.quadraticCurveTo(0, -9, 6.5, -6); g.lineTo(8, 3); g.closePath();
    g.fillStyle = linGrad(g, -8, 0, 8, 0, [[0, '#4a4e56'], [0.4, '#9aa2ae'], [1, '#3a3e46']]); g.fill(); stroke(g, 1.2);
    line(g, 8, -1, 11, -2, '#5a5e66', 2);
    if (f < 0.5) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -7); g.lineTo(0, -2); g.lineTo(-3, 2); g.stroke(); }
    g.restore();
  } else {
    g.save(); g.translate(11, -14);
    g.beginPath(); g.roundRect(-4, -14, 9, 28, 3);
    g.fillStyle = linGrad(g, -4, 0, 5, 0, [[0, '#5a3a1e'], [0.5, '#8a5a2a'], [1, '#4a2e14']]); g.fill(); stroke(g, 1.4);
    g.fillStyle = '#9aa2ae'; g.fillRect(-4, -12, 9, 2.5); g.fillRect(-4, 9.5, 9, 2.5);
    circ(g, 0.5, 0, 2.6, '#c8ccd4');
    if (f < 0.5) { g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1; g.beginPath(); g.moveTo(-2, -6); g.lineTo(2, 0); g.lineTo(-1, 6); g.stroke(); }
    g.restore();
  }
}

// Kartensymbol
export function drawDefenderIcon(canvas, type, def) {
  const g = canvas.getContext('2d');
  const k = canvas.width / 64;
  g.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height / 2 + 6 * k);
  g.clearRect(-40, -50, 80, 100);
  const ground = GROUND.has(type);
  const sc = ground ? 1.15 : 0.9;
  g.scale(sc, sc);
  if (ground) { g.translate(0, -10); ell(g, 0, 13, 27, 11, 'rgba(40,26,14,0.85)'); }
  DEF[type](g, { type, def, level: 1, hp: 1, maxHp: 1, pile: 40, pileMax: 60, swing: 0.6, charge: 0.6, cdT: 0, cdMax: 1, wob: 0 }, 0.5);
}
