// Kristallwacht – Spiellogik, Layout (hoch/quer), Eingabe & Oberfläche
import { COLS, LANES, MAX_LEVEL, LEVEL_DMG, LEVEL_HP, DEFENDERS, DEF_KEYS, MONSTERS, BOSS_ORDER, monsterTraits } from './data.js';
import { TAU, drawEnemy, enemyLift, drawPortrait, glow, glowSprite, setLightSink, setFlat, circ, ell, poly } from './monsters.js';
import { renderBoard, drawTorch, drawOrb, drawGuardian, drawDefender, drawArmor, drawDefenderIcon } from './art.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const START_MANA = 150, HEARTS = 3, PREP_TIME = 20, BREAK_TIME = 10;
const BEST_KEY = 'kristallwacht-best-v1', SETTINGS_KEY = 'kristallwacht-settings-v1';
function loadJSON(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } }
function saveJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } }
const settings = Object.assign({ quality: 'high', autoCollect: false }, loadJSON(SETTINGS_KEY, {}));
const isHigh = () => settings.quality === 'high';
setFlat(!isHigh());
function fmt(n) { n = Math.floor(n); return n >= 1e4 ? (n / 1e3).toFixed(1) + 'k' : String(n); }

// ================================================================ Layout (hoch- oder querformat)
// Logische Koordinaten: x = Position entlang der Reihe (0 = Burgmauer, 9 = Waldrand), l = Reihe 0..4
const CASTLE = 1.2, SPAWN = 1.4, SIDE = 0.4;
let L = null, board = null, dpr = 1;

function computeLayout(w, h) {
  const portrait = h > w * 1.05;
  const along = CASTLE + COLS + SPAWN, across = LANES + 2 * SIDE;
  let cs, ox, oy, pt;
  if (!portrait) {
    cs = Math.min(w / along, h / across);
    ox = (w - cs * along) / 2; oy = (h - cs * across) / 2;
    pt = (x, l) => ({ x: ox + (CASTLE + x) * cs, y: oy + (SIDE + l + 0.5) * cs });
  } else {
    cs = Math.min(w / across, h / along);
    ox = (w - cs * across) / 2; oy = (h - cs * along) / 2;
    pt = (x, l) => ({ x: ox + (SIDE + l + 0.5) * cs, y: oy + (SPAWN + COLS - x) * cs });
  }
  const toCell = (X, Y) => {
    const x = portrait ? SPAWN + COLS - (Y - oy) / cs : (X - ox) / cs - CASTLE;
    const lf = portrait ? (X - ox) / cs - SIDE : (Y - oy) / cs - SIDE;
    return { x, c: Math.floor(x), l: Math.floor(lf) };
  };
  return { portrait, cs, ox, oy, w, h, pt, toCell, dir: portrait ? -Math.PI / 2 : 0 };
}

function resize() {
  const st = $('stage');
  const w = st.clientWidth, h = st.clientHeight;
  if (!w || !h) return;
  dpr = isHigh() ? Math.min(window.devicePixelRatio || 1, 2) : 1;
  canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
  canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
  L = computeLayout(w, h);
  board = renderBoard(L, dpr);
  closePopup();
}

// ================================================================ Zustand
let S = null;

function newGame() {
  S = {
    mana: START_MANA, hearts: HEARTS, wave: 0, score: 0, kills: 0,
    grid: Array.from({ length: LANES }, () => new Array(COLS).fill(null)),
    defenders: [], monsters: [], newMonsters: [], projectiles: [], orbs: [], effects: [], particles: [], texts: [], timers: [],
    guards: Array.from({ length: LANES }, () => ({ state: 'ready', x: -0.5, rot: 0, recharge: 0, glow: 1 })),
    cardCd: Object.fromEntries(DEF_KEYS.map((k) => [k, 0])),
    unlocked: new Set(DEF_KEYS.filter((k) => DEFENDERS[k].unlock <= 1)),
    phase: 'prep', timer: PREP_TIME, queue: [], waveT: 0, waveLen: 0, hordeAnnounced: true,
    skyT: 4, time: 0, speed: 1, paused: false, over: false,
    sel: null, popup: null, hover: null, drag: null,
    shake: 0, hurtFlash: 0, banner: null, night: 0, seen: new Set(), intro: null, intros: [],
    weather: Array.from({ length: 26 }, () => ({ u: Math.random(), v: Math.random(), p: Math.random() * 100, s: rand(0.6, 1.3) })),
  };
  hideOverlay();
  buildCards();
  syncHud(true);
  S.banner = { text: 'Bereitmachen!', sub: 'Pflanze Manablüten, bevor die Monster kommen', life: 3, max: 3 };
}

const hpMult = (w) => 1 + Math.max(0, w - 6) * 0.07 + Math.max(0, w - 25) * 0.05;
const isNight = (w) => w > 0 && ((w - 1) % 10) >= 7;

// ================================================================ Wellen
function makeWave(w) {
  const boss = w % 10 === 0 ? BOSS_ORDER[(w / 10 - 1) % BOSS_ORDER.length] : null;
  let budget = Math.round(3 + w * 2.4 + Math.pow(w, 1.35) * 0.4);
  const pool = Object.entries(MONSTERS).filter(([, d]) => !d.boss && d.unlock && d.unlock <= w)
    .map(([k, d]) => [k, d.pts, d.wt * (w - d.unlock > 12 && d.pts <= 2 ? 0.5 : 1)]);
  const pick = (maxPts) => {
    const avail = pool.filter((p) => p[1] <= maxPts);
    if (!avail.length) return null;
    let v = Math.random() * avail.reduce((s, p) => s + p[2], 0);
    for (const p of avail) { v -= p[2]; if (v <= 0) return p; }
    return avail[0];
  };
  const dur = Math.min(55, 22 + w * 1.2);
  const list = [];
  let lastLane = -1, sameCount = 0;
  const lane = () => {
    let l = Math.floor(Math.random() * LANES);
    if (l === lastLane && ++sameCount > 1) { l = (l + 1 + Math.floor(Math.random() * (LANES - 1))) % LANES; sameCount = 0; }
    if (l !== lastLane) sameCount = 0;
    lastLane = l;
    return l;
  };
  let main = Math.ceil(budget * 0.65), horde = budget - main;
  while (main > 0) { const p = pick(main); if (!p) break; main -= p[1]; list.push({ t: rand(2, dur * 0.75), type: p[0], l: lane() }); }
  while (horde > 0) { const p = pick(horde); if (!p) break; horde -= p[1]; list.push({ t: rand(dur * 0.8, dur * 0.8 + 4), type: p[0], l: lane() }); }
  if (boss) {
    const n = 1 + Math.floor(w / 40);
    for (let i = 0; i < n; i++) list.push({ t: dur * 0.8 + i * 3, type: boss, l: lane() });
  }
  list.sort((a, b) => a.t - b.t);
  return { list, dur, boss };
}

function startWave() {
  if (!S || S.over || S.phase === 'wave') return;
  if (S.phase === 'break' || S.phase === 'prep') {
    const bonus = Math.floor(S.timer) * 2;
    if (bonus > 0 && S.wave > 0) { S.mana += bonus; floatTextAt(L.w / 2, L.h * 0.18, `+${bonus} Mana (früh gestartet)`, '#9ee8ff'); }
  }
  S.wave++;
  S.phase = 'wave';
  S.timer = 0;
  const wv = makeWave(S.wave);
  S.queue = wv.list; S.waveT = 0; S.waveLen = wv.dur; S.hordeAnnounced = false;
  const newly = DEF_KEYS.filter((k) => DEFENDERS[k].unlock === S.wave && !S.unlocked.has(k));
  for (const k of newly) S.unlocked.add(k);
  if (newly.length) { buildCards(); S.intros.push({ kind: 'def', type: newly[0] }); }
  let sub = '';
  if (isNight(S.wave) && !isNight(S.wave - 1)) sub = 'Die Nacht bricht herein – kein Mana vom Himmel!';
  if (newly.length) sub = `Neuer Verteidiger: ${DEFENDERS[newly[0]].name}!`;
  S.banner = { text: wv.boss ? `Welle ${S.wave} – ${MONSTERS[wv.boss].name}!` : `Welle ${S.wave}`, sub, life: 2.8, max: 2.8, boss: !!wv.boss };
}

function waveCleared() {
  S.phase = 'break';
  S.timer = BREAK_TIME;
  S.score += S.wave * 100;
  for (const [l, g] of S.guards.entries()) {
    if (g.state === 'gone' && --g.recharge <= 0) {
      g.state = 'ready'; g.x = -0.5; g.rot = 0; g.glow = 0;
      const p = L.pt(-0.5, l);
      sparkle(p.x, p.y, '#9ee8ff', 16);
    }
  }
  floatTextAt(L.w / 2, L.h * 0.4, `Welle ${S.wave} überstanden!`, '#8fe07a', 2);
}

// ================================================================ Monster
function spawnMonster(type, l, x = 9.5 + Math.random() * 0.4) {
  const def = MONSTERS[type];
  const mult = hpMult(Math.max(1, S.wave));
  const m = {
    type, art: def.art, def, l, x, r: def.r, face: -1, wob: Math.random() * 10,
    hp: def.hp * mult, maxHp: def.hp * mult, hpShown: def.hp * mult,
    armor: (def.armor || 0) * mult, maxArmor: (def.armor || 0) * mult,
    speed: def.speed, slowT: 0, slowF: 0, burnT: 0, burnDps: 0, flying: !!def.flying,
    eating: null, smashT: 0, smashTarget: null, jumped: false, jumpT: 0, hop: 0, lean: 0,
    sumT: rand(2, 4), healT: 0, scorchT: 2, hitFlash: 0, immuneT: 0, revived: false, dead: false,
  };
  S.newMonsters.push(m);
  if (!S.seen.has(type)) { S.seen.add(type); if (S.wave > 0 && type !== 'goblin') S.intros.push({ kind: 'mon', type }); }
  return m;
}

function hurt(m, dmg, kind, src) {
  if (m.dead || dmg <= 0) return;
  if (kind === 'fire' && m.def.fireImmune) {
    if (m.immuneT <= 0) { const p = monPos(m); floatTextAt(p.x, p.y - L.cs * 0.9, 'feuerfest', '#c8c8c8', 0.8); m.immuneT = 1.5; }
    return;
  }
  if (m.armor > 0) {
    const a = Math.min(m.armor, dmg);
    m.armor -= a; dmg -= a;
    if (m.armor <= 0) {
      const p = monPos(m);
      for (let i = 0; i < 8; i++) addP(p.x, p.y - L.cs * 0.5, rand(-60, 60), rand(-120, -40), 0.7, '#9aa2ae', 3, 300);
      floatTextAt(p.x, p.y - L.cs, m.def.armorKind === 'helm' ? 'Helm weg!' : 'Schild zerbrochen!', '#c8ccd4', 0.9);
    }
  }
  m.hp -= dmg;
  m.hitFlash = 0.06;
  if (m.hp <= 0) kill(m, src);
}

function kill(m, src) {
  m.dead = true;
  S.kills++;
  S.score += (m.def.pts || 20) * 10;
  if (src) src.kills = (src.kills || 0) + 1;
  const p = monPos(m);
  const life = m.def.revive && !m.revived ? 1.4 : 0.5;
  S.effects.push({ type: 'death', m: { ...m, hitFlash: 0, slowT: 0, burnT: 0, eating: null, lean: 0 }, life, max: life, time: S.time });
  const col = m.type === 'skeleton' || m.type === 'lich' || m.type === 'necro' ? '#9ff0ff' : m.def.color;
  burst(p.x, p.y - L.cs * 0.4, col, m.def.boss ? 50 : 12, m.def.boss ? 3 : 1.6, m.type === 'skeleton' || m.type === 'imp');
  if (m.def.boss) { S.shake = 0.6; ring(p.x, p.y, L.cs * 3, '255,220,120', 0.8, true); burst(p.x, p.y, '#f2c14e', 40, 3, true); }
  if (Math.random() < (m.def.boss ? 1 : 0.05)) spawnOrb(m.x, m.l, m.def.boss ? 75 : 25, 'drop');
  if (m.def.revive && !m.revived) {
    const { l, x, maxHp } = m;
    S.timers.push({ t: 1.4, fn: () => {
      const s = spawnMonster('skeleton', l, x);
      s.revived = true; s.hp = s.hpShown = maxHp * m.def.revive; s.maxHp = maxHp;
      const q = L.pt(x, l); ring(q.x, q.y, L.cs * 0.7, '120,255,140', 0.5, true);
    } });
  }
}

function monPos(m) { return L.pt(m.x, m.l); }

function updateMonster(m, dt) {
  m.hitFlash = Math.max(0, m.hitFlash - dt);
  m.immuneT -= dt;
  let f = 1;
  if (m.slowT > 0) { m.slowT -= dt; f = 1 - m.slowF; }
  if (m.burnT > 0) {
    m.burnT -= dt;
    hurt(m, m.burnDps * dt, 'fire', null);
    if (Math.random() < dt * 8) { const p = monPos(m); addP(p.x + rand(-6, 6), p.y - L.cs * 0.5, rand(-8, 8), -50, 0.45, '#ffa030', 2.6, -30, true); }
  }
  if (m.dead) return;
  if (m.def.healer && (m.healT += dt) > 3) {
    m.healT = 0;
    let any = false;
    for (const o of S.monsters) {
      if (o === m || o.dead || o.hp >= o.maxHp || Math.abs(o.l - m.l) > 1 || Math.abs(o.x - m.x) > 1.6) continue;
      o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.15); any = true;
      const q = monPos(o); addP(q.x, q.y - L.cs * 0.7, 0, -40, 0.6, '#8aff6a', 3, 0, true);
    }
    if (any) { const p = monPos(m); ring(p.x, p.y, L.cs * 1.6, '120,255,120', 0.5, true); }
  }
  if (m.def.summon && m.x < 9 && (m.sumT -= dt) <= 0) {
    m.sumT = m.def.summonCd;
    const n = m.def.boss ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const l = m.def.boss ? clamp(m.l + (i ? 1 : -1), 0, LANES - 1) : m.l;
      const s = spawnMonster(m.def.summon, l, Math.max(0.6, m.x - 1.2 - Math.random() * 0.6));
      const q = L.pt(s.x, s.l);
      smoke(q.x, q.y, 6);
      ring(q.x, q.y, L.cs * 0.6, m.def.summon === 'imp' ? '255,90,40' : '120,255,140', 0.5, true);
    }
  }
  if (m.def.scorch && (m.scorchT -= dt) <= 0) {
    m.scorchT = 3;
    for (const c of [Math.floor(m.x), Math.floor(m.x) - 1]) {
      const d = c >= 0 && c < COLS ? S.grid[m.l][c] : null;
      const q = L.pt(c + 0.5, m.l);
      if (c >= 0 && c < COLS) for (let i = 0; i < 10; i++) addP(q.x + rand(-15, 15), q.y + rand(-10, 10), rand(-20, 20), rand(-80, -30), 0.6, i % 2 ? '#ff7a1a' : '#ffd040', 4, 0, true);
      if (d && d.type !== 'thorns') damageDefender(d, 400);
    }
  }

  // Sprung (Schattenklinge)
  if (m.jumpT > 0) {
    m.jumpT -= dt;
    m.x -= (1.4 / 0.6) * dt;
    m.hop = Math.sin((1 - m.jumpT / 0.6) * Math.PI) * 26;
    if (m.jumpT <= 0) { m.hop = 0; m.speed = m.def.speed * 0.5; }
    return;
  }
  // Schmettern (Trolle)
  if (m.smashT > 0) {
    m.smashT -= dt;
    m.lean = m.smashT > 0.3 ? -0.25 * (1 - m.smashT) : 0.3;
    if (m.smashT <= 0) {
      const d = m.smashTarget;
      m.smashTarget = null; m.lean = 0;
      if (d && !d.dead) {
        const q = L.pt(d.c + 0.5, d.l);
        removeDefender(d);
        S.shake = Math.max(S.shake, 0.35);
        burst(q.x, q.y, '#8a7a6a', 22, 2.2);
        smoke(q.x, q.y, 10, 1.3);
        ring(q.x, q.y + L.cs * 0.25, L.cs * 0.9, '200,180,150', 0.4);
      }
    }
    return;
  }
  // Fressen
  if (m.eating) {
    const d = m.eating;
    if (d.dead) { m.eating = null; m.lean = 0; }
    else {
      m.lean = -0.1 + Math.sin(S.time * 10 + m.wob) * 0.14;
      damageDefender(d, (m.def.bite || 100) * f * dt);
      if (Math.random() < dt * 3) { const q = L.pt(d.c + 0.7, d.l); addP(q.x, q.y - L.cs * 0.2, rand(-30, 30), rand(-60, -20), 0.4, '#d8c8a0', 2.5, 200); }
      return;
    }
  }
  m.x -= m.speed * f * dt;

  if (!m.flying) {
    const front = m.x - 0.32, c = Math.floor(front);
    const d = c >= 0 && c < COLS ? S.grid[m.l][c] : null;
    if (d && d.type !== 'bomb') {
      if (d.type === 'thorns') {
        if (m.def.smash && !m.smashTarget) { m.smashT = 0.9; m.smashTarget = d; }
      } else if (d.type === 'mine' && d.armed) {
        explodeMine(d);
      } else if (m.def.jump && !m.jumped) {
        m.jumped = true; m.jumpT = 0.6;
      } else if (m.def.smash) {
        m.smashT = 1.1; m.smashTarget = d;
      } else {
        m.eating = d;
      }
    }
    const tc = Math.floor(m.x);
    const td = tc >= 0 && tc < COLS ? S.grid[m.l][tc] : null;
    if (td && td.type === 'thorns') hurt(m, td.def.dps * LEVEL_DMG[td.level - 1] * dt, 'phys', td);
  }

  if (m.x < -0.25) breach(m);
  m.hpShown += (m.hp - m.hpShown) * Math.min(1, dt * 4);
}

function breach(m) {
  if (S.over) { m.dead = true; return; }
  const g = S.guards[m.l];
  if (g.state === 'ready') {
    g.state = 'rolling'; g.x = -0.5;
    if (m.def.boss) { hurt(m, m.maxHp * 0.4, 'phys', null); m.x = 0.3; }
    else { m.dead = true; burst(monPos(m).x, monPos(m).y, m.def.color, 10, 2); }
    return;
  }
  m.dead = true;
  S.hearts--;
  S.shake = 0.7; S.hurtFlash = 0.6;
  const p = L.pt(-0.9, m.l);
  burst(p.x, p.y, '#ff5a4a', 30, 2.5, true);
  floatTextAt(p.x, p.y - L.cs, '−1 ❤️', '#ff5a4a', 1.5);
  if (S.hearts <= 0) gameOver();
}

function updateGuards(dt) {
  for (const [l, g] of S.guards.entries()) {
    g.glow = Math.min(1, g.glow + dt);
    if (g.state !== 'rolling') continue;
    g.x += 5 * dt;
    g.rot += 9 * dt;
    for (const m of S.monsters) {
      if (m.dead || m.l !== l || Math.abs(m.x - g.x) > 0.45) continue;
      if (m.def.boss) { if (!m.guardHit) { m.guardHit = true; hurt(m, m.maxHp * 0.4, 'phys', null); } }
      else { hurt(m, m.hp + m.armor + 1, 'phys', null); }
    }
    const p = L.pt(g.x, l);
    if (Math.random() < dt * 20) addP(p.x, p.y + L.cs * 0.25, rand(-20, 20), rand(-40, -10), 0.5, 'rgba(140,120,90,0.6)', 6, 0, false, 'smoke');
    if (g.x > COLS + 1.2) { g.state = 'gone'; g.recharge = 3; }
  }
}

// ================================================================ Verteidiger
function canPlace(type, c, l) {
  if (c < 0 || c >= COLS || l < 0 || l >= LANES) return false;
  return !S.grid[l][c];
}

function place(type, c, l) {
  const def = DEFENDERS[type];
  if (!S.unlocked.has(type)) return false;
  if (S.cardCd[type] > 0) { toast('Lädt noch auf …'); return false; }
  if (S.mana < def.cost) { toast('Nicht genug Mana!'); return false; }
  if (!canPlace(type, c, l)) { toast('Feld ist belegt'); return false; }
  const d = {
    type, def, c, l, level: 1, hp: def.hp, maxHp: def.hp, cd: 0.6, charge: 0, spent: def.cost, kills: 0,
    prodT: def.prod ? def.prod.first : 0, prodReady: 0, armT: def.arm || 0, armed: false, fuse: type === 'bomb' ? 0.9 : 0,
    fireT: 0, hitFlash: 0, wob: Math.random() * 10, dead: false,
  };
  S.mana -= def.cost;
  S.cardCd[type] = def.cd;
  S.grid[l][c] = d;
  S.defenders.push(d);
  const p = L.pt(c + 0.5, l);
  smoke(p.x, p.y + L.cs * 0.25, 8, 0.9);
  ring(p.x, p.y + L.cs * 0.25, L.cs * 0.6, '255,240,200', 0.35);
  return true;
}

function removeDefender(d) {
  if (d.dead) return;
  d.dead = true;
  S.grid[d.l][d.c] = null;
  S.defenders.splice(S.defenders.indexOf(d), 1);
  for (const m of S.monsters) if (m.eating === d) { m.eating = null; m.lean = 0; }
  if (S.popup && S.popup.d === d) closePopup();
}

function damageDefender(d, amount) {
  if (d.dead || d.maxHp === Infinity) return;
  d.hp -= amount;
  d.hitFlash = 0.1;
  if (d.hp <= 0) {
    const p = L.pt(d.c + 0.5, d.l);
    burst(p.x, p.y, d.type === 'wall' ? '#8d857a' : '#6aa040', 14, 1.6);
    removeDefender(d);
  }
}

const upgradeCost = (d) => (d.level >= MAX_LEVEL ? Infinity : d.def.cost * d.level + 25);
function upgrade(d) {
  if (d.level >= MAX_LEVEL) return;
  const cost = upgradeCost(d);
  if (S.mana < cost) { toast('Nicht genug Mana!'); return; }
  S.mana -= cost; d.spent += cost; d.level++;
  if (d.maxHp !== Infinity) {
    const nm = d.def.hp * LEVEL_HP[d.level - 1];
    d.hp += nm - d.maxHp; d.maxHp = nm;
  }
  const p = L.pt(d.c + 0.5, d.l);
  ring(p.x, p.y, L.cs * 0.8, '242,193,78', 0.5, true);
  sparkle(p.x, p.y, '#ffd86a', 20);
  openPopup(d);
}
function sell(d) {
  const back = Math.floor(d.spent * 0.25);
  S.mana += back;
  const p = L.pt(d.c + 0.5, d.l);
  floatTextAt(p.x, p.y - L.cs * 0.4, `+${back} Mana`, '#9ee8ff');
  smoke(p.x, p.y, 10, 1);
  removeDefender(d);
  closePopup();
}

function laneTarget(d, minX, maxX = 9.3) {
  let best = null;
  for (const m of S.monsters) {
    if (m.dead || m.l !== d.l || m.x < minX || m.x > maxX) continue;
    if (!best || m.x < best.x) best = m;
  }
  return best;
}

function updateDefender(d, dt) {
  d.hitFlash = Math.max(0, d.hitFlash - dt);
  const def = d.def, lv = LEVEL_DMG[d.level - 1];
  if (def.prod) {
    d.prodT -= dt;
    d.prodReady = clamp(1 - d.prodT / 3, 0, 1);
    if (d.prodT <= 0) { d.prodT = def.prod.every; spawnOrb(d.c + 0.5, d.l, def.prod.amount[d.level - 1], 'bloom'); }
    return;
  }
  if (d.type === 'mine') {
    if (!d.armed && (d.armT -= dt) <= 0) {
      d.armed = true;
      const p = L.pt(d.c + 0.5, d.l); sparkle(p.x, p.y, '#ff8a40', 10);
    }
    return;
  }
  if (d.type === 'bomb') {
    if ((d.fuse -= dt) <= 0) explodeBomb(d);
    return;
  }
  if (def.shot) {
    const target = laneTarget(d, d.c + 0.3);
    d.cd -= dt;
    d.charge = target ? clamp(1 - d.cd * def.shot.rate, 0, 1) : Math.max(0, d.charge - dt * 2);
    if (!target || d.cd > 0) return;
    d.cd = 1 / def.shot.rate;
    const dmg = def.shot.dmg * lv;
    if (d.type === 'storm') return zap(d, target, dmg);
    const shoot = () => { if (!d.dead) S.projectiles.push({ kind: def.shot.kind, l: d.l, x: d.c + 0.85, px: d.c + 0.85, speed: 7, dmg, slow: def.shot.slow, src: d }); };
    shoot();
    if (def.shot.double) S.timers.push({ t: 0.18, fn: shoot });
    return;
  }
  if (def.breath) {
    d.fireT = Math.max(0, d.fireT - dt);
    const reach = def.breath.reach;
    const target = laneTarget(d, d.c + 0.4, d.c + 0.6 + reach);
    d.cd -= dt;
    d.charge = target ? clamp(1 - d.cd * def.breath.rate, 0, 1) : 0;
    if (!target || d.cd > 0) return;
    d.cd = 1 / def.breath.rate;
    d.fireT = 0.6;
    for (const m of S.monsters) {
      if (m.dead || m.l !== d.l || m.x < d.c + 0.4 || m.x > d.c + 0.6 + reach) continue;
      hurt(m, def.breath.dmg * lv, 'fire', d);
      if (!m.def.fireImmune) { m.burnT = 3; m.burnDps = Math.max(m.burnDps, def.breath.burn * lv); }
    }
    const a = L.pt(d.c + 0.85, d.l);
    const b = L.pt(d.c + 0.6 + reach, d.l);
    for (let i = 0; i < 40; i++) {
      const k = Math.random();
      addP(a.x, a.y - L.cs * 0.3, (b.x - a.x) * (1.4 + k) + rand(-30, 30), (b.y - a.y) * (1.4 + k) + rand(-30, 30), rand(0.35, 0.6), ['#ffd040', '#ff7a1a', '#ff3a10'][i % 3], rand(4, 8), -40, true);
    }
  }
}

function zap(d, target, dmg) {
  const hit = new Set([target]);
  const s = L.pt(d.c + 0.5, d.l);
  const pts = [{ x: s.x, y: s.y - L.cs * 0.5 }];
  let cur = target, dd = dmg;
  for (let i = 0; i < d.def.shot.chain; i++) {
    const p = monPos(cur);
    pts.push({ x: p.x, y: p.y - L.cs * 0.35 - enemyLift(cur, S.time) * L.cs / 34 });
    hurt(cur, dd, 'magic', d);
    dd *= 0.8;
    let next = null, best = 1.7 * 1.7;
    for (const m of S.monsters) {
      if (m.dead || hit.has(m)) continue;
      const q = (m.x - cur.x) ** 2 + (m.l - cur.l) ** 2;
      if (q < best) { best = q; next = m; }
    }
    if (!next) break;
    hit.add(next); cur = next;
  }
  S.effects.push({ type: 'bolt', pts: jagged(pts, L.cs * 0.12), life: 0.25, max: 0.25 });
}
function jagged(pts, amp) {
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    for (let k = 1; k < 6; k++) { const t = k / 6; out.push({ x: a.x + (b.x - a.x) * t + rand(-amp, amp), y: a.y + (b.y - a.y) * t + rand(-amp, amp) }); }
    out.push(b);
  }
  return out;
}

function explodeMine(d) {
  const p = L.pt(d.c + 0.5, d.l);
  for (const m of S.monsters) if (!m.dead && !m.flying && m.l === d.l && m.x > d.c - 0.3 && m.x < d.c + 1.6) hurt(m, d.def.blast * LEVEL_DMG[d.level - 1], 'phys', d);
  explosion(p.x, p.y, L.cs * 0.9);
  removeDefender(d);
}
function explodeBomb(d) {
  const p = L.pt(d.c + 0.5, d.l);
  for (const m of S.monsters) if (!m.dead && Math.abs(m.l - d.l) <= 1 && m.x > d.c - 1.2 && m.x < d.c + 2.3) hurt(m, d.def.blast, 'fire', d);
  explosion(p.x, p.y, L.cs * 1.6);
  removeDefender(d);
}
function explosion(x, y, r) {
  S.shake = Math.max(S.shake, 0.45);
  ring(x, y, r * 1.2, '255,160,60', 0.6, true);
  ring(x, y, r * 0.8, '255,240,160', 0.35, true);
  burst(x, y, '#ff8a2a', 40, 3, true);
  burst(x, y, '#ffe060', 25, 2, true);
  smoke(x, y, 14, 1.6);
  S.effects.push({ type: 'scorch', x, y: y + L.cs * 0.25, r: r * 0.6, life: 10, max: 10 });
}

function updateProjectile(p, dt) {
  p.px = p.x;
  p.x += p.speed * dt;
  let hit = null;
  for (const m of S.monsters) {
    if (m.dead || m.l !== p.l || m.x - 0.25 > p.x || m.x < p.px - 0.3) continue;
    if (!hit || m.x < hit.x) hit = m;
  }
  const sp = L.pt(p.x, p.l);
  if (p.kind === 'ice' && Math.random() < 0.7) addP(sp.x, sp.y - L.cs * 0.3, rand(-10, 10), rand(-10, 10), 0.3, '#dff6ff', 2, 0, true);
  if (hit) {
    p.done = true;
    hurt(hit, p.dmg, 'phys', p.src);
    if (p.slow) { hit.slowT = 3; hit.slowF = hit.def.boss ? p.slow * 0.5 : p.slow; }
    const q = monPos(hit);
    burst(q.x, q.y - L.cs * 0.4, p.kind === 'ice' ? '#c8f0ff' : '#e8d8b0', 5, 1, p.kind === 'ice');
  } else if (p.x > COLS + 0.8) p.done = true;
}

// ================================================================ Mana
function spawnOrb(x, l, value, kind) {
  const o = { x: clamp(x + (kind === 'bloom' ? rand(-0.3, 0.3) : 0), 0.2, COLS - 0.2), l, value, kind, t: 0, life: 10, fall: kind === 'sky' ? 0 : 1, pop: kind === 'sky' ? 0 : 0.5, wob: Math.random() * 10 };
  S.orbs.push(o);
  if (settings.autoCollect) o.auto = kind === 'sky' ? 3.6 : 0.8;
  return o;
}
function orbScreen(o) {
  const p = L.pt(o.x, o.l);
  let y = p.y - L.cs * 0.1;
  if (o.fall < 1) y -= (1 - o.fall) * (p.y + L.cs);
  if (o.pop > 0) y -= Math.sin((o.pop / 0.5) * Math.PI) * L.cs * 0.5;
  return { x: p.x, y };
}
function collect(o) {
  if (o.collected) return;
  o.collected = true;
  o.from = orbScreen(o);
  o.ct = 0;
  S.mana += o.value;
  S.score += 5;
}
function manaTarget() {
  const r = $('manaVal').getBoundingClientRect(), c = canvas.getBoundingClientRect();
  return { x: clamp(r.left + r.width / 2 - c.left, 0, L.w), y: clamp(r.top + r.height / 2 - c.top, 0, L.h) };
}
function updateOrbs(dt) {
  if (!isNight(S.wave) && (S.skyT -= dt) <= 0) { S.skyT = rand(8, 11); spawnOrb(rand(0.5, COLS - 0.5), Math.floor(Math.random() * LANES), 25, 'sky'); }
  for (const o of S.orbs) {
    o.t += dt;
    if (o.collected) { o.ct += dt * 2.2; continue; }
    if (o.fall < 1) o.fall = Math.min(1, o.fall + dt / 4);
    if (o.pop > 0) o.pop = Math.max(0, o.pop - dt);
    if (o.auto != null && (o.auto -= dt) <= 0) collect(o);
    if (o.fall >= 1 && (o.life -= dt) <= 0) o.gone = true;
  }
  S.orbs = S.orbs.filter((o) => !o.gone && !(o.collected && o.ct >= 1));
}

// ================================================================ Effekte
const pCap = () => (isHigh() ? 900 : 300);
function addP(x, y, vx, vy, life, color, size, grav = 0, add = false, kind = 'dot') {
  if (S.particles.length >= pCap()) return;
  S.particles.push({ x, y, vx, vy, life, max: life, color, size: size * L.cs / 64, grav, add, kind });
}
function burst(x, y, color, n, sp = 2, add = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rand(20, 80) * sp * L.cs / 64;
    addP(x, y, Math.cos(a) * v, Math.sin(a) * v, rand(0.3, 0.7), color, rand(1.5, 3.5), 150, add);
  }
}
function sparkle(x, y, color, n) {
  for (let i = 0; i < n; i++) addP(x + rand(-L.cs * 0.3, L.cs * 0.3), y + rand(-L.cs * 0.1, L.cs * 0.3), 0, rand(-90, -40), rand(0.5, 0.9), color, 2.6, 0, true);
}
function smoke(x, y, n, s = 1) {
  for (let i = 0; i < n; i++) addP(x + rand(-8, 8), y + rand(-5, 5), rand(-20, 20), rand(-40, -10), rand(0.6, 1.1), 'rgba(110,100,90,0.5)', rand(7, 11) * s, -5, false, 'smoke');
}
function ring(x, y, r, color, life = 0.35, bright = false) { S.effects.push({ type: 'ring', x, y, r, color, life, max: life, bright }); }
function floatTextAt(x, y, text, color, life = 1.1) { S.texts.push({ x, y, text, color, life, max: life }); }

// ================================================================ Update
function update(dt) {
  S.time += dt;
  S.night += ((isNight(S.wave) ? 1 : 0) - S.night) * Math.min(1, dt * 0.5);
  for (const k of DEF_KEYS) S.cardCd[k] = Math.max(0, S.cardCd[k] - dt);

  if (S.phase === 'prep' || S.phase === 'break') {
    if ((S.timer -= dt) <= 0) startWave();
  } else {
    S.waveT += dt;
    while (S.queue.length && S.queue[0].t <= S.waveT) { const q = S.queue.shift(); spawnMonster(q.type, q.l); }
    if (!S.hordeAnnounced && S.waveT >= S.waveLen * 0.78) {
      S.hordeAnnounced = true;
      S.banner = { text: 'Eine große Horde naht!', sub: '', life: 2.4, max: 2.4, boss: true };
    }
  }
  for (const tm of S.timers) { tm.t -= dt; if (tm.t <= 0) tm.fn(); }
  S.timers = S.timers.filter((tm) => tm.t > 0);
  flush();
  for (const m of S.monsters) if (!m.dead) updateMonster(m, dt);
  flush();
  for (const d of S.defenders.slice()) if (!d.dead) updateDefender(d, dt);
  for (const p of S.projectiles) updateProjectile(p, dt);
  S.projectiles = S.projectiles.filter((p) => !p.done);
  updateGuards(dt);
  updateOrbs(dt);
  for (const fx of S.effects) fx.life -= dt;
  S.effects = S.effects.filter((fx) => fx.life > 0);
  for (const p of S.particles) {
    p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt * L.cs / 64;
    const damp = p.kind === 'smoke' ? 0.97 : 0.94; p.vx *= damp; p.vy *= damp;
  }
  S.particles = S.particles.filter((p) => p.life > 0);
  for (const t of S.texts) { t.life -= dt; t.y -= 26 * dt; }
  S.texts = S.texts.filter((t) => t.life > 0);
  flush();
  S.monsters = S.monsters.filter((m) => !m.dead);
  S.shake = Math.max(0, S.shake - dt);
  S.hurtFlash = Math.max(0, S.hurtFlash - dt);
  if (S.banner && (S.banner.life -= dt) <= 0) S.banner = null;
  if (S.intro && (S.intro.life -= dt) <= 0) S.intro = null;
  if (!S.intro && S.intros.length) S.intro = { ...S.intros.shift(), life: 5, max: 5 };
  if (S.phase === 'wave' && !S.queue.length && !S.monsters.length && !S.timers.length) waveCleared();
  for (const w of S.weather) w.p += dt;
}
function flush() { if (S.newMonsters.length) { S.monsters.push(...S.newMonsters); S.newMonsters.length = 0; } }

// ================================================================ Rendering
const lights = [];
let LT = { ox: 0, oy: 0, k: 1 };
function sink(x, y, r, color, a) { lights.push(LT.ox + x * LT.k, LT.oy + y * LT.k, r * LT.k, a, color); }
const lightCv = document.createElement('canvas');
const lctx = lightCv.getContext('2d');

function at(x, y, k) {
  ctx.setTransform(dpr * k, 0, 0, dpr * k, dpr * x, dpr * y);
  LT = { ox: x, oy: y, k };
}

function render(time) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (!L) return;
  ctx.drawImage(board, 0, 0, L.w, L.h);
  if (!S) return;
  lights.length = 0;
  setLightSink(isHigh() ? sink : null);
  const sx = S.shake > 0 ? rand(-1, 1) * S.shake * L.cs * 0.15 : 0, sy = S.shake > 0 ? rand(-1, 1) * S.shake * L.cs * 0.15 : 0;
  const cs = L.cs, kd = cs / 64, km = cs / 34;

  // Brandflecken
  ctx.setTransform(dpr, 0, 0, dpr, dpr * sx, dpr * sy);
  for (const fx of S.effects) if (fx.type === 'scorch') {
    ctx.globalAlpha = Math.min(1, fx.life / 3) * 0.5;
    ctx.drawImage(scorchSprite(), fx.x - fx.r, fx.y - fx.r * 0.55, fx.r * 2, fx.r * 1.1);
    ctx.globalAlpha = 1;
  }
  // Nebel & Augen im Wald
  for (let i = 0; i < 5; i++) {
    const p = L.pt(9.9 + Math.sin(time * 0.3 + i) * 0.3, i);
    glow(ctx, p.x, p.y, cs * 0.9, '110,70,150', 0.12 + S.night * 0.1);
    const blink = Math.sin(time * 0.7 + i * 2.3);
    if (blink > 0.6) {
      const q = L.pt(10.25, i - 0.35 + (i % 2) * 0.6);
      for (const o of [-0.06, 0.06]) { circ(ctx, q.x + o * cs, q.y, cs * 0.025, '#ff4030'); glow(ctx, q.x + o * cs, q.y, cs * 0.06, '255,60,40', 0.8); }
    }
  }
  // Fackeln
  for (let l = 0; l <= LANES; l++) {
    const p = L.pt(-0.66, l - 0.5);
    LT = { ox: sx, oy: sy, k: 1 };
    drawTorch(ctx, p.x, p.y, cs / 48, time + l);
  }
  // Auswahl / Vorschau-Feld
  const prevType = S.drag && S.drag.active ? S.drag.type : S.sel;
  const ghostCell = S.drag && S.drag.active ? S.drag.cell : S.hover;
  if (prevType && ghostCell && ghostCell.c >= 0 && ghostCell.c < COLS && ghostCell.l >= 0 && ghostCell.l < LANES) {
    const ok = canPlace(prevType, ghostCell.c, ghostCell.l) && S.mana >= DEFENDERS[prevType].cost && S.cardCd[prevType] <= 0;
    const a = L.pt(ghostCell.c, ghostCell.l - 0.5), b = L.pt(ghostCell.c + 1, ghostCell.l + 0.5);
    ctx.fillStyle = ok ? 'rgba(160,255,160,0.25)' : 'rgba(255,90,90,0.28)';
    ctx.beginPath(); ctx.roundRect(Math.min(a.x, b.x) + 2, Math.min(a.y, b.y) + 2, Math.abs(b.x - a.x) - 4, Math.abs(b.y - a.y) - 4, cs * 0.1); ctx.fill();
  }
  if (S.popup) {
    const d = S.popup.d, a = L.pt(d.c, d.l - 0.5), b = L.pt(d.c + 1, d.l + 0.5);
    ctx.strokeStyle = 'rgba(242,193,78,0.95)'; ctx.lineWidth = 2.5; ctx.setLineDash([7, 5]); ctx.lineDashOffset = -time * 25;
    ctx.beginPath(); ctx.roundRect(Math.min(a.x, b.x) + 3, Math.min(a.y, b.y) + 3, Math.abs(b.x - a.x) - 6, Math.abs(b.y - a.y) - 6, cs * 0.1); ctx.stroke(); ctx.setLineDash([]);
  }

  // Wächterfelsen
  for (const [l, g] of S.guards.entries()) {
    if (g.state === 'gone') continue;
    const p = L.pt(g.x, l);
    LT = { ox: sx, oy: sy, k: 1 };
    ctx.globalAlpha = g.glow;
    drawGuardian(ctx, p.x, p.y + cs * 0.08, cs / 48, g.rot, g.state === 'ready' ? 0.6 + Math.sin(time * 3 + l) * 0.4 : 1);
    ctx.globalAlpha = 1;
  }

  // Figuren nach Bildschirm-y sortiert
  const list = [];
  for (const d of S.defenders) { const p = L.pt(d.c + 0.5, d.l); list.push([p.y, 0, d, p]); }
  for (const m of S.monsters) if (!m.flying) { const p = L.pt(m.x, m.l); list.push([p.y + 0.5, 1, m, p]); }
  for (const fx of S.effects) if (fx.type === 'death' && !fx.m.flying) { const p = L.pt(fx.m.x, fx.m.l); list.push([p.y + 0.4, 2, fx, p]); }
  list.sort((a, b) => a[0] - b[0]);
  for (const [, kind, o, p] of list) {
    if (kind === 0) { at(p.x + sx, p.y + sy, kd); drawDefender(ctx, o, time); }
    else if (kind === 1) drawMonster(o, p, sx, sy, km, time);
    else drawDeath(o, p, sx, sy, km);
  }
  for (const fx of S.effects) if (fx.type === 'death' && fx.m.flying) drawDeath(fx, L.pt(fx.m.x, fx.m.l), sx, sy, km);
  for (const m of S.monsters) if (m.flying) drawMonster(m, L.pt(m.x, m.l), sx, sy, km, time);

  // Geschosse
  for (const p of S.projectiles) {
    const q = L.pt(p.x, p.l);
    at(q.x + sx, q.y + sy - cs * 0.32, kd);
    ctx.rotate(L.dir);
    if (p.kind === 'arrow' || p.kind === 'bolt') {
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-12, 0); ctx.stroke();
      ctx.strokeStyle = p.kind === 'bolt' ? '#4a3a2a' : '#d8c090'; ctx.lineWidth = p.kind === 'bolt' ? 3 : 2.2;
      ctx.beginPath(); ctx.moveTo(-12, 0); ctx.lineTo(8, 0); ctx.stroke();
      poly(ctx, [[13, 0], [6, -3.5], [6, 3.5]], p.kind === 'bolt' ? '#9aa2ae' : '#e0e0e8', false);
      if (p.kind === 'arrow') poly(ctx, [[-12, 0], [-16, -4], [-9, 0], [-16, 4]], '#3f8f3a', false);
    } else if (p.kind === 'ice') {
      glow(ctx, 0, 0, 16, '150,220,255', 1);
      ctx.rotate(time * 12);
      poly(ctx, [[0, -7], [3.4, 0], [0, 7], [-3.4, 0]], '#f4feff', false);
      sink(0, 0, 40, '150,220,255', 0.6);
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, dpr * sx, dpr * sy);
  LT = { ox: sx, oy: sy, k: 1 };
  // Effekte
  for (const fx of S.effects) {
    if (fx.type === 'ring') {
      const k = 1 - fx.life / fx.max;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, 4 + (fx.r - 4) * k, 0, TAU);
      ctx.strokeStyle = `rgba(${fx.color},${(1 - k) * 0.9})`; ctx.lineWidth = 4 * (1 - k) + 1; ctx.stroke();
      ctx.fillStyle = `rgba(${fx.color},${(1 - k) * 0.14})`; ctx.fill();
      if (fx.bright) sink(fx.x, fx.y, fx.r * 1.5, fx.color, 1 - k);
    } else if (fx.type === 'bolt') {
      const a = fx.life / fx.max;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      for (const [w, c] of [[10, `rgba(200,160,255,${a * 0.3})`], [4, `rgba(240,220,255,${a * 0.7})`], [1.8, `rgba(255,255,255,${a})`]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w * cs / 64;
        ctx.beginPath(); fx.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < fx.pts.length; i += 6) sink(fx.pts[i].x, fx.pts[i].y, cs * 1.2, '210,180,255', a);
    }
  }
  // Partikel
  for (const p of S.particles) {
    if (p.add) continue;
    const a = clamp(p.life / p.max, 0, 1);
    ctx.globalAlpha = p.kind === 'smoke' ? a * 0.8 : a;
    if (p.kind === 'smoke') circ(ctx, p.x, p.y, p.size * (1.8 - a), p.color);
    else { ctx.fillStyle = p.color; ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size); }
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  for (const p of S.particles) {
    if (!p.add) continue;
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.6 + 0.4, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  drawWeather(time);
  // Mana-Kristalle (am Boden / fallend)
  for (const o of S.orbs) if (!o.collected) {
    const p = orbScreen(o);
    const fade = o.fall >= 1 && o.life < 2 ? (Math.sin(o.life * 12) > 0 ? 1 : 0.4) : 1;
    drawOrb(ctx, p.x, p.y, (cs / 64) * (o.value >= 50 ? 1.3 : o.value > 25 ? 1.15 : 1), time + o.wob, fade);
  }

  composeLighting(sx, sy);
  setLightSink(null);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  // eingesammelte Kristalle fliegen zur Anzeige (über dem Licht)
  const tgt = manaTarget();
  for (const o of S.orbs) if (o.collected) {
    const k = Math.min(1, o.ct), e = 1 - (1 - k) ** 3;
    drawOrb(ctx, o.from.x + (tgt.x - o.from.x) * e, o.from.y + (tgt.y - o.from.y) * e - Math.sin(k * Math.PI) * cs * 0.6, (cs / 64) * (1 - k * 0.5), time, 1 - k * 0.3);
  }
  // Vorschau beim Ziehen
  if (S.drag && S.drag.active) {
    ctx.globalAlpha = 0.75;
    at(S.drag.x, S.drag.y, kd);
    drawDefender(ctx, { type: S.drag.type, def: DEFENDERS[S.drag.type], level: 1, hp: 1, maxHp: 1, charge: 0, prodReady: 0, armed: false, armT: 12, fuse: 0.9, wob: 0 }, time, { noUi: true });
    ctx.globalAlpha = 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // Texte
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const t of S.texts) {
    ctx.globalAlpha = clamp(t.life * 1.6, 0, 1);
    ctx.font = `bold ${Math.round(clamp(cs * 0.26, 13, 20))}px Georgia, serif`;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(t.text, t.x, t.y);
    ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
  drawBossBar();
  drawIntro();
  drawBanner();
  if ((S.phase === 'prep' || S.phase === 'break') && S.timer > 0) {
    const fs = Math.round(clamp(cs * 0.28, 13, 19));
    ctx.font = `bold ${fs}px Georgia, serif`;
    const txt = S.phase === 'prep' ? `Erste Welle in ${Math.ceil(S.timer)} s` : `Nächste Welle in ${Math.ceil(S.timer)} s`;
    const w = ctx.measureText(txt).width + 30;
    const y = L.portrait ? L.oy + cs * 0.55 : L.oy + cs * 0.22;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.beginPath(); ctx.roundRect(L.w / 2 - w / 2, y - fs, w, fs * 2, fs); ctx.fill();
    ctx.fillStyle = '#f3e9d8'; ctx.fillText(txt, L.w / 2, y);
  }
  if (S.hurtFlash > 0) {
    const g = ctx.createRadialGradient(L.w / 2, L.h / 2, Math.min(L.w, L.h) * 0.3, L.w / 2, L.h / 2, Math.max(L.w, L.h) * 0.7);
    g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,0,0,${S.hurtFlash * 0.8})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h);
  }
}

const monScale = (m) => (m.r >= 20 ? 0.82 : 1);
function monsterProxy(m) {
  const p = Object.create(m);
  p.x = 0;
  p.y = (0.31 * 34) / monScale(m) - m.r * 0.45;
  return p;
}
const armorExtra = (g, e) => drawArmor(g, e);
function drawMonster(m, p, sx, sy, km, time) {
  at(p.x + sx, p.y + sy, km * monScale(m));
  drawEnemy(ctx, monsterProxy(m, km), time, { extra: m.armor > 0 ? armorExtra : null });
  if (m.smashT > 0) glow(ctx, 0, -m.r, m.r * 2.4, '255,80,40', (1 - m.smashT) * 0.6);
}
function drawDeath(fx, p, sx, sy, km) {
  const k = 1 - fx.life / fx.max;
  at(p.x + sx, p.y + sy, km * monScale(fx.m));
  ctx.globalAlpha = 1 - k;
  ctx.rotate(-k * 0.9);
  ctx.scale(1 - k * 0.3, 1 - k * 0.5);
  drawEnemy(ctx, monsterProxy(fx.m, km), fx.time, { noBar: true });
  ctx.globalAlpha = 1;
}

let scorchC = null;
function scorchSprite() {
  if (scorchC) return scorchC;
  scorchC = document.createElement('canvas'); scorchC.width = scorchC.height = 64;
  const g = scorchC.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
  gr.addColorStop(0, 'rgba(10,5,0,0.9)'); gr.addColorStop(0.6, 'rgba(30,15,5,0.5)'); gr.addColorStop(1, 'rgba(30,15,5,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  return scorchC;
}

function drawWeather(time) {
  if (!isHigh()) return;
  const a = L.pt(0, -0.5), b = L.pt(COLS, LANES - 0.5);
  const x0 = Math.min(a.x, b.x), y0 = Math.min(a.y, b.y), w = Math.abs(b.x - a.x), h = Math.abs(b.y - a.y);
  for (const p of S.weather) {
    if (S.night > 0.4) {
      const x = x0 + ((p.u + Math.sin(p.p * 0.3) * 0.05) % 1) * w, y = y0 + ((p.v + Math.cos(p.p * 0.25) * 0.05) % 1) * h;
      const al = S.night * (0.5 + 0.5 * Math.sin(p.p * 3));
      glow(ctx, x, y, L.cs * 0.1, '200,255,120', al);
      sink(x, y, L.cs * 0.3, '200,255,120', al * 0.5);
    } else {
      const x = x0 + ((p.u + p.p * 0.02 * p.s) % 1) * w, y = y0 + ((p.v + p.p * 0.03 * p.s) % 1) * h;
      ctx.save(); ctx.translate(x, y); ctx.rotate(p.p * 2);
      ell(ctx, 0, 0, L.cs * 0.05, L.cs * 0.025, ['#7ac84a', '#e0a040', '#f2c14e'][Math.floor(p.s * 10) % 3]);
      ctx.restore();
    }
  }
}

function composeLighting(sx, sy) {
  const amb = 0.04 + S.night * 0.56;
  if (amb <= 0.05) return;
  const color = '10,16,45';
  if (!isHigh()) { ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = `rgba(${color},${amb * 0.6})`; ctx.fillRect(0, 0, L.w, L.h); return; }
  if (lightCv.width !== canvas.width || lightCv.height !== canvas.height) { lightCv.width = canvas.width; lightCv.height = canvas.height; }
  lctx.setTransform(1, 0, 0, 1, 0, 0);
  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, lightCv.width, lightCv.height);
  lctx.fillStyle = `rgba(${color},${amb})`;
  lctx.fillRect(0, 0, lightCv.width, lightCv.height);
  lctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  lctx.globalCompositeOperation = 'destination-out';
  const white = glowSprite('255,255,255');
  for (let i = 0; i < lights.length; i += 5) {
    const r = lights[i + 2] * 1.3;
    lctx.globalAlpha = Math.min(1, lights[i + 3]);
    lctx.drawImage(white, lights[i] - r, lights[i + 1] - r, r * 2, r * 2);
  }
  lctx.globalAlpha = 1;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(lightCv, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = amb * 0.5;
  for (let i = 0; i < lights.length; i += 5) glow(ctx, lights[i], lights[i + 1], lights[i + 2] * 0.8, lights[i + 4], lights[i + 3] * k);
}

function drawBossBar() {
  const boss = S.monsters.find((m) => m.def.boss && !m.dead);
  if (!boss) return;
  const bw = Math.min(L.w * 0.7, 420), bx = L.w / 2 - bw / 2, by = L.h - 26;
  ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.beginPath(); ctx.roundRect(bx - 6, by - 20, bw + 12, 36, 8); ctx.fill();
  ctx.fillStyle = '#3a0e0e'; ctx.fillRect(bx, by, bw, 10);
  ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.fillRect(bx, by, bw * clamp(boss.hpShown / boss.maxHp, 0, 1), 10);
  ctx.fillStyle = '#e0301a'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 10);
  ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#f2c14e';
  ctx.fillText(`👑 ${boss.def.name}`, L.w / 2, by - 9);
}
function drawBanner() {
  const b = S.banner;
  if (!b) return;
  const a = clamp(Math.min(b.life, b.max - b.life) * 3, 0, 1);
  const fs = Math.round(clamp(L.cs * 0.55, 22, 44));
  const y = L.h * 0.3;
  ctx.globalAlpha = a;
  const gr = ctx.createLinearGradient(0, y - fs * 1.4, 0, y + fs * 1.4);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gr; ctx.fillRect(0, y - fs * 1.4, L.w, fs * 2.8);
  ctx.font = `bold ${fs}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(b.text, L.w / 2, y - fs * 0.15);
  const tg = ctx.createLinearGradient(0, y - fs * 0.7, 0, y + fs * 0.3);
  if (b.boss) { tg.addColorStop(0, '#ffb09a'); tg.addColorStop(1, '#e0301a'); } else { tg.addColorStop(0, '#e8fbff'); tg.addColorStop(1, '#58b8ff'); }
  ctx.fillStyle = tg; ctx.fillText(b.text, L.w / 2, y - fs * 0.15);
  if (b.sub) {
    ctx.font = `italic ${Math.round(fs * 0.45)}px Georgia, serif`;
    ctx.lineWidth = 4; ctx.strokeText(b.sub, L.w / 2, y + fs * 0.7);
    ctx.fillStyle = '#f3e9d8'; ctx.fillText(b.sub, L.w / 2, y + fs * 0.7);
  }
  ctx.globalAlpha = 1;
}

const iconCache = new Map();
function monsterIcon(type, size) {
  const key = 'm' + type + size;
  if (!iconCache.has(key)) {
    const c = document.createElement('canvas'); c.width = c.height = size;
    const def = MONSTERS[type];
    drawPortrait(c, type, def, 0.4, def.armor ? armorFull : null);
    iconCache.set(key, c);
  }
  return iconCache.get(key);
}
function armorFull(g, e) { const p = Object.create(e); p.armor = 1; p.maxArmor = 1; drawArmor(g, p); }
function defIcon(type, size) {
  const key = 'd' + type + size;
  if (!iconCache.has(key)) { const c = document.createElement('canvas'); c.width = c.height = size; drawDefenderIcon(c, type, DEFENDERS[type]); iconCache.set(key, c); }
  return iconCache.get(key);
}
function wrap(text, maxW) {
  const words = text.split(' '), out = [];
  let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { out.push(cur); cur = w; } else cur = t; }
  if (cur) out.push(cur);
  return out;
}
function drawIntro() {
  const it = S.intro;
  if (!it) return;
  const isDef = it.kind === 'def';
  const def = isDef ? DEFENDERS[it.type] : MONSTERS[it.type];
  const k = clamp(Math.min(it.max - it.life, it.life) * 4, 0, 1);
  const w = Math.min(290, L.w - 20), h = 88;
  const x = L.w - w - 10 + (1 - k) * (w + 20);
  const y = L.portrait ? L.h - h - 10 : 10;
  ctx.globalAlpha = k;
  ctx.fillStyle = 'rgba(20,14,10,0.92)'; ctx.beginPath(); ctx.roundRect(x, y, w, h, 12); ctx.fill();
  ctx.strokeStyle = isDef ? '#58b8ff' : def.boss ? '#e0301a' : '#c8963a'; ctx.lineWidth = 2; ctx.stroke();
  ctx.drawImage(isDef ? defIcon(it.type, 128) : monsterIcon(it.type, 128), x + 6, y + 6, 76, 76);
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.font = 'bold 11px Georgia, serif'; ctx.fillStyle = isDef ? '#9ee8ff' : '#ff9a6a';
  ctx.fillText(isDef ? 'NEUER VERTEIDIGER' : def.boss ? 'BOSS' : 'NEUES MONSTER', x + 90, y + 8);
  ctx.font = 'bold 16px Georgia, serif'; ctx.fillStyle = '#f2c14e'; ctx.fillText(def.name, x + 90, y + 21);
  ctx.font = '12px Georgia, serif'; ctx.fillStyle = '#e8dcc8';
  wrap(def.desc, w - 98).slice(0, 3).forEach((ln, i) => ctx.fillText(ln, x + 90, y + 42 + i * 14));
  ctx.globalAlpha = 1;
}

// ================================================================ Karten & HUD
const cardEls = {};
function buildCards() {
  const box = $('cards');
  box.innerHTML = '';
  DEF_KEYS.forEach((k, i) => {
    const def = DEFENDERS[k];
    const b = document.createElement('button');
    b.className = 'card';
    b.dataset.type = k;
    b.title = `${def.name} (${(i + 1) % 10})`;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    drawDefenderIcon(c, k, def);
    b.innerHTML = `<span class="cost">${def.cost}</span><span class="cdm"></span><span class="lock">🔒<small>Welle ${def.unlock}</small></span>`;
    b.prepend(c);
    b.addEventListener('pointerdown', (ev) => cardDown(ev, k));
    box.appendChild(b);
    cardEls[k] = b;
  });
  syncHud(true);
}

const cache = {};
function setText(el, key, v) { if (cache[key] !== v) { cache[key] = v; el.textContent = v; } }
function setFlag(el, key, cls, on) { const ck = key + cls; if (cache[ck] !== on) { cache[ck] = on; el.classList.toggle(cls, on); } }
function syncHud(force) {
  if (!S) return;
  if (force) for (const k in cache) delete cache[k];
  setText($('manaVal'), 'mana', String(Math.floor(S.mana)));
  setText($('waveLbl'), 'wave', S.wave ? `Welle ${S.wave}` : 'Vorbereitung');
  setText($('hearts'), 'hearts', '❤️'.repeat(Math.max(0, S.hearts)) + '🖤'.repeat(Math.max(0, HEARTS - S.hearts)));
  setText($('score'), 'score', `⭐ ${fmt(S.score)}`);
  let lbl, dis = false;
  if (S.phase === 'wave') { lbl = '⚔'; dis = true; } else lbl = S.phase === 'prep' ? '▶ Los!' : '▶ Weiter';
  setText($('btnWave'), 'wb', lbl);
  if (cache.wbd !== dis) { cache.wbd = dis; $('btnWave').disabled = dis; }
  setText($('btnSpeed'), 'spd', `${S.speed}×`);
  setText($('btnPause'), 'pause', S.paused ? '▶' : '⏸');
  for (const k of DEF_KEYS) {
    const el = cardEls[k];
    if (!el) continue;
    const locked = !S.unlocked.has(k);
    setFlag(el, k, 'locked', locked);
    setFlag(el, k, 'poor', !locked && S.mana < DEFENDERS[k].cost);
    setFlag(el, k, 'sel', S.sel === k);
    const cd = S.cardCd[k] / DEFENDERS[k].cd;
    const v = cd > 0 ? Math.round(cd * 100) : 0;
    if (cache['cd' + k] !== v) { cache['cd' + k] = v; el.querySelector('.cdm').style.height = v + '%'; }
  }
  if (S.popup) {
    const ub = $('popup').querySelector('[data-act=up]');
    if (ub) setFlag(ub, 'popup', 'poor', S.mana < upgradeCost(S.popup.d));
  }
}

let toastT = 0;
function toast(msg) {
  const t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1500);
}

// ---------------------------------------------------------------- Popup (Verbessern / Entfernen)
function openPopup(d) {
  S.popup = { d };
  S.sel = null;
  const el = $('popup');
  const maxed = d.level >= MAX_LEVEL;
  el.innerHTML = `
    <div class="ptitle">${d.def.name} <small>Stufe ${d.level}</small></div>
    <div class="prow">
      <button class="btn good" data-act="up" ${maxed ? 'disabled' : ''}>${maxed ? 'Maximal' : `⬆ ${upgradeCost(d)} <span class="mi"></span>`}</button>
      <button class="btn danger" data-act="sell">✖ +${Math.floor(d.spent * 0.25)}</button>
    </div>`;
  el.classList.add('show');
  const p = L.pt(d.c + 0.5, d.l);
  const r = el.getBoundingClientRect();
  let x = p.x - r.width / 2, y = p.y - L.cs * 0.7 - r.height;
  if (y < 4) y = p.y + L.cs * 0.6;
  el.style.left = clamp(x, 4, L.w - r.width - 4) + 'px';
  el.style.top = clamp(y, 4, L.h - r.height - 4) + 'px';
  syncHud(true);
}
function closePopup() { if (S) S.popup = null; $('popup').classList.remove('show'); }
$('popup').addEventListener('click', (ev) => {
  const b = ev.target.closest('[data-act]');
  if (!b || !S || !S.popup) return;
  if (b.dataset.act === 'up') upgrade(S.popup.d); else sell(S.popup.d);
});

// ---------------------------------------------------------------- Eingabe
function local(ev) { const r = canvas.getBoundingClientRect(); return { x: ev.clientX - r.left, y: ev.clientY - r.top }; }
function orbAt(p) {
  let best = null, bd = (L.cs * 0.5) ** 2;
  for (const o of S.orbs) {
    if (o.collected) continue;
    const q = orbScreen(o);
    const d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
function cellAt(p) { const c = L.toCell(p.x, p.y); return { c: c.c, l: c.l }; }

canvas.addEventListener('pointerdown', (ev) => {
  if (!S || S.over || S.paused) return;
  ev.preventDefault();
  const p = local(ev);
  const o = orbAt(p);
  if (o) { collect(o); return; }
  const { c, l } = cellAt(p);
  const inside = c >= 0 && c < COLS && l >= 0 && l < LANES;
  if (S.sel) {
    if (inside && place(S.sel, c, l)) { S.sel = null; S.hover = null; }
    else if (!inside) S.sel = null;
    syncHud(true);
    return;
  }
  const d = inside ? S.grid[l][c] : null;
  if (d && d.type !== 'bomb') { if (S.popup && S.popup.d === d) closePopup(); else openPopup(d); }
  else closePopup();
});
canvas.addEventListener('pointermove', (ev) => {
  if (!S || ev.pointerType !== 'mouse') return;
  const p = local(ev);
  const o = orbAt(p);
  if (o && !S.paused) collect(o);
  S.hover = S.sel ? cellAt(p) : null;
});
canvas.addEventListener('pointerleave', () => { if (S) S.hover = null; });

// Karte antippen = auswählen, Karte ziehen = direkt platzieren
function cardDown(ev, k) {
  if (!S || S.over || S.paused || !S.unlocked.has(k)) return;
  ev.preventDefault();
  closePopup();
  S.drag = { type: k, sx: ev.clientX, sy: ev.clientY, active: false, x: 0, y: 0, cell: null };
}
window.addEventListener('pointermove', (ev) => {
  if (!S || !S.drag) return;
  const d = S.drag;
  if (!d.active && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 10) d.active = true;
  if (d.active) {
    const p = local(ev);
    d.x = p.x; d.y = p.y - (ev.pointerType === 'touch' ? L.cs * 0.6 : 0);
    d.cell = cellAt({ x: d.x, y: d.y });
  }
});
window.addEventListener('pointerup', (ev) => {
  if (!S || !S.drag) return;
  const d = S.drag;
  S.drag = null;
  if (d.active) {
    if (d.cell && d.cell.c >= 0 && d.cell.c < COLS && d.cell.l >= 0 && d.cell.l < LANES) place(d.type, d.cell.c, d.cell.l);
    S.sel = null;
  } else {
    S.sel = S.sel === d.type ? null : d.type;
    if (S.sel && S.mana < DEFENDERS[d.type].cost) toast('Nicht genug Mana!');
    else if (S.sel && S.cardCd[d.type] > 0) toast('Lädt noch auf …');
  }
  syncHud(true);
});

window.addEventListener('keydown', (ev) => {
  if (!S || S.over) return;
  const k = ev.key.toLowerCase();
  if (k === ' ') { ev.preventDefault(); togglePause(); return; }
  if (S.paused) return;
  if (/^[0-9]$/.test(k)) {
    const t = DEF_KEYS[(+k + 9) % 10];
    if (t && S.unlocked.has(t)) { S.sel = S.sel === t ? null : t; closePopup(); syncHud(true); }
  } else if (k === 'escape') { S.sel = null; closePopup(); syncHud(true); }
  else if (k === 'f') $('btnSpeed').click();
  else if (k === 'n' || k === 'enter') startWave();
});
document.addEventListener('visibilitychange', () => { if (document.hidden && S && !S.over && !S.paused) togglePause(true); });

$('btnWave').addEventListener('click', () => startWave());
$('btnSpeed').addEventListener('click', () => { if (S) { S.speed = S.speed % 3 + 1; syncHud(); } });
$('btnPause').addEventListener('click', () => togglePause());
function togglePause(force) {
  if (!S || S.over) return;
  S.paused = force !== undefined ? force : !S.paused;
  if (S.paused) showPause(); else hideOverlay();
  syncHud();
}

// ================================================================ Overlays
const overlay = $('overlay');
let overlayAnim = 0;
function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; cancelAnimationFrame(overlayAnim); }
function settingsButtons() {
  return `<button class="btn" data-set="quality">🎨 Grafik: ${isHigh() ? 'Hoch' : 'Schnell'}</button>
          <button class="btn" data-set="auto">💎 Auto-Sammeln: ${settings.autoCollect ? 'An' : 'Aus'}</button>`;
}
function bindSettings() {
  overlay.querySelectorAll('[data-set]').forEach((b) => {
    b.onclick = () => {
      if (b.dataset.set === 'quality') { settings.quality = isHigh() ? 'low' : 'high'; setFlat(!isHigh()); resize(); iconCache.clear(); b.textContent = `🎨 Grafik: ${isHigh() ? 'Hoch' : 'Schnell'}`; }
      else { settings.autoCollect = !settings.autoCollect; b.textContent = `💎 Auto-Sammeln: ${settings.autoCollect ? 'An' : 'Aus'}`; }
      saveJSON(SETTINGS_KEY, settings);
    };
  });
}

function showMenu() {
  if (S) S.over = true;
  const best = loadJSON(BEST_KEY, null);
  overlay.innerHTML = `
    <div class="panel menu">
      <canvas class="hero" width="520" height="200"></canvas>
      <h1>Kristallwacht</h1>
      <p class="sub">Verteidige die Burg gegen endlose Monsterhorden!</p>
      ${best ? `<p class="rec">🏆 Rekord: Welle ${best.wave} · ${fmt(best.score)} Punkte</p>` : ''}
      <div class="buttons">
        <button class="btn primary big" id="ovPlay">▶ Spielen</button>
        <button class="btn" id="ovBook">📖 Kompendium</button>
      </div>
      <div class="buttons small">${settingsButtons()}</div>
      <details class="help"><summary>📜 Wie wird gespielt?</summary><ul>
        <li>Monster kommen aus dem Wald und laufen in ihrer Reihe auf die Burg zu.</li>
        <li>Tippe eine Karte an und dann ein Feld – oder ziehe die Karte direkt aufs Feld.</li>
        <li>Verteidiger kosten Mana 💎. Pflanze <b>Manablüten</b> und sammle die Kristalle durch Antippen ein. Tagsüber fällt auch Mana vom Himmel.</li>
        <li>Tippe einen Verteidiger an, um ihn zu verbessern oder zu entfernen.</li>
        <li>Erreicht ein Monster die Mauer, rollt der Wächterfels der Reihe los (er kehrt nach 3 Wellen zurück). Ist er schon weg, verlierst du ein Herz.</li>
        <li>Alle 10 Wellen kommt ein Boss – in der Nacht.</li>
      </ul></details>
      <p class="old"><a href="runenwacht/">⚔️ Das alte Spiel „Runenwacht“ spielen</a></p>
    </div>`;
  drawHero(overlay.querySelector('.hero'));
  $('ovPlay').onclick = () => newGame();
  $('ovBook').onclick = () => showBook(showMenu);
  bindSettings();
  overlay.classList.add('show');
}

function drawHero(c) {
  const g = c.getContext('2d');
  const t0 = performance.now();
  const mons = ['goblin', 'shieldorc', 'troll', 'skeleton', 'bat'];
  const defs = ['archer', 'bloom', 'wall', 'frost'];
  const frame = () => {
    const t = (performance.now() - t0) / 1000;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, c.width, c.height);
    defs.forEach((k, i) => {
      g.setTransform(1.1, 0, 0, 1.1, 50 + i * 70, 150);
      drawDefender(g, { type: k, def: DEFENDERS[k], level: 1, hp: 1, maxHp: 1, charge: (t * 0.7 + i * 0.3) % 1, prodReady: 0.5, wob: i }, t, { noUi: true });
    });
    mons.forEach((k, i) => {
      const def = MONSTERS[k];
      const s = 2.1;
      g.setTransform(s, 0, 0, s, 330 + i * 42 + (k === 'troll' ? 10 : 0), 160);
      const e = { type: k, art: def.art, def, x: 0, y: 9 - def.r * 0.45, r: def.r, wob: i * 2, face: -1, hp: 1, maxHp: 1, armor: 1, maxArmor: 1, slowT: 0, burnT: 0 };
      drawEnemy(g, e, t, { noBar: true, extra: def.armor ? armorExtra : null });
    });
    overlayAnim = requestAnimationFrame(frame);
  };
  frame();
}

function showBook(back) {
  cancelAnimationFrame(overlayAnim);
  const mons = Object.keys(MONSTERS);
  overlay.innerHTML = `
    <div class="panel wide">
      <h2>📖 Kompendium</h2>
      <div class="book">
        <h3>Verteidiger</h3>
        <div class="grid">${DEF_KEYS.map((k) => { const d = DEFENDERS[k]; return `
          <div class="entry"><canvas width="120" height="120" data-d="${k}"></canvas><div>
            <b>${d.name}</b><small>💎 ${d.cost} · ab Welle ${d.unlock}</small><p>${d.desc}</p></div></div>`; }).join('')}</div>
        <h3>Monster</h3>
        <div class="grid">${mons.map((k) => { const d = MONSTERS[k]; return `
          <div class="entry${d.boss ? ' boss' : ''}"><canvas width="120" height="120" data-m="${k}"></canvas><div>
            <b>${d.name}</b><small>${d.boss ? `Boss · Welle ${(BOSS_ORDER.indexOf(k) + 1) * 10}` : `ab Welle ${d.unlock}`}</small><p>${d.desc}</p>
            <div class="traits">${monsterTraits(d).map((t) => `<span>${t}</span>`).join('')}</div></div></div>`; }).join('')}</div>
      </div>
      <div class="buttons"><button class="btn primary" id="ovBack">← Zurück</button></div>
    </div>`;
  const dcs = [...overlay.querySelectorAll('canvas[data-d]')], mcs = [...overlay.querySelectorAll('canvas[data-m]')];
  const t0 = performance.now();
  const anim = () => {
    const t = (performance.now() - t0) / 1000;
    for (const c of dcs) {
      const g = c.getContext('2d'); const k = c.dataset.d;
      g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, c.width, c.height);
      g.setTransform(1.45, 0, 0, 1.45, 60, 66);
      drawDefender(g, { type: k, def: DEFENDERS[k], level: 1, hp: 1, maxHp: 1, charge: (t * 0.6) % 1, prodReady: (t * 0.3) % 1, armed: true, fuse: 0.45, wob: 0 }, t, { noUi: true });
    }
    for (const c of mcs) drawPortrait(c, c.dataset.m, MONSTERS[c.dataset.m], t, MONSTERS[c.dataset.m].armor ? armorFull : null);
    overlayAnim = requestAnimationFrame(anim);
  };
  anim();
  $('ovBack').onclick = () => { cancelAnimationFrame(overlayAnim); back(); };
  overlay.classList.add('show');
  overlay.scrollTop = 0;
}

function showPause() {
  overlay.innerHTML = `
    <div class="panel" style="max-width:460px">
      <h2>⏸ Pause</h2>
      <p class="big">Welle <b>${S.wave}</b> · ⭐ <b>${fmt(S.score)}</b></p>
      <div class="buttons">
        <button class="btn primary" id="ovResume">▶ Weiter</button>
        <button class="btn" id="ovBook">📖 Kompendium</button>
      </div>
      <div class="buttons small">${settingsButtons()}</div>
      <div class="buttons"><button class="btn danger" id="ovQuit">🏳 Aufgeben</button></div>
    </div>`;
  $('ovResume').onclick = () => togglePause(false);
  $('ovBook').onclick = () => showBook(showPause);
  $('ovQuit').onclick = () => { S.paused = false; gameOver(true); };
  bindSettings();
  overlay.classList.add('show');
}

function gameOver(gaveUp) {
  if (S.over) return;
  S.over = true;
  closePopup();
  const best = loadJSON(BEST_KEY, null);
  const rec = S.wave > 0 && (!best || S.wave > best.wave || (S.wave === best.wave && S.score > best.score));
  if (rec) saveJSON(BEST_KEY, { wave: S.wave, score: S.score });
  setTimeout(() => {
    overlay.innerHTML = `
      <div class="panel" style="max-width:460px">
        <h2>${gaveUp ? '🏳 Rückzug!' : '💀 Die Monster haben die Burg gestürmt!'}</h2>
        <p class="big">Erreichte Welle: <b>${S.wave}</b></p>
        <p class="big">Besiegte Monster: <b>${S.kills}</b> · Punkte: <b>${fmt(S.score)}</b></p>
        ${rec ? '<p class="rec">🏆 Neuer Rekord!</p>' : best ? `<p class="sub">Rekord: Welle ${best.wave} · ${fmt(best.score)}</p>` : ''}
        <div class="buttons">
          <button class="btn primary big" id="ovAgain">↻ Nochmal</button>
          <button class="btn" id="ovMenu">🏰 Hauptmenü</button>
        </div>
      </div>`;
    $('ovAgain').onclick = () => newGame();
    $('ovMenu').onclick = showMenu;
    overlay.classList.add('show');
  }, gaveUp ? 0 : 900);
}

// ================================================================ Hauptschleife
new ResizeObserver(resize).observe($('stage'));
window.addEventListener('resize', resize);

// Mana-Symbol
{
  const c = $('manaIcon'), g = c.getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0);
  drawOrb(g, c.width / 2, c.height / 2, c.width / 40, 0.6);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (S && !S.paused && !S.over) {
    for (let i = 0; i < S.speed && !S.over; i++) update(dt);
    syncHud();
  } else if (S && S.over) {
    for (const fx of S.effects) fx.life -= dt;
    S.effects = S.effects.filter((fx) => fx.life > 0);
  }
  render(now / 1000);
  requestAnimationFrame(frame);
}
resize();
showMenu();
requestAnimationFrame(frame);

window.__kw = { get state() { return S; }, get layout() { return L; }, update, render, startWave, spawnMonster, place, newGame };
