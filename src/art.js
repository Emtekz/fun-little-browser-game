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
      const base = (col + l) % 2 ? '#5aa23e' : '#4f9536';
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
  // Banner je Reihe
  for (let l = 0; l < 5; l++) {
    const p = L.pt(-0.96, l);
    const bw = cs * 0.2, bh = cs * 0.42;
    g.fillStyle = l % 2 ? '#3a4fb0' : '#7a2ab0';
    g.beginPath(); g.moveTo(p.x - bw / 2, p.y - bh / 2); g.lineTo(p.x + bw / 2, p.y - bh / 2); g.lineTo(p.x + bw / 2, p.y + bh / 2);
    g.lineTo(p.x, p.y + bh / 2 - bw * 0.4); g.lineTo(p.x - bw / 2, p.y + bh / 2); g.closePath(); g.fill();
    stroke(g, 1.2);
    g.fillStyle = '#f2c14e'; g.fillRect(p.x - bw / 2, p.y - bh / 2, bw, bh * 0.1);
    poly(g, [[p.x, p.y - bh * 0.18], [p.x + bw * 0.22, p.y], [p.x, p.y + bh * 0.18], [p.x - bw * 0.22, p.y]], '#9ee8ff', false);
  }

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

// Wächterfels (rollt bei Durchbruch durch die Reihe)
export function drawGuardian(g, x, y, s, rot, charge) {
  ell(g, x + 3 * s, y + 16 * s, 20 * s, 6 * s, 'rgba(0,0,0,0.35)');
  g.save(); g.translate(x, y); g.rotate(rot);
  ball(g, 0, 0, 17 * s, '#6f675c');
  ell(g, -6 * s, -9 * s, 7 * s, 3 * s, 'rgba(90,150,60,0.8)', -0.4);
  circ(g, 8 * s, 6 * s, 2.2 * s, 'rgba(0,0,0,0.25)'); circ(g, -9 * s, 7 * s, 1.6 * s, 'rgba(0,0,0,0.25)');
  g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1.2 * s;
  g.beginPath(); g.arc(0, 0, 11 * s, 0.4, 2.2); g.stroke();
  g.strokeStyle = `rgba(120,230,255,${0.4 + charge * 0.6})`; g.lineWidth = 2 * s;
  g.beginPath(); g.moveTo(-5 * s, -6 * s); g.lineTo(0, 6 * s); g.lineTo(5 * s, -6 * s); g.moveTo(-6 * s, 0); g.lineTo(6 * s, 0); g.stroke();
  g.restore();
  glow(g, x, y, 10 * s, '120,230,255', 0.12 + charge * 0.2);
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
  bloom(g, d, t) {
    const ready = d.prodReady || 0;
    leaf(g, -2, 16, -20, -2, '#3f8f3a');
    leaf(g, 2, 14, 20, -6, '#4aa040');
    g.beginPath(); g.moveTo(0, 20); g.quadraticCurveTo(-5, 4, 0, -10);
    g.lineWidth = 5; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3.4; g.strokeStyle = '#3f7a2a'; g.stroke();
    const by = -16 + Math.sin(t * 2) * 1.5, sc = 1 + Math.sin(t * 3) * 0.05 + ready * 0.08 + d.level * 0.06;
    glow(g, 0, by, (20 + ready * 16) * sc, '120,220,255', 0.45 + ready * 0.5);
    g.save(); g.translate(0, by); g.scale(sc, sc); g.rotate(Math.sin(t) * 0.1);
    const petals = 6 + d.level;
    const pc = d.level >= 3 ? ['#ffe08a', '#d89a2a'] : ['#c9a0ff', '#6a3ab8'];
    for (let i = 0; i < petals; i++) {
      g.save(); g.rotate((i / petals) * TAU);
      g.beginPath(); g.ellipse(0, -11, 5.2, 10, 0, 0, TAU);
      g.fillStyle = linGrad(g, 0, -21, 0, -1, [[0, pc[0]], [1, pc[1]]]); g.fill(); stroke(g, 1);
      g.restore();
    }
    poly(g, [[0, -8], [5.5, 0], [0, 8], [-5.5, 0]], linGrad(g, -5, -8, 5, 8, [[0, '#f0fdff'], [0.5, '#6ad8ff'], [1, '#2a7ad8']]), true, 1);
    poly(g, [[0, -8], [2, -1], [0, 2], [-3, -1]], 'rgba(255,255,255,0.7)', false);
    g.restore();
    light(0, by, 60, '120,220,255', 0.6 + ready * 0.4);
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

  mine(g, d, t) {
    const p = d.armed ? 1 : 1 - (d.armT || 0) / d.def.arm;
    g.beginPath(); g.ellipse(0, 12, 17, 7, 0, 0, TAU); g.fillStyle = '#3a2a1a'; g.fill();
    const up = d.armed ? 4 : 1 + p * 2;
    g.beginPath(); g.ellipse(0, 12 - up, 14, 6, 0, 0, TAU);
    g.fillStyle = linGrad(g, -14, 0, 14, 0, [[0, '#6a6458'], [0.5, '#a39b8f'], [1, '#55504a']]); g.fill(); stroke(g, 1.2);
    const pulse = d.armed ? 0.6 + 0.4 * Math.sin(t * 8) : p * 0.6;
    const col = d.armed ? '255,110,40' : '120,200,255';
    g.strokeStyle = `rgba(${col},${0.3 + pulse * 0.7})`; g.lineWidth = 1.8;
    g.beginPath(); g.ellipse(0, 12 - up, 8, 3.2, 0, 0, TAU); g.moveTo(-5, 12 - up); g.lineTo(5, 12 - up); g.moveTo(0, 9.5 - up); g.lineTo(0, 14.5 - up); g.stroke();
    glow(g, 0, 12 - up, 14 + pulse * 8, col, pulse);
    if (!d.armed) {
      g.beginPath(); g.arc(0, -4, 6, -Math.PI / 2, -Math.PI / 2 + p * TAU);
      g.strokeStyle = 'rgba(160,230,255,0.9)'; g.lineWidth = 2; g.stroke();
    } else light(0, 8, 40, col, pulse);
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
    const p = 1 - Math.max(0, d.fuse || 0) / 0.9;
    glow(g, 0, 12, 30 + p * 30, '255,120,30', 0.5 + p * 0.5);
    g.save(); g.translate(0, 12); g.scale(1, 0.4);
    g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.lineWidth = 3; g.strokeStyle = `rgba(255,${150 + p * 100},60,${0.6 + p * 0.4})`; g.stroke();
    g.beginPath(); g.arc(0, 0, 19, 0, TAU); g.lineWidth = 1.5; g.stroke();
    g.rotate(t * 3);
    for (let i = 0; i < 6; i++) {
      g.rotate(TAU / 6);
      g.beginPath(); g.moveTo(-3, -22); g.lineTo(0, -26); g.lineTo(3, -22); g.lineTo(0, -19); g.closePath();
      g.fillStyle = '#ffd060'; g.fill();
    }
    g.restore();
    const r = 6 + p * 8 + Math.sin(t * 30) * 1.5;
    circ(g, 0, 4, r, `rgba(255,${200 + p * 55},120,0.9)`);
    light(0, 4, 80 + p * 60, '255,140,40', 1);
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

  thorns(g, d, t) {
    for (let i = 0; i < 4; i++) {
      const y0 = 4 + i * 4.5, sw = Math.sin(t * 1.5 + i) * 2;
      g.beginPath(); g.moveTo(-26, y0 + 2); g.bezierCurveTo(-12, y0 - 8 + sw, 8, y0 + 8 - sw, 26, y0 - 2);
      g.lineWidth = 4.6; g.strokeStyle = OL; g.stroke(); g.lineWidth = 3; g.strokeStyle = i % 2 ? '#2f5a1f' : '#3a6e26'; g.stroke();
      for (let k = -2; k <= 2; k++) {
        const x = k * 10 + i * 2, y = y0 + Math.sin(k + i) * 3;
        poly(g, [[x - 1.8, y], [x + (k % 2 ? 2 : -2), y - 6 - d.level], [x + 1.8, y]], '#d8d0b0', true, 0.6);
      }
    }
    for (let k = 0; k < 2 + d.level; k++) {
      const x = -16 + k * 12, y = 6 + (k % 2) * 6;
      for (let p = 0; p < 5; p++) circ(g, x + Math.cos(p * 1.26) * 2.6, y + Math.sin(p * 1.26) * 2.6, 2, '#b04ad8');
      circ(g, x, y, 1.5, '#ffe060');
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

export function drawDefender(g, d, t, opt = {}) {
  ell(g, 2, 21, d.type === 'thorns' || d.type === 'bomb' || d.type === 'mine' ? 0 : 20, 6.5, 'rgba(0,0,0,0.32)');
  DEF[d.type](g, d, t + (d.wob || 0));
  if (d.hitFlash > 0) glow(g, 0, -4, 30, '255,120,100', Math.min(1, d.hitFlash * 6) * 0.7);
  if (!opt.noUi) {
    for (let i = 0; i < d.level; i++) star(g, -(d.level - 1) * 4 + i * 8, 28, 1);
    if (d.hp < d.maxHp && d.maxHp < 1e6 && d.type !== 'bomb') {
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
  const sc = type === 'thorns' || type === 'mine' || type === 'bomb' ? 1.15 : 0.9;
  g.scale(sc, sc);
  if (type === 'thorns' || type === 'mine' || type === 'bomb') g.translate(0, -10);
  DEF[type](g, { type, def, level: 1, hp: 1, maxHp: 1, prodReady: 0.3, charge: 0.6, armed: true, fuse: 0.45, wob: 0 }, 0.5);
}
