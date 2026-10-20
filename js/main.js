// Runenwacht – Spiellogik, Rendering-Ablauf, Eingabe & UI
import {
  TILE, COLS, ROWS, W, H, MAPS, TOWERS, TOWER_KEYS, UPGRADE_FACTOR, MAX_LEVEL,
  ENEMIES, BOSS_ORDER, SWARM_ORDER, traitsOf,
} from './data.js';
import {
  TAU, buildMapArt, drawPools, drawTree, drawPortal, drawCastle, drawTower, drawEnemy, enemyLift,
  drawProjectile, drawEffect, drawPortrait, glow, glowSprite, setLightSink, setFlat, circ, ell,
} from './art.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const START_GOLD = 220, START_LIVES = 20;
const METEOR_CD = 45, METEOR_RADIUS = 1.6 * TILE;
const STORE_KEY = 'runenwacht-best-v1';
const SETTINGS_KEY = 'runenwacht-settings-v1';
const TARGET_MODES = ['first', 'last', 'strong', 'near'];
const TARGET_LABEL = { first: 'Vorderster', last: 'Hinterster', strong: 'Stärkster', near: 'Nächster' };
const UNDEAD = new Set(['skeleton', 'ghost', 'lich', 'necro']);
const FIERY = new Set(['firelem', 'imp', 'demon', 'dragon']);
const STONE = new Set(['golem', 'gargoyle']);

function fmt(n) {
  n = Math.floor(n);
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}
function loadJSON(key, def) { try { return JSON.parse(localStorage.getItem(key)) || def; } catch { return def; } }
function saveJSON(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } }

const settings = loadJSON(SETTINGS_KEY, { quality: 'high' });
const isHigh = () => settings.quality === 'high';
setFlat(!isHigh());

// ---------------------------------------------------------------- Pfad
function buildPath(map) {
  const pts = map.points.map(([c, r]) => ({ x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }));
  const segs = [];
  let len = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    segs.push({ a, b, l, start: len, ang: Math.atan2(b.y - a.y, b.x - a.x) });
    len += l;
  }
  const tiles = new Set();
  for (let i = 0; i < map.points.length - 1; i++) {
    const [c0, r0] = map.points[i], [c1, r1] = map.points[i + 1];
    const dc = Math.sign(c1 - c0), dr = Math.sign(r1 - r0);
    let c = c0, r = r0;
    for (;;) {
      if (c >= 0 && c < COLS && r >= 0 && r < ROWS) tiles.add(r * COLS + c);
      if (c === c1 && r === r1) break;
      c += dc; r += dr;
    }
  }
  return { pts, segs, len, tiles };
}
function posAt(path, d) {
  d = clamp(d, 0, path.len);
  for (const s of path.segs) {
    if (d <= s.start + s.l) {
      const t = (d - s.start) / s.l;
      return { x: s.a.x + (s.b.x - s.a.x) * t, y: s.a.y + (s.b.y - s.a.y) * t, ang: s.ang };
    }
  }
  const s = path.segs[path.segs.length - 1];
  return { x: s.b.x, y: s.b.y, ang: s.ang };
}

const PREPARED = MAPS.map((m) => { const path = buildPath(m); return { path, art: buildMapArt(m, path) }; });

// ---------------------------------------------------------------- Zustand
let S = null;
const view = { k: 1, dpr: 1 };

function newGame(mapIdx) {
  const map = MAPS[mapIdx];
  const { path, art } = PREPARED[mapIdx];
  S = {
    map, mapIdx, path, art,
    gold: START_GOLD, lives: START_LIVES, wave: 0, score: 0,
    towers: [], grid: new Array(COLS * ROWS).fill(null),
    enemies: [], newEnemies: [], projectiles: [], effects: [], decals: [], particles: [], texts: [], timers: [],
    spawners: [], waveRunning: false, nextTimer: -1, upcoming: null,
    time: 0, speed: 1, paused: false, over: false, auto: S ? S.auto : true,
    selected: null, selEnemy: null, buildType: null, ghost: null, hover: null,
    spellMode: false, meteorCd: 0,
    shake: 0, hurtFlash: 0, banner: null, night: 0,
    seen: new Set(), intros: [], intro: null,
    weather: makeWeather(map.theme),
  };
  S.upcoming = makeWave(1);
  hideOverlay();
  renderInfo();
  renderNextWave();
  syncHud(true);
}

const hpMult = (w) => S.map.diff * (1 + 0.1 * (w - 1)) * Math.pow(1.05, w - 1);
const goldMult = (w) => 1 + 0.05 * (w - 1);
const isNightWave = (w) => w > 0 && [8, 9, 0].includes(w % 10);

// ---------------------------------------------------------------- Wellen
function makeWave(w) {
  const list = [];
  const pool = Object.entries(ENEMIES).filter(([, d]) => d.unlock && w >= d.unlock)
    .map(([k, d]) => [k, d.wt * (w - d.unlock > 20 ? 0.6 : 1)]);
  const total = pool.reduce((s, u) => s + u[1], 0);
  const pick = () => {
    let v = Math.random() * total;
    for (const [k, wt] of pool) { v -= wt; if (v <= 0) return k; }
    return pool[0][0];
  };
  let n = Math.floor(6 + w * 1.25);
  let interval = Math.max(0.3, 0.95 - w * 0.015);
  let boss = null, swarm = null;

  if (w % 10 === 0) {
    boss = BOSS_ORDER[(w / 10 - 1) % BOSS_ORDER.length];
    n = Math.floor(n * 0.6);
    for (let i = 0; i < n; i++) list.push(pick());
    const bosses = 1 + Math.floor(w / 40);
    for (let i = 0; i < bosses; i++) list.push(boss);
  } else if (w % 5 === 0) {
    const avail = SWARM_ORDER.filter((k) => ENEMIES[k].unlock <= w);
    swarm = avail[(w / 5 - 1) % avail.length];
    n = Math.floor(n * 1.6);
    for (let i = 0; i < n; i++) list.push(swarm);
    interval *= 0.55;
  } else {
    for (let i = 0; i < n; i++) list.push(pick());
  }
  return { wave: w, list, interval, boss, swarm };
}

function startWave() {
  if (!S || S.over || S.spawners.length) return;
  let bonus = 0;
  if (S.waveRunning) bonus = 10 + S.wave * 2;
  else if (S.nextTimer > 0) bonus = Math.ceil(S.nextTimer) * 2;
  if (bonus > 0) {
    S.gold += bonus;
    floatText(W / 2, 60, `+${bonus} 💰 Frühstart`, '#f2c14e');
  }
  const wasNight = isNightWave(S.wave);
  S.wave++;
  S.waveRunning = true;
  S.nextTimer = -1;
  const wv = S.upcoming && S.upcoming.wave === S.wave ? S.upcoming : makeWave(S.wave);
  S.spawners.push({ queue: wv.list.slice(), t: 0, interval: wv.interval, wave: S.wave });
  S.upcoming = makeWave(S.wave + 1);
  renderNextWave();
  let sub = wv.swarm ? `Ein Schwarm: ${ENEMIES[wv.swarm].name}!` : '';
  if (isNightWave(S.wave) && !wasNight) sub = 'Die Nacht bricht herein …';
  S.banner = { text: wv.boss ? `Welle ${S.wave} – ${ENEMIES[wv.boss].name}!` : `Welle ${S.wave}`, sub, life: 2.6, max: 2.6, boss: !!wv.boss };
}

function spawnEnemy(type, wave, d = 0) {
  const def = ENEMIES[type];
  const hp = def.hp * hpMult(wave);
  const e = {
    type, def, wave, hp, maxHp: hp, hpShown: hp, speed: def.speed, d, x: -TILE, y: 0, ang: 0, face: 1,
    slowT: 0, slowF: 0, burnT: 0, burnDps: 0, r: def.r, flying: !!def.flying,
    gold: Math.max(1, Math.round(def.gold * goldMult(wave))),
    off: def.boss ? 0 : rand(-7, 7), wob: Math.random() * 10,
    healT: 0, sumT: 0, leapCd: rand(1.5, 3), leapT: 0, hop: 0, blinkCd: rand(2, 3.5), blinkFade: null,
    hitFlash: 0, immuneT: 0, dead: false, enraged: false, shielded: false, revived: false,
  };
  placeEnemy(e);
  S.newEnemies.push(e);
  if (!S.seen.has(type)) {
    S.seen.add(type);
    if (type !== 'goblin') S.intros.push(type);
  }
  return e;
}
function placeEnemy(e) {
  const p = posAt(S.path, e.d);
  e.ang = p.ang;
  const c = Math.cos(p.ang);
  if (Math.abs(c) > 0.3) e.face = c > 0 ? 1 : -1;
  e.x = p.x - Math.sin(p.ang) * e.off;
  e.y = p.y + Math.cos(p.ang) * e.off;
}

// ---------------------------------------------------------------- Kampf
function hurt(e, amount, kind, src) {
  if (e.dead || amount <= 0) return;
  const res = (e.def.res && e.def.res[kind]) || 0;
  if (res >= 1) {
    if (e.immuneT <= 0) { floatText(e.x, e.y - e.r * 2 - 10, 'immun', '#c8c8c8', 0.7); e.immuneT = 1.2; }
    return;
  }
  amount *= 1 - res;
  if (e.shielded) amount *= 0.75;
  e.hp -= amount;
  e.hitFlash = 0.07;
  if (e.hp <= 0) kill(e, src);
}

function kill(e, src) {
  e.dead = true;
  S.gold += e.gold;
  S.score += Math.round(e.def.gold * 10 * S.map.diff * (1 + S.wave * 0.05));
  if (src) src.kills++;
  floatText(e.x, e.y - e.r - 8, `+${e.gold}`, '#f2c14e');
  const cy = e.y - e.r * 0.6 - enemyLift(e, S.time);
  const life = e.def.revive && !e.revived ? 1.4 : 0.45;
  S.effects.push({ type: 'death', e: { ...e, slowT: 0, burnT: 0, hitFlash: 0, shielded: false, enraged: false }, life, max: life, time: S.time, flying: e.flying });

  if (UNDEAD.has(e.type)) {
    for (let i = 0; i < 6; i++) addP(e.x + rand(-4, 4), cy, rand(-10, 10), rand(-60, -30), 0.9, '#9ff0ff', 3, 0, true);
  } else if (FIERY.has(e.type)) {
    burst(e.x, cy, '#ff8a2a', 18, 2.2, true);
    addDecal(e.x, e.y, 18);
  } else if (STONE.has(e.type)) {
    burst(e.x, cy, '#8a8070', 14, 1.6);
  } else if (e.type === 'slime' || e.type === 'slimelet') {
    burst(e.x, cy, e.def.color, 16, 1.6);
  } else {
    burst(e.x, cy, '#8a1a1a', 8, 1.4);
    burst(e.x, cy, e.def.color, 6, 1.2);
  }
  if (e.def.boss) {
    S.shake = 0.6;
    burst(e.x, cy, '#f2c14e', 50, 3, true);
    ring(e.x, e.y, TILE * 2.5, '255,220,120', 0.7, 10, true);
  }
  if (e.def.split) {
    const n = e.def.splitN || 2;
    for (let i = 0; i < n; i++) {
      const s = spawnEnemy(e.def.split, e.wave, Math.max(0, e.d + (i - (n - 1) / 2) * 14));
      s.off = clamp(e.off + rand(-8, 8), -10, 10);
    }
  }
  if (e.def.revive && !e.revived) {
    const { d, off, wave, maxHp } = e;
    S.timers.push({ t: 1.4, fn: () => {
      const s = spawnEnemy('skeleton', wave, d);
      s.off = off; s.revived = true; s.hp = s.hpShown = maxHp * e.def.revive; s.gold = 1;
      placeEnemy(s);
      ring(s.x, s.y, TILE * 0.8, '120,255,140', 0.5, 4, true);
    } });
  }
}

function inRange(t, e, range) {
  const dx = e.x - t.x, dy = e.y - t.y;
  return dx * dx + dy * dy <= range * range;
}
function findTarget(t, range) {
  let best = null, bv = -Infinity;
  for (const e of S.enemies) {
    if (e.dead || (e.flying && !t.def.air) || e.x < -10) continue;
    const dx = e.x - t.x, dy = e.y - t.y, d2 = dx * dx + dy * dy;
    if (d2 > range * range) continue;
    let v;
    switch (t.mode) {
      case 'last': v = -e.d; break;
      case 'strong': v = e.hp; break;
      case 'near': v = -d2; break;
      default: v = e.d;
    }
    if (v > bv) { bv = v; best = e; }
  }
  return best;
}
function splash(x, y, radius, fn, air = true) {
  for (const e of S.enemies) {
    if (e.dead || (e.flying && !air)) continue;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy <= (radius + e.r) * (radius + e.r)) fn(e);
  }
}
function applyBurn(e, dps, dur, src) {
  const res = (e.def.res && e.def.res.fire) || 0;
  if (res >= 1) return;
  e.burnT = dur;
  e.burnDps = Math.max(e.burnDps, dps);
  e.burnSrc = src;
}

// ---------------------------------------------------------------- Partikel & Effekte
const pCap = () => (isHigh() ? 900 : 300);
function addP(x, y, vx, vy, life, color, size, grav = 0, add = false, kind = 'dot') {
  if (S.particles.length >= pCap()) return;
  S.particles.push({ x, y, vx, vy, life, max: life, color, size, grav, add, kind });
}
function burst(x, y, color, n, speed = 2, add = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rand(20, 80) * speed;
    addP(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.7), color, rand(1.5, 3.5), 60, add);
  }
}
function smoke(x, y, n, size = 6) {
  for (let i = 0; i < n; i++) addP(x + rand(-4, 4), y + rand(-3, 3), rand(-12, 12), rand(-30, -10), rand(0.6, 1.1), 'rgba(90,85,80,0.5)', size * rand(0.7, 1.2), -5, false, 'smoke');
}
function floatText(x, y, text, color, life = 1.1) { S.texts.push({ x, y, text, color, life, max: life }); }
function ring(x, y, r1, color, life = 0.35, r0 = 4, bright = false) {
  S.effects.push({ type: 'ring', x, y, r0, r1, color, life, max: life, bright });
}
function addDecal(x, y, r) {
  S.decals.push({ type: 'scorch', x, y, r, life: 12 });
  if (S.decals.length > 30) S.decals.shift();
}

// ---------------------------------------------------------------- Türme
function canBuild(c, r) {
  const i = r * COLS + c;
  return c >= 0 && c < COLS && r >= 0 && r < ROWS && !S.path.tiles.has(i) && !S.art.blocked.has(i) && !S.grid[i];
}
function upgradeCost(t) { return t.level >= MAX_LEVEL ? Infinity : Math.round(t.def.cost * UPGRADE_FACTOR[t.level - 1]); }
function sellValue(t) { return Math.floor(t.spent * 0.7); }

function build(c, r) {
  const def = TOWERS[S.buildType];
  if (S.gold < def.cost) { toast('Nicht genug Gold!'); return false; }
  const t = {
    type: S.buildType, def, c, r, x: (c + 0.5) * TILE, y: (r + 0.5) * TILE,
    level: 1, spent: def.cost, cd: 0.2, angle: -Math.PI / 2, mode: 'first', kills: 0, flash: 0,
  };
  S.gold -= def.cost;
  S.towers.push(t);
  S.grid[r * COLS + c] = t;
  smoke(t.x, t.y + 8, 8, 7);
  ring(t.x, t.y, TILE * 0.8, '255,240,200', 0.4);
  return true;
}
function upgradeSelected() {
  const t = S.selected;
  if (!t || t.level >= MAX_LEVEL) return;
  const cost = upgradeCost(t);
  if (S.gold < cost) { toast('Nicht genug Gold!'); return; }
  S.gold -= cost;
  t.spent += cost;
  t.level++;
  ring(t.x, t.y, TILE, '242,193,78', 0.5, 4, true);
  for (let i = 0; i < 24; i++) addP(t.x + rand(-14, 14), t.y + rand(-4, 10), 0, rand(-70, -30), rand(0.5, 0.9), '#ffd86a', 2.5, 0, true);
  renderInfo();
}
function sellSelected() {
  const t = S.selected;
  if (!t) return;
  const v = sellValue(t);
  S.gold += v;
  floatText(t.x, t.y - 20, `+${v}`, '#f2c14e');
  smoke(t.x, t.y, 12, 8);
  S.towers.splice(S.towers.indexOf(t), 1);
  S.grid[t.r * COLS + t.c] = null;
  S.selected = null;
  renderInfo();
}
function cycleTarget() {
  const t = S.selected;
  if (!t || t.type === 'fire') return;
  t.mode = TARGET_MODES[(TARGET_MODES.indexOf(t.mode) + 1) % TARGET_MODES.length];
  renderInfo();
}

function updateTower(t, dt) {
  const L = t.level - 1, def = t.def;
  const range = def.range[L] * TILE;
  t.cd -= dt;
  t.flash = Math.max(0, t.flash - dt * 4);

  if (t.type === 'fire') {
    if (Math.random() < dt * 4) addP(t.x + rand(-6, 6), t.y - 34, rand(-6, 6), rand(-50, -25), 0.8, '#ffb040', 2, 0, true);
    if (t.cd > 0) return;
    let any = false;
    for (const e of S.enemies) {
      if (e.dead || !inRange(t, e, range + e.r)) continue;
      any = true;
      hurt(e, def.dmg[L], 'fire', t);
      applyBurn(e, def.burn[L], 2.5, t);
    }
    if (any) {
      t.cd = 1 / def.rate[L];
      t.flash = 1;
      ring(t.x, t.y - 4, range, '255,120,40', 0.45, 10, true);
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * TAU;
        addP(t.x, t.y - 6, Math.cos(a) * range * 2.1, Math.sin(a) * range * 1.6, 0.35, i % 2 ? '#ffb02a' : '#ff5a1a', 5, 0, true);
      }
    }
    return;
  }
  if (t.type === 'frost' && Math.random() < dt * 2) addP(t.x + rand(-10, 10), t.y - 30, rand(-5, 5), rand(5, 15), 1.2, 'rgba(220,245,255,0.8)', 1.6, 0, true);

  const target = findTarget(t, range);
  if (target) {
    const want = Math.atan2(target.y - t.y, target.x - t.x);
    let diff = want - t.angle;
    while (diff > Math.PI) diff -= TAU;
    while (diff < -Math.PI) diff += TAU;
    t.angle += diff * Math.min(1, dt * 14);
  }
  if (t.cd > 0 || !target) return;
  t.cd = 1 / def.rate[L];
  t.flash = 1;
  const dmg = def.dmg[L];

  switch (t.type) {
    case 'archer':
      S.projectiles.push({ kind: 'arrow', x: t.x, y: t.y - 44, target, tx: target.x, ty: target.y, speed: 640, dmg, src: t });
      break;
    case 'arcane':
      S.projectiles.push({ kind: 'arcane', x: t.x, y: t.y - 60, target, tx: target.x, ty: target.y, speed: 520, dmg, src: t });
      break;
    case 'frost':
      S.projectiles.push({ kind: 'frost', x: t.x, y: t.y - 42, target, tx: target.x, ty: target.y, speed: 420, dmg, src: t, slow: def.slow[L], radius: def.splash[L] * TILE });
      break;
    case 'cannon': {
      const sx = t.x + Math.cos(t.angle) * 26, sy = t.y - 24 + Math.sin(t.angle) * 26;
      const dist = Math.hypot(target.x - sx, target.y - sy);
      const time = dist / 360;
      const lead = posAt(S.path, target.d + target.speed * TILE * (target.slowT > 0 ? 1 - target.slowF : 1) * time);
      S.projectiles.push({ kind: 'ball', x: sx, y: sy, sx, sy, tx: lead.x, ty: lead.y, t: 0, dur: Math.max(0.15, time), dmg, src: t, radius: def.splash[L] * TILE });
      smoke(sx, sy, 5, 5);
      break;
    }
    case 'storm': {
      const hit = new Set([target]);
      const pts = [{ x: t.x, y: t.y - 50 }, { x: target.x, y: target.y - target.r }];
      let cur = target, d = dmg;
      hurt(cur, d, 'magic', t);
      for (let i = 1; i < def.chain[L]; i++) {
        let next = null, best = (1.9 * TILE) ** 2;
        for (const e of S.enemies) {
          if (e.dead || hit.has(e)) continue;
          const d2 = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
          if (d2 < best) { best = d2; next = e; }
        }
        if (!next) break;
        d *= 0.85;
        hurt(next, d, 'magic', t);
        hit.add(next);
        pts.push({ x: next.x, y: next.y - next.r });
        cur = next;
      }
      const main = jagged(pts, 8);
      const branches = [];
      for (let i = 0; i < 3; i++) {
        const p = main[Math.floor(Math.random() * main.length)];
        const a = Math.random() * TAU;
        branches.push(jagged([p, { x: p.x + Math.cos(a) * 18, y: p.y + Math.sin(a) * 18 }], 4));
      }
      S.effects.push({ type: 'bolt', pts: main, branches, hits: pts.slice(1), life: 0.24, max: 0.24 });
      break;
    }
  }
}
function jagged(pts, amp) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const n = 5;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      out.push({ x: a.x + (b.x - a.x) * t + rand(-amp, amp), y: a.y + (b.y - a.y) * t + rand(-amp, amp) });
    }
    out.push(b);
  }
  return out;
}

function updateProjectile(p, dt) {
  if (p.kind === 'ball') {
    p.t += dt;
    const k = Math.min(1, p.t / p.dur);
    p.x = p.sx + (p.tx - p.sx) * k;
    p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 44;
    if (Math.random() < 0.5) addP(p.x, p.y, rand(-5, 5), rand(-5, 5), 0.4, 'rgba(120,115,110,0.45)', 3, -10, false, 'smoke');
    if (k >= 1) {
      p.done = true;
      splash(p.tx, p.ty, p.radius, (e) => hurt(e, p.dmg, 'phys', p.src), false);
      ring(p.tx, p.ty, p.radius, '255,190,90', 0.35, 4, true);
      burst(p.tx, p.ty, '#ffb04a', 16, 1.8, true);
      burst(p.tx, p.ty, '#5a4a3a', 8, 1.2);
      smoke(p.tx, p.ty, 6, 8);
      addDecal(p.tx, p.ty, 16);
      S.shake = Math.max(S.shake, 0.08);
    }
    return;
  }
  if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y - p.target.r * 0.9 - enemyLift(p.target, S.time); }
  const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = p.speed * dt;
  p.ang = Math.atan2(dy, dx);
  if (p.kind === 'arcane' && Math.random() < 0.9) addP(p.x, p.y, rand(-15, 15), rand(-15, 15), 0.35, '#c99bff', 2.5, 0, true);
  if (p.kind === 'frost' && Math.random() < 0.6) addP(p.x, p.y, rand(-10, 10), rand(-10, 10), 0.3, '#dff6ff', 2, 0, true);
  if (dist <= step + 2) {
    p.done = true;
    const alive = p.target && !p.target.dead;
    if (p.kind === 'arrow') {
      if (alive) hurt(p.target, p.dmg, 'phys', p.src);
      burst(p.tx, p.ty, '#e8d8b0', 3, 0.8);
    } else if (p.kind === 'arcane') {
      if (alive) hurt(p.target, p.dmg, 'magic', p.src);
      burst(p.tx, p.ty, '#d8b0ff', 14, 1.4, true);
      ring(p.tx, p.ty, 20, '200,140,255', 0.3, 2, true);
    } else if (p.kind === 'frost') {
      splash(p.tx, p.ty, p.radius, (e) => {
        hurt(e, p.dmg, 'magic', p.src);
        let f = p.slow * (e.def.boss ? 0.5 : 1) * (1 - (e.def.slowRes || 0));
        if (f >= e.slowF || e.slowT <= 0) e.slowF = f;
        e.slowT = 1.6;
      });
      ring(p.tx, p.ty, p.radius, '150,220,255', 0.35, 4, true);
      burst(p.tx, p.ty, '#e8faff', 10, 1.2, true);
    }
    return;
  }
  p.x += (dx / dist) * step;
  p.y += (dy / dist) * step;
}

// ---------------------------------------------------------------- Gegner
function updateEnemy(e, dt) {
  e.hitFlash = Math.max(0, e.hitFlash - dt);
  e.immuneT -= dt;
  let f = 1;
  if (e.slowT > 0) { e.slowT -= dt; f = 1 - e.slowF; } else e.slowF = 0;
  if (e.enraged) f *= 1.9;

  // Spinne: Sprünge
  if (e.def.leap) {
    if (e.leapT > 0) {
      e.leapT -= dt;
      f *= 5;
      e.hop = Math.sin((1 - Math.max(0, e.leapT) / 0.35) * Math.PI) * 16;
      if (e.leapT <= 0) { e.hop = 0; smoke(e.x, e.y + 4, 3, 4); }
    } else if ((e.leapCd -= dt) <= 0) { e.leapT = 0.35; e.leapCd = rand(2.2, 3.4); }
  }
  e.d += e.speed * TILE * f * dt;

  // Schattenklinge: Teleport
  if (e.def.blink) {
    if (e.blinkFade != null) { e.blinkFade += dt * 3; if (e.blinkFade >= 0.92) e.blinkFade = null; }
    if ((e.blinkCd -= dt) <= 0 && e.d < S.path.len - 2 * TILE) {
      e.blinkCd = rand(2.5, 3.8);
      smoke(e.x, e.y - 8, 8, 6);
      for (let i = 0; i < 6; i++) addP(e.x, e.y - 10, rand(-30, 30), rand(-30, 10), 0.5, '#b070ff', 2.5, 0, true);
      e.d += 1.6 * TILE;
      placeEnemy(e);
      smoke(e.x, e.y - 8, 8, 6);
      e.blinkFade = 0;
    }
  }

  if (e.burnT > 0) {
    e.burnT -= dt;
    hurt(e, e.burnDps * dt, 'fire', e.burnSrc);
    if (Math.random() < dt * 10) addP(e.x + rand(-5, 5), e.y - e.r, rand(-8, 8), -45, 0.45, Math.random() < 0.5 ? '#ff8a2a' : '#ffd23a', 2.5, -20, true);
    if (e.burnT <= 0) e.burnDps = 0;
  }
  if (e.dead) return;

  if (e.def.enrage && !e.enraged && e.hp < e.maxHp * 0.5) {
    e.enraged = true;
    floatText(e.x, e.y - 50, 'Raserei!', '#ff5a3a');
    smoke(e.x, e.y - 20, 6, 6);
  }
  if (e.def.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
  if (e.def.healer) {
    e.healT += dt;
    if (e.healT > 2.5) {
      e.healT = 0;
      let healed = false;
      for (const o of S.enemies) {
        if (o.dead || o === e || o.hp >= o.maxHp) continue;
        if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > (1.7 * TILE) ** 2) continue;
        o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12);
        addP(o.x, o.y - o.r * 2, 0, -30, 0.6, '#8aff6a', 3, 0, true);
        healed = true;
      }
      if (healed) ring(e.x, e.y, 1.7 * TILE, '120,255,120', 0.5, 4, true);
    }
  }
  if (e.def.summon) {
    e.sumT += dt;
    if (e.sumT > e.def.summonCd) {
      e.sumT = 0;
      for (let i = 0; i < e.def.summonN; i++) {
        const s = spawnEnemy(e.def.summon, e.wave, Math.max(0, e.d - 22 - i * 14));
        s.off = rand(-9, 9);
        s.gold = Math.max(1, Math.round(s.gold * 0.4));
        placeEnemy(s);
        smoke(s.x, s.y, 4, 5);
      }
      const col = e.def.summon === 'imp' ? '255,90,40' : '120,255,140';
      ring(e.x, e.y, TILE, col, 0.5, 4, true);
    }
  }
  if (e.d >= S.path.len) {
    e.dead = true;
    const dmg = e.def.lives || 1;
    S.lives = Math.max(0, S.lives - dmg);
    S.shake = Math.min(0.6, S.shake + 0.2 + dmg * 0.03);
    S.hurtFlash = 0.4;
    floatText(W - 50, e.y - 20, `-${dmg} ❤️`, '#ff5a4a');
    burst(W - 20, e.y, '#ff6a4a', 10, 1.5, true);
    return;
  }
  placeEnemy(e);
  e.hpShown += (e.hp - e.hpShown) * Math.min(1, dt * 4);
}

function updateAuras() {
  for (const e of S.enemies) e.shielded = false;
  for (const k of S.enemies) {
    if (!k.def.aura || k.dead) continue;
    for (const o of S.enemies) {
      if (o === k || o.dead) continue;
      if ((o.x - k.x) ** 2 + (o.y - k.y) ** 2 <= (1.6 * TILE) ** 2) o.shielded = true;
    }
  }
}

// ---------------------------------------------------------------- Meteor
function castMeteor(x, y) {
  if (S.meteorCd > 0) return;
  S.meteorCd = METEOR_CD;
  S.spellMode = false;
  S.effects.push({ type: 'meteor', x, y, t: 0.6, max: 0.6, radius: METEOR_RADIUS, life: 1 });
  renderInfo();
}
function meteorImpact(m) {
  const dmg = 140 * hpMult(Math.max(1, S.wave)) / S.map.diff;
  splash(m.x, m.y, METEOR_RADIUS, (e) => { hurt(e, dmg, 'fire', null); applyBurn(e, dmg * 0.1, 3, null); });
  ring(m.x, m.y, METEOR_RADIUS, '255,140,40', 0.7, 10, true);
  ring(m.x, m.y, METEOR_RADIUS * 0.7, '255,230,120', 0.45, 5, true);
  burst(m.x, m.y, '#ff7a1a', 50, 3.2, true);
  burst(m.x, m.y, '#ffd23a', 30, 2.2, true);
  burst(m.x, m.y, '#3a2a20', 18, 1.6);
  smoke(m.x, m.y, 14, 12);
  addDecal(m.x, m.y, 55);
  S.shake = 0.5;
}

// ---------------------------------------------------------------- Wetter / Umgebung
function makeWeather(theme) {
  const n = { forest: 26, autumn: 30, winter: 110, lava: 50 }[theme];
  const list = [];
  for (let i = 0; i < n; i++) list.push({ x: Math.random() * W, y: Math.random() * H, p: Math.random() * 100, s: rand(0.6, 1.4) });
  return { list, fog: [0, 1, 2].map(() => ({ x: Math.random() * W, y: rand(0.1, 0.9) * H, s: rand(0.8, 1.4) })) };
}
function updateWeather(dt) {
  const th = S.map.theme;
  for (const w of S.weather.list) {
    w.p += dt;
    if (th === 'forest') { w.x += Math.sin(w.p * 0.7) * 12 * dt; w.y += Math.cos(w.p * 0.5) * 10 * dt; }
    else if (th === 'autumn') { w.x += (20 + Math.sin(w.p) * 20) * dt * w.s; w.y += 28 * dt * w.s; }
    else if (th === 'winter') { w.x += (Math.sin(w.p * 0.8) * 15 + 10) * dt; w.y += 34 * dt * w.s; }
    else { w.y -= 22 * dt * w.s; w.x += Math.sin(w.p) * 8 * dt; }
    if (w.y > H + 10) { w.y = -10; w.x = Math.random() * W; }
    if (w.y < -10) { w.y = H + 10; w.x = Math.random() * W; }
    if (w.x > W + 10) w.x = -10;
    if (w.x < -10) w.x = W + 10;
  }
  for (const f of S.weather.fog) { f.x += 8 * dt * f.s; if (f.x > W + 200) { f.x = -200; f.y = rand(0.1, 0.9) * H; } }
}
let fogSprite = null;
function drawWeather(time) {
  const th = S.map.theme;
  if ((th === 'forest' || th === 'winter') && isHigh()) {
    if (!fogSprite) {
      fogSprite = document.createElement('canvas'); fogSprite.width = 256; fogSprite.height = 128;
      const g = fogSprite.getContext('2d');
      const gr = g.createRadialGradient(128, 64, 0, 128, 64, 128);
      gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.setTransform(1, 0, 0, 0.5, 0, 32); g.fillRect(0, 0, 256, 256);
    }
    ctx.globalAlpha = th === 'winter' ? 0.25 : 0.12 + S.night * 0.1;
    for (const f of S.weather.fog) ctx.drawImage(fogSprite, f.x - 200 * f.s, f.y - 60 * f.s, 400 * f.s, 120 * f.s);
    ctx.globalAlpha = 1;
  }
  for (const w of S.weather.list) {
    if (th === 'forest') {
      const a = (0.25 + S.night * 0.75) * (0.5 + 0.5 * Math.sin(w.p * 3));
      glow(ctx, w.x, w.y, 6, '200,255,120', a);
      if (S.night > 0.3) lightPush(w.x, w.y, 14, '200,255,120', a * 0.6);
    } else if (th === 'autumn') {
      ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.p * 2);
      ell(ctx, 0, 0, 3 * w.s, 1.5 * w.s, ['#e07a2a', '#c94a2a', '#f2c14e'][Math.floor(w.s * 10) % 3]);
      ctx.restore();
    } else if (th === 'winter') {
      circ(ctx, w.x, w.y, 1.2 * w.s, 'rgba(255,255,255,0.9)');
    } else {
      glow(ctx, w.x, w.y, 3.5 * w.s, '255,120,30', 0.7);
    }
  }
}

// ---------------------------------------------------------------- Update
function update(dt) {
  S.time += dt;
  if (S.nextTimer > 0) { S.nextTimer -= dt; if (S.nextTimer <= 0) startWave(); }
  if (S.meteorCd > 0) S.meteorCd = Math.max(0, S.meteorCd - dt);
  S.night += ((isNightWave(S.wave) ? 1 : 0) - S.night) * Math.min(1, dt * 0.5);

  for (const sp of S.spawners) {
    sp.t -= dt;
    while (sp.t <= 0 && sp.queue.length) {
      const e = spawnEnemy(sp.queue.shift(), sp.wave);
      sp.t += sp.interval;
      for (let i = 0; i < 6; i++) addP(e.x + 10, e.y + rand(-15, 15), rand(10, 40), rand(-20, 20), 0.5, '#d8a0ff', 2.5, 0, true);
    }
  }
  S.spawners = S.spawners.filter((s) => s.queue.length);
  for (const tm of S.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
  S.timers = S.timers.filter((tm) => tm.t > 0);
  flushNewEnemies();

  updateAuras();
  for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
  flushNewEnemies();
  for (const t of S.towers) updateTower(t, dt);
  for (const p of S.projectiles) updateProjectile(p, dt);
  S.projectiles = S.projectiles.filter((p) => !p.done);

  for (const fx of S.effects) {
    if (fx.type === 'meteor') { fx.t -= dt; if (fx.t <= 0) { meteorImpact(fx); fx.life = 0; } }
    else fx.life -= dt;
  }
  S.effects = S.effects.filter((fx) => fx.life > 0);
  for (const d of S.decals) d.life -= dt;
  S.decals = S.decals.filter((d) => d.life > 0);
  for (const p of S.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt;
    const damp = p.kind === 'smoke' ? 0.98 : 0.95;
    p.vx *= damp; p.vy *= damp;
  }
  S.particles = S.particles.filter((p) => p.life > 0);
  for (const t of S.texts) { t.life -= dt; t.y -= 26 * dt; }
  S.texts = S.texts.filter((t) => t.life > 0);
  flushNewEnemies();
  S.enemies = S.enemies.filter((e) => !e.dead);
  if (S.selEnemy && S.selEnemy.dead) { S.selEnemy = null; renderInfo(); }

  // Burg raucht bei Schaden
  const dmg = 1 - S.lives / START_LIVES;
  if (dmg > 0.4 && Math.random() < dt * dmg * 6) {
    const end = S.path.pts[S.path.pts.length - 1];
    smoke(W - 14 + rand(-10, 10), end.y - 20 + rand(-25, 25), 1, 9);
  }

  S.shake = Math.max(0, S.shake - dt);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt);
  if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }
  if (S.intro) { S.intro.life -= dt; if (S.intro.life <= 0) S.intro = null; }
  if (!S.intro && S.intros.length) S.intro = { type: S.intros.shift(), life: 5, max: 5 };

  if (S.waveRunning && !S.spawners.length && !S.enemies.length && !S.timers.length) {
    S.waveRunning = false;
    const bonus = 15 + S.wave * 3;
    S.gold += bonus;
    S.score += S.wave * 50;
    floatText(W / 2, H / 2, `Welle ${S.wave} geschafft! +${bonus} 💰`, '#8fe07a', 1.8);
    if (S.auto) S.nextTimer = 8;
  }
  if (S.lives <= 0 && !S.over) gameOver();
}
function flushNewEnemies() {
  if (S.newEnemies.length) { S.enemies.push(...S.newEnemies); S.newEnemies.length = 0; }
}

// ================================================================ Rendering
const lights = [];
function lightPush(x, y, r, color, a) { lights.push(x, y, r, a, color); }
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');
let menuMap = 0;

function render(time) {
  ctx.setTransform(view.k, 0, 0, view.k, 0, 0);
  if (!S) {
    ctx.drawImage(PREPARED[menuMap].art.bg, 0, 0, W, H);
    for (const tr of PREPARED[menuMap].art.trees) drawTree(ctx, tr, MAPS[menuMap].theme, time);
    return;
  }
  lights.length = 0;
  setLightSink(isHigh() ? lightPush : null);
  const sx = S.shake > 0 ? rand(-1, 1) * S.shake * 12 : 0, sy = S.shake > 0 ? rand(-1, 1) * S.shake * 12 : 0;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.drawImage(S.art.bg, 0, 0, W, H);
  drawPools(ctx, S.art.pools, S.map.theme, time);
  for (const d of S.decals) drawEffect(ctx, d, time);
  if (S.buildType) drawGrid();

  const start = S.path.pts[0];
  drawPortal(ctx, 8, start.y, time);
  if (S.selected) drawSelection(S.selected, time);
  if (S.selEnemy) {
    const e = S.selEnemy;
    ctx.beginPath(); ctx.ellipse(e.x, e.y + e.r * 0.45, e.r * 1.3, e.r * 0.5, 0, 0, TAU);
    ctx.strokeStyle = 'rgba(255,90,70,0.9)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.lineDashOffset = -time * 20; ctx.stroke(); ctx.setLineDash([]);
  }

  // Bodenebene, nach y sortiert
  const list = [];
  for (const t of S.towers) list.push([t.y + 6, 0, t]);
  for (const e of S.enemies) if (!e.flying) list.push([e.y + e.r * 0.45, 1, e]);
  for (const tr of S.art.trees) list.push([tr.y, 2, tr]);
  for (const fx of S.effects) if (fx.type === 'death' && !fx.flying) list.push([fx.e.y, 3, fx]);
  const end = S.path.pts[S.path.pts.length - 1];
  list.push([end.y + 26, 4, null]);
  list.sort((a, b) => a[0] - b[0]);
  for (const [, k, o] of list) {
    if (k === 0) drawTower(ctx, o, time);
    else if (k === 1) drawEnemy(ctx, o, time);
    else if (k === 2) drawTree(ctx, o, S.map.theme, time);
    else if (k === 3) drawEffect(ctx, o, time);
    else drawCastle(ctx, W - 16, end.y, time, 1 - S.lives / START_LIVES);
  }
  for (const fx of S.effects) if (fx.type === 'death' && fx.flying) drawEffect(ctx, fx, time);
  for (const e of S.enemies) if (e.flying) drawEnemy(ctx, e, time);
  for (const p of S.projectiles) drawProjectile(ctx, p);
  for (const fx of S.effects) if (fx.type !== 'death') drawEffect(ctx, fx, time);

  // Partikel
  for (const p of S.particles) {
    if (p.add) continue;
    const a = clamp(p.life / p.max, 0, 1);
    if (p.kind === 'smoke') {
      ctx.globalAlpha = a * 0.8;
      circ(ctx, p.x, p.y, p.size * (1.8 - a), p.color);
    } else {
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of S.particles) {
    if (!p.add) continue;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6 + 0.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (isHigh() || S.map.theme === 'winter') drawWeather(time);
  ctx.restore();

  composeLighting(sx, sy);
  setLightSink(null);

  // ---- Oberfläche über dem Licht
  if (S.buildType && S.ghost) {
    const { c, r } = S.ghost;
    const ok = canBuild(c, r) && S.gold >= TOWERS[S.buildType].cost;
    const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
    ctx.fillStyle = ok ? 'rgba(120,255,120,0.2)' : 'rgba(255,80,80,0.28)';
    ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
    drawRange(x, y, TOWERS[S.buildType].range[0] * TILE, ok);
    ctx.globalAlpha = 0.7;
    drawTower(ctx, { type: S.buildType, def: TOWERS[S.buildType], x, y, level: 1, angle: -Math.PI / 2, flash: 0 }, time);
    ctx.globalAlpha = 1;
  }
  if (S.spellMode && S.hover) {
    ctx.beginPath(); ctx.arc(S.hover.x, S.hover.y, METEOR_RADIUS, 0, TAU);
    ctx.fillStyle = 'rgba(255,120,40,0.15)'; ctx.fill();
    ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,160,60,0.9)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const t of S.texts) {
    ctx.globalAlpha = clamp(t.life * 1.6, 0, 1);
    ctx.font = 'bold 15px Georgia, serif';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  drawBossBar();
  drawIntro(time);
  drawBanner();
  if (S.nextTimer > 0 && !S.waveRunning) {
    ctx.font = 'bold 17px Georgia, serif'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.roundRect(W / 2 - 120, 8, 240, 30, 15); ctx.fill();
    ctx.fillStyle = '#f3e9d8';
    ctx.fillText(`Nächste Welle in ${Math.ceil(S.nextTimer)} s`, W / 2, 24);
  }
  if (S.hurtFlash > 0) {
    const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)');
    g.addColorStop(1, `rgba(255,0,0,${S.hurtFlash * 0.9})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }
}

function composeLighting(sx, sy) {
  const L = S.map.light;
  const amb = L.day + (L.night - L.day) * S.night;
  if (amb <= 0.01) return;
  if (!isHigh()) {
    ctx.fillStyle = `rgba(${L.color},${amb * 0.6})`;
    ctx.fillRect(0, 0, W, H);
    return;
  }
  if (lightCv.width !== canvas.width || lightCv.height !== canvas.height) { lightCv.width = canvas.width; lightCv.height = canvas.height; }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(${L.color},${amb})`;
  lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.setTransform(view.k, 0, 0, view.k, sx * view.k, sy * view.k);
  lctx.globalCompositeOperation = 'destination-out';
  const white = glowSprite('255,255,255');
  for (let i = 0; i < lights.length; i += 5) {
    const x = lights[i], y = lights[i + 1], r = lights[i + 2] * 1.3, a = lights[i + 3];
    lctx.globalAlpha = Math.min(1, a);
    lctx.drawImage(white, x - r, y - r, r * 2, r * 2);
  }
  lctx.globalAlpha = 1;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lightCv, 0, 0);
  ctx.restore();
  // farbiger Schein der Lichtquellen
  ctx.save();
  ctx.translate(sx, sy);
  const k = amb * 0.55;
  for (let i = 0; i < lights.length; i += 5) glow(ctx, lights[i], lights[i + 1], lights[i + 2] * 0.8, lights[i + 4], lights[i + 3] * k);
  ctx.restore();
}

function drawGrid() {
  ctx.lineWidth = 1;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!canBuild(c, r)) continue;
      ctx.strokeStyle = 'rgba(255,255,255,0.13)';
      ctx.strokeRect(c * TILE + 2.5, r * TILE + 2.5, TILE - 5, TILE - 5);
    }
  }
}
function drawRange(x, y, r, ok) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = ok ? 'rgba(255,255,255,0.09)' : 'rgba(255,60,60,0.1)';
  ctx.fill();
  ctx.setLineDash([6, 5]);
  ctx.strokeStyle = ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,90,90,0.7)';
  ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
}
function drawSelection(t, time) {
  drawRange(t.x, t.y, t.def.range[t.level - 1] * TILE, true);
  ctx.beginPath(); ctx.ellipse(t.x, t.y + 6, 24, 11, 0, 0, TAU);
  ctx.strokeStyle = 'rgba(242,193,78,0.95)'; ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]); ctx.lineDashOffset = -time * 25; ctx.stroke(); ctx.setLineDash([]);
}

function drawBossBar() {
  const boss = S.enemies.find((e) => e.def.boss && !e.dead);
  if (!boss) return;
  const bw = 380, bx = W / 2 - bw / 2, by = H - 28;
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.beginPath(); ctx.roundRect(bx - 6, by - 20, bw + 12, 36, 8); ctx.fill();
  ctx.strokeStyle = '#7a5a3a'; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.fillStyle = '#3a0e0e'; ctx.fillRect(bx, by, bw, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(bx, by, bw * clamp(boss.hpShown / boss.maxHp, 0, 1), 10);
  const gr = ctx.createLinearGradient(0, by, 0, by + 10);
  gr.addColorStop(0, '#ff6a4a'); gr.addColorStop(1, '#a01a10');
  ctx.fillStyle = gr; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 10);
  ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2c14e';
  ctx.fillText(`👑 ${boss.def.name}`, W / 2, by - 9);
}

function drawBanner() {
  const b = S.banner;
  if (!b) return;
  const a = clamp(Math.min(b.life, b.max - b.life) * 3, 0, 1);
  ctx.globalAlpha = a;
  const y = H * 0.28;
  const gr = ctx.createLinearGradient(0, y - 40, 0, y + 40);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, y - 40, W, 80);
  ctx.font = `bold ${b.boss ? 40 : 34}px Georgia, serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.75)';
  ctx.strokeText(b.text, W / 2, y - 6);
  const tg = ctx.createLinearGradient(0, y - 26, 0, y + 10);
  if (b.boss) { tg.addColorStop(0, '#ffb09a'); tg.addColorStop(1, '#e0301a'); }
  else { tg.addColorStop(0, '#fff2b0'); tg.addColorStop(1, '#d89a2a'); }
  ctx.fillStyle = tg;
  ctx.fillText(b.text, W / 2, y - 6);
  if (b.sub) {
    ctx.font = 'italic 17px Georgia, serif';
    ctx.lineWidth = 4; ctx.strokeText(b.sub, W / 2, y + 24);
    ctx.fillStyle = '#e8dcc8'; ctx.fillText(b.sub, W / 2, y + 24);
  }
  ctx.globalAlpha = 1;
}

const portraitCache = new Map();
function portrait(type, size) {
  const key = type + size;
  let c = portraitCache.get(key);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = size;
    drawPortrait(c, type, ENEMIES[type], 0.4);
    portraitCache.set(key, c);
  }
  return c;
}
function wrapText(text, maxW) {
  const words = text.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawIntro() {
  const it = S.intro;
  if (!it) return;
  const def = ENEMIES[it.type];
  const k = clamp(Math.min(it.max - it.life, it.life) * 4, 0, 1);
  const w = 270, h = 86;
  // Ecke wählen, die am weitesten von Portal und Burg entfernt ist
  if (!S.introCorner) {
    const py = S.path.pts[0].y, cy = S.path.pts[S.path.pts.length - 1].y;
    let best = -1;
    for (const [cx, cyy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const mx = cx ? W - w / 2 : w / 2, my = cyy ? H - h / 2 : h / 2 + 40;
      const dist = Math.min(Math.hypot(mx, my - py), Math.hypot(W - mx, my - cy));
      if (dist > best) { best = dist; S.introCorner = [cx, cyy]; }
    }
  }
  const [cx, cyy] = S.introCorner;
  const slide = (1 - k) * (w + 20) * (cx ? 1 : -1);
  const x = (cx ? W - w - 10 : 10) + slide, y = cyy ? H - h - 12 : 46;
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(25,16,10,0.9)';
  ctx.beginPath(); ctx.roundRect(x, y, w, h, 10); ctx.fill();
  ctx.strokeStyle = def.boss ? '#e0301a' : '#c8963a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.drawImage(portrait(it.type, 128), x + 6, y + 6, 74, 74);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 11px Georgia, serif'; ctx.fillStyle = '#ff9a6a';
  ctx.fillText(def.boss ? 'BOSS' : 'NEUER GEGNER', x + 88, y + 8);
  ctx.font = 'bold 16px Georgia, serif'; ctx.fillStyle = '#f2c14e';
  ctx.fillText(def.name, x + 88, y + 21);
  ctx.font = '12px Georgia, serif'; ctx.fillStyle = '#e8dcc8';
  wrapText(def.desc, w - 96).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, x + 88, y + 42 + i * 14));
  ctx.globalAlpha = 1;
}

// ================================================================ UI
const towerBtns = {};
function buildTowerList() {
  const el = $('towerList');
  TOWER_KEYS.forEach((k, i) => {
    const d = TOWERS[k];
    const b = document.createElement('button');
    b.className = 'tbtn';
    b.title = `${d.name} (${i + 1})`;
    b.innerHTML = `<span class="key">${i + 1}</span><span class="ic">${d.icon}</span><span class="nm">${d.name}</span><span class="cs">${d.cost}</span>`;
    b.addEventListener('click', () => chooseBuild(k));
    el.appendChild(b);
    towerBtns[k] = b;
  });
}
function chooseBuild(k) {
  if (!S || S.over) return;
  S.spellMode = false; S.selected = null; S.selEnemy = null; S.ghost = null;
  S.buildType = S.buildType === k ? null : k;
  renderInfo();
}

function statRows(def, L, next) {
  const rows = [
    ['Schaden', def.dmg[L], next && def.dmg[L + 1]],
    ['Reichweite', def.range[L], next && def.range[L + 1]],
    ['Tempo', def.rate[L] + '/s', next && def.rate[L + 1] + '/s'],
  ];
  if (def.splash) rows.push(['Fläche', def.splash[L], next && def.splash[L + 1]]);
  if (def.slow) rows.push(['Verlangsamung', Math.round(def.slow[L] * 100) + '%', next && Math.round(def.slow[L + 1] * 100) + '%']);
  if (def.chain) rows.push(['Ziele', def.chain[L], next && def.chain[L + 1]]);
  if (def.burn) rows.push(['Brand', def.burn[L] + '/s', next && def.burn[L + 1] + '/s']);
  return '<table>' + rows.map(([n, v, nv]) => `<tr><td>${n}</td><td>${v}${nv !== undefined && nv !== false ? ` <span class="up">→ ${nv}</span>` : ''}</td></tr>`).join('') + '</table>';
}

function renderInfo() {
  const el = $('info');
  if (!S) { el.innerHTML = ''; return; }
  if (S.selected) {
    const t = S.selected, d = t.def, L = t.level - 1, maxed = t.level >= MAX_LEVEL;
    el.innerHTML = `
      <h3>${d.icon} ${d.name} <small>Stufe ${t.level}${maxed ? ' (max)' : ''}</small></h3>
      ${statRows(d, L, !maxed)}
      <div class="row">
        <button class="btn good" data-act="upgrade" ${maxed ? 'disabled' : ''}>${maxed ? 'Maximal' : `⬆ ${upgradeCost(t)} 💰`}</button>
        <button class="btn danger" data-act="sell">Verkaufen +${sellValue(t)}</button>
      </div>
      ${t.type !== 'fire' ? `<div class="row"><button class="btn" data-act="target">🎯 Ziel: ${TARGET_LABEL[t.mode]}</button></div>` : ''}
      <p class="hint" data-kills>Besiegt: ${t.kills}${d.air ? '' : ' · trifft keine Flieger'}</p>`;
  } else if (S.selEnemy) {
    const e = S.selEnemy, d = e.def;
    el.innerHTML = `
      <div class="enemyhead"><canvas width="96" height="96"></canvas><div><h3>${d.name}</h3>
      <p class="hp" data-hp></p></div></div>
      <p>${d.desc}</p>
      <p class="traits">${traitsOf(d).map((t) => `<span>${t}</span>`).join('') || '<span>keine Besonderheiten</span>'}</p>`;
    el.querySelector('canvas').getContext('2d').drawImage(portrait(e.type, 128), 0, 0, 96, 96);
  } else if (S.buildType) {
    const d = TOWERS[S.buildType];
    el.innerHTML = `
      <h3>${d.icon} ${d.name} <small>${d.cost} 💰</small></h3>
      <p>${d.desc}</p>
      ${statRows(d, 0, false)}
      <p class="hint">Tippe auf ein freies Feld, um dort zu bauen.</p>`;
  } else if (S.spellMode) {
    el.innerHTML = `<h3>☄️ Meteor</h3><p>Tippe auf die Karte, um einen Meteor einschlagen zu lassen. Er trifft alle Gegner im Umkreis – auch Flieger.</p>`;
  } else {
    el.innerHTML = `
      <h3>🛡️ Runenwacht</h3>
      <p>Wähle einen Turm und baue ihn neben den Weg. Tippe auf einen Turm, um ihn zu verbessern – oder auf ein Monster, um mehr darüber zu erfahren.</p>
      <p class="hint">Tasten: <kbd>1</kbd>–<kbd>6</kbd> Türme, <kbd>U</kbd> verbessern, <kbd>S</kbd> verkaufen,
      <kbd>T</kbd> Ziel, <kbd>M</kbd> Meteor, <kbd>N</kbd> Welle, <kbd>F</kbd> Tempo, <kbd>Leertaste</kbd> Pause</p>`;
  }
  syncHud(true);
}

$('info').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b || !S) return;
  if (b.dataset.act === 'upgrade') upgradeSelected();
  else if (b.dataset.act === 'sell') sellSelected();
  else if (b.dataset.act === 'target') cycleTarget();
});

function renderNextWave() {
  const el = $('nextWave');
  if (!S || !S.upcoming) { el.innerHTML = ''; return; }
  const counts = new Map();
  for (const k of S.upcoming.list) counts.set(k, (counts.get(k) || 0) + 1);
  el.innerHTML = `<div class="nwtitle">Nächste Welle ${S.upcoming.wave}${S.upcoming.boss ? ' 👑' : ''}</div><div class="nwicons"></div>`;
  const box = el.querySelector('.nwicons');
  for (const [k, n] of counts) {
    const d = document.createElement('div');
    d.className = 'nwi' + (ENEMIES[k].boss ? ' boss' : '');
    d.title = ENEMIES[k].name;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    c.getContext('2d').drawImage(portrait(k, 128), 0, 0, 64, 64);
    d.appendChild(c);
    const s = document.createElement('span');
    s.textContent = `${n}`;
    d.appendChild(s);
    box.appendChild(d);
  }
}

const cache = {};
function setText(id, v) { if (cache[id] !== v) { cache[id] = v; $(id).textContent = v; } }
function setFlag(el, key, cls, on) {
  const ck = key + cls;
  if (cache[ck] !== on) { cache[ck] = on; el.classList.toggle(cls, on); }
}
function syncHud(force) {
  if (!S) return;
  if (force) for (const k in cache) delete cache[k];
  setText('lives', String(S.lives));
  setText('gold', fmt(S.gold));
  setText('wave', String(S.wave));
  setText('score', fmt(S.score));
  setFlag($('lives').parentElement, 'lives', 'hurt', S.lives <= 5);

  let label, disabled = false;
  if (S.spawners.length) { label = '⚔ Welle läuft'; disabled = true; }
  else if (S.waveRunning) label = `⏩ Früh rufen +${10 + S.wave * 2}💰`;
  else if (S.nextTimer > 0) label = `▶ Welle ${S.wave + 1} (${Math.ceil(S.nextTimer)})`;
  else label = `▶ Welle ${S.wave + 1} starten`;
  setText('btnWave', label);
  if (cache.wbd !== disabled) { cache.wbd = disabled; $('btnWave').disabled = disabled; }

  setText('btnSpeed', `${S.speed}×`);
  setText('btnAuto', S.auto ? 'Auto ✓' : 'Auto ✗');
  setFlag($('btnAuto'), 'auto', 'off', !S.auto);
  setText('btnPause', S.paused ? '▶' : '⏸');
  for (const k of TOWER_KEYS) {
    setFlag(towerBtns[k], k, 'poor', S.gold < TOWERS[k].cost);
    setFlag(towerBtns[k], k, 'sel', S.buildType === k);
  }
  const mb = $('btnMeteor');
  const cdText = S.meteorCd > 0 ? `Meteor (${Math.ceil(S.meteorCd)} s)` : 'Meteor';
  if (cache.meteor !== cdText) { cache.meteor = cdText; mb.querySelector('span').textContent = cdText; }
  if (cache.mbd !== S.meteorCd > 0) { cache.mbd = S.meteorCd > 0; mb.disabled = S.meteorCd > 0; }
  setFlag(mb, 'meteor', 'active', S.spellMode);

  if (S.selected) {
    const ub = $('info').querySelector('[data-act="upgrade"]');
    if (ub && S.selected.level < MAX_LEVEL) {
      const poor = S.gold < upgradeCost(S.selected);
      if (cache.ubPoor !== poor) { cache.ubPoor = poor; ub.style.opacity = poor ? 0.5 : 1; }
    }
    const hint = $('info').querySelector('[data-kills]');
    const tk = `Besiegt: ${S.selected.kills}${S.selected.def.air ? '' : ' · trifft keine Flieger'}`;
    if (hint && cache.kills !== tk) { cache.kills = tk; hint.textContent = tk; }
  } else if (S.selEnemy) {
    const hp = $('info').querySelector('[data-hp]');
    const v = `❤ ${fmt(Math.max(0, S.selEnemy.hp))} / ${fmt(S.selEnemy.maxHp)}`;
    if (hp && cache.ehp !== v) { cache.ehp = v; hp.textContent = v; }
  }
}

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1600);
}

// ---------------------------------------------------------------- Buttons
$('btnWave').addEventListener('click', () => startWave());
$('btnSpeed').addEventListener('click', () => { if (S) { S.speed = (S.speed % 3) + 1; syncHud(); } });
$('btnAuto').addEventListener('click', () => {
  if (!S) return;
  S.auto = !S.auto;
  if (!S.auto) S.nextTimer = -1;
  else if (!S.waveRunning && S.wave > 0) S.nextTimer = 8;
  syncHud();
});
$('btnPause').addEventListener('click', () => togglePause());
$('btnMeteor').addEventListener('click', () => {
  if (!S || S.meteorCd > 0) return;
  S.spellMode = !S.spellMode;
  S.buildType = null; S.selected = null; S.selEnemy = null; S.ghost = null;
  renderInfo();
});
function togglePause(force) {
  if (!S || S.over) return;
  S.paused = force !== undefined ? force : !S.paused;
  if (S.paused) showPause(); else hideOverlay();
  syncHud();
}

// ---------------------------------------------------------------- Eingabe
function toWorld(ev) {
  const rect = canvas.getBoundingClientRect();
  return { x: ((ev.clientX - rect.left) / rect.width) * W, y: ((ev.clientY - rect.top) / rect.height) * H };
}
function enemyAt(p) {
  let best = null, bd = 26 * 26;
  for (const e of S.enemies) {
    if (e.dead) continue;
    const ey = e.y - e.r * 0.5 - enemyLift(e, S.time);
    const d2 = (e.x - p.x) ** 2 + (ey - p.y) ** 2;
    if (d2 < bd) { bd = d2; best = e; }
  }
  return best;
}
canvas.addEventListener('pointermove', (ev) => {
  if (!S || ev.pointerType !== 'mouse') return;
  const p = toWorld(ev);
  S.hover = p;
  if (S.buildType) S.ghost = { c: Math.floor(p.x / TILE), r: Math.floor(p.y / TILE) };
});
canvas.addEventListener('pointerleave', (ev) => {
  if (!S || ev.pointerType !== 'mouse') return;
  S.hover = null;
  if (S.buildType) S.ghost = null;
});
canvas.addEventListener('pointerdown', (ev) => {
  if (!S || S.over || S.paused) return;
  ev.preventDefault();
  const p = toWorld(ev);
  S.hover = p;
  const c = Math.floor(p.x / TILE), r = Math.floor(p.y / TILE);
  if (S.spellMode) { castMeteor(p.x, p.y); return; }
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return;
  const tw = S.grid[r * COLS + c];

  if (S.buildType) {
    if (tw) { S.buildType = null; S.ghost = null; S.selected = tw; renderInfo(); return; }
    if (!canBuild(c, r)) { toast('Hier kann nicht gebaut werden'); S.ghost = { c, r }; return; }
    const confirmed = ev.pointerType === 'mouse' || (S.ghost && S.ghost.c === c && S.ghost.r === r);
    if (!confirmed) { S.ghost = { c, r }; toast('Nochmal tippen zum Bauen'); return; }
    if (build(c, r)) {
      if (!(ev.shiftKey && S.gold >= TOWERS[S.buildType].cost)) { S.buildType = null; S.ghost = null; }
      renderInfo();
    }
    return;
  }
  const en = tw ? null : enemyAt(p);
  S.selEnemy = en && en !== S.selEnemy ? en : null;
  S.selected = tw && tw !== S.selected ? tw : null;
  renderInfo();
});

window.addEventListener('keydown', (ev) => {
  if (!S || S.over) return;
  const k = ev.key.toLowerCase();
  if (k >= '1' && k <= '6') chooseBuild(TOWER_KEYS[+k - 1]);
  else if (k === ' ') { ev.preventDefault(); togglePause(); }
  else if (S.paused) return;
  else if (k === 'escape') { S.buildType = null; S.selected = null; S.selEnemy = null; S.spellMode = false; S.ghost = null; renderInfo(); }
  else if (k === 'u') upgradeSelected();
  else if (k === 's') sellSelected();
  else if (k === 't') cycleTarget();
  else if (k === 'm') $('btnMeteor').click();
  else if (k === 'n' || k === 'enter') startWave();
  else if (k === 'f') $('btnSpeed').click();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over && !S.paused) togglePause(true); });

// ---------------------------------------------------------------- Overlays
const overlay = $('overlay');
let overlayAnim = 0;
function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; cancelAnimationFrame(overlayAnim); }

function qualityButton() {
  return `<button class="btn" data-quality>🎨 Grafik: ${isHigh() ? 'Hoch' : 'Schnell'}</button>`;
}
function bindQuality(onChange) {
  const b = overlay.querySelector('[data-quality]');
  if (!b) return;
  b.onclick = () => {
    settings.quality = isHigh() ? 'low' : 'high';
    saveJSON(SETTINGS_KEY, settings);
    setFlat(!isHigh());
    resize();
    b.textContent = `🎨 Grafik: ${isHigh() ? 'Hoch' : 'Schnell'}`;
    if (onChange) onChange();
  };
}

function showMenu() {
  if (S) S.over = true;
  const best = loadJSON(STORE_KEY, {});
  overlay.innerHTML = `
    <div class="card">
      <h1>⚔️ Runenwacht ⚔️</h1>
      <p class="sub">Endloser Fantasy Tower Defense – wie lange hält deine Burg stand?</p>
      <div class="maps">
        ${MAPS.map((m, i) => `
          <button class="mapcard" data-map="${i}">
            <canvas width="320" height="192"></canvas>
            <div class="t">${m.name}<span class="diff">${'💀'.repeat(i + 1)}</span></div>
            <div class="d">${m.desc}</div>
            <div class="b">🏆 Rekord: ${best[m.id] ? `Welle ${best[m.id].wave} · ${fmt(best[m.id].score)} Punkte` : '–'}</div>
          </button>`).join('')}
      </div>
      <div class="buttons">
        <button class="btn" id="ovBestiary">📖 Bestiarium</button>
        ${qualityButton()}
      </div>
      <details class="help">
        <summary>📜 Wie wird gespielt?</summary>
        <ul>
          <li>Monster kommen aus dem Portal und wollen zu deiner Burg. Jedes Monster, das durchkommt, kostet Leben.</li>
          <li>Baue Türme neben den Weg (Turm wählen → Feld antippen; auf dem Tablet zum Bestätigen nochmal tippen). Auf Bäumen, Felsen und Teichen kann nicht gebaut werden.</li>
          <li>Tippe auf einen Turm, um ihn zu verbessern (bis Stufe 4), zu verkaufen oder sein Ziel zu ändern. Tippe auf ein Monster, um seine Stärken und Schwächen zu sehen.</li>
          <li>Alle 5 Wellen kommt ein Schwarm, alle 10 Wellen ein Boss – und jede Bosswelle findet in der Nacht statt.</li>
          <li>Achte auf Resistenzen: Geister und Golems halten Pfeilen stand, Feuerwesen sind immun gegen Feuer, Baumhirten brennen besonders gut.</li>
          <li>Rufe Wellen früh, um Bonusgold zu bekommen. ☄️ Der Meteor hilft in Notlagen.</li>
        </ul>
      </details>
    </div>`;
  overlay.querySelectorAll('.mapcard').forEach((b) => {
    const i = +b.dataset.map;
    const cv = b.querySelector('canvas');
    const g = cv.getContext('2d');
    g.drawImage(PREPARED[i].art.bg, 0, 0, cv.width, cv.height);
    g.save(); g.scale(cv.width / W, cv.height / H);
    for (const tr of PREPARED[i].art.trees) drawTree(g, tr, MAPS[i].theme, 0);
    g.restore();
    b.addEventListener('click', () => newGame(i));
    b.addEventListener('pointerenter', () => { menuMap = i; });
  });
  $('ovBestiary').onclick = () => showBestiary(showMenu);
  bindQuality();
  overlay.classList.add('show');
}

function showBestiary(back) {
  cancelAnimationFrame(overlayAnim);
  const keys = Object.keys(ENEMIES);
  overlay.innerHTML = `
    <div class="card wide">
      <h2>📖 Bestiarium</h2>
      <div class="bestiary">
        ${keys.map((k) => {
          const d = ENEMIES[k];
          const when = d.boss ? `Boss ab Welle ${(BOSS_ORDER.indexOf(k) + 1) * 10}` : d.unlock ? `ab Welle ${d.unlock}` : k === 'slimelet' ? 'entsteht aus Schleimen' : 'entsteht aus der Hydra';
          return `<div class="beast${d.boss ? ' boss' : ''}">
            <canvas width="120" height="120" data-k="${k}"></canvas>
            <div class="bt"><b>${d.name}</b><small>${when}</small>
            <p>${d.desc}</p>
            <div class="traits"><span>❤ ${d.hp}</span><span>👟 ${d.speed}</span>${traitsOf(d).map((t) => `<span>${t}</span>`).join('')}</div></div>
          </div>`;
        }).join('')}
      </div>
      <div class="buttons"><button class="btn primary" id="ovBack">← Zurück</button></div>
    </div>`;
  const cvs = [...overlay.querySelectorAll('canvas[data-k]')];
  const t0 = performance.now();
  const anim = () => {
    const t = (performance.now() - t0) / 1000;
    for (const c of cvs) drawPortrait(c, c.dataset.k, ENEMIES[c.dataset.k], t);
    overlayAnim = requestAnimationFrame(anim);
  };
  anim();
  $('ovBack').onclick = () => { cancelAnimationFrame(overlayAnim); back(); };
  overlay.classList.add('show');
  overlay.scrollTop = 0;
}

function showPause() {
  overlay.innerHTML = `
    <div class="card" style="max-width:460px">
      <h2>⏸ Pausiert</h2>
      <p class="big">Welle <b>${S.wave}</b> · ⭐ <b>${fmt(S.score)}</b></p>
      <div class="buttons">
        <button class="btn primary" id="ovResume">▶ Weiter</button>
        <button class="btn" id="ovBestiary">📖 Bestiarium</button>
        ${qualityButton()}
        <button class="btn danger" id="ovQuit">🏳 Aufgeben</button>
      </div>
    </div>`;
  $('ovResume').onclick = () => togglePause(false);
  $('ovBestiary').onclick = () => showBestiary(showPause);
  $('ovQuit').onclick = () => { S.paused = false; gameOver(true); };
  bindQuality();
  overlay.classList.add('show');
}

function gameOver(gaveUp) {
  S.over = true;
  const best = loadJSON(STORE_KEY, {});
  const prev = best[S.map.id];
  const isRecord = !prev || S.wave > prev.wave || (S.wave === prev.wave && S.score > prev.score);
  if (isRecord && S.wave > 0) { best[S.map.id] = { wave: S.wave, score: S.score }; saveJSON(STORE_KEY, best); }
  overlay.innerHTML = `
    <div class="card" style="max-width:460px">
      <h2>${gaveUp ? '🏳 Rückzug!' : '🔥 Die Burg ist gefallen!'}</h2>
      <p class="sub">${S.map.name}</p>
      <p class="big">Erreichte Welle: <b>${S.wave}</b></p>
      <p class="big">Punkte: <b>${fmt(S.score)}</b></p>
      ${isRecord && S.wave > 0 ? '<p class="record">🏆 Neuer Rekord!</p>' : prev ? `<p class="sub">Rekord: Welle ${prev.wave} · ${fmt(prev.score)}</p>` : ''}
      <div class="buttons">
        <button class="btn primary" id="ovAgain">↻ Nochmal</button>
        <button class="btn" id="ovMenu">🗺 Kartenwahl</button>
      </div>
    </div>`;
  $('ovAgain').onclick = () => newGame(S.mapIdx);
  $('ovMenu').onclick = showMenu;
  overlay.classList.add('show');
}

// ---------------------------------------------------------------- Größe & Hauptschleife
function resize() {
  const st = $('stage');
  const cw = st.clientWidth - 10, ch = st.clientHeight - 10;
  const k = Math.max(0.1, Math.min(cw / W, ch / H));
  const dpr = isHigh() ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  const cssW = Math.floor(W * k), cssH = Math.floor(H * k);
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
  canvas.width = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  view.k = (cssW / W) * dpr;
  view.dpr = dpr;
}
new ResizeObserver(resize).observe($('stage'));
window.addEventListener('resize', resize);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S && !S.paused && !S.over) {
    for (let i = 0; i < S.speed && !S.over; i++) update(dt);
    updateWeather(dt);
    syncHud();
  }
  render(now / 1000);
  requestAnimationFrame(frame);
}

buildTowerList();
resize();
showMenu();
requestAnimationFrame(frame);

// Für Tests in der Konsole
window.__runenwacht = { get state() { return S; }, startWave, spawnEnemy, newGame, render, update };
