'use strict';
(() => {
  // ================================================================
  //  Runenwacht – Endloser Fantasy Tower Defense
  // ================================================================
  const TILE = 48, COLS = 20, ROWS = 12, W = COLS * TILE, H = ROWS * TILE;
  const TAU = Math.PI * 2;
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------- Daten
  const MAPS = [
    {
      id: 'hain', name: 'Grüner Hain', diff: 1,
      desc: 'Ein verwunschener Waldweg – ideal für den Einstieg.',
      theme: { grass: ['#4c8a3a', '#55963f', '#47813a', '#5a9a45'], path: '#cfae74', edge: '#8f6d3e', deco: 'forest' },
      points: [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [17, 9], [17, 5], [20, 5]],
    },
    {
      id: 'pass', name: 'Schlangenpass', diff: 1.25,
      desc: 'Ein langer Pfad durch die Herbsthügel. Die Monster sind zäher.',
      theme: { grass: ['#8a8a3e', '#96933f', '#7f7f38', '#a08f3e'], path: '#d8c08a', edge: '#8c7240', deco: 'autumn' },
      points: [[-1, 1], [17, 1], [17, 4], [2, 4], [2, 7], [17, 7], [17, 10], [20, 10]],
    },
    {
      id: 'vulkan', name: 'Feuerschlund', diff: 1.5,
      desc: 'Glühende Lava und die stärksten Monster. Nur für Helden!',
      theme: { grass: ['#3d302c', '#45362f', '#382b27', '#4a3a31'], path: '#8c6a4f', edge: '#4a3020', deco: 'lava' },
      points: [[-1, 10], [3, 10], [3, 2], [8, 2], [8, 9], [13, 9], [13, 2], [17, 2], [17, 10], [20, 10]],
    },
  ];

  const TOWERS = {
    archer: {
      name: 'Bogenschützen', icon: '🏹', cost: 50, color: '#3f8f3a', air: true, kind: 'phys',
      desc: 'Schnelle Pfeile. Trifft auch fliegende Gegner.',
      dmg: [9, 15, 25, 42], range: [3, 3.3, 3.7, 4.2], rate: [1.5, 1.8, 2.2, 2.8],
    },
    cannon: {
      name: 'Zwergenkanone', icon: '💣', cost: 80, color: '#7a7a7a', air: false, kind: 'phys',
      desc: 'Explosiver Flächenschaden. Kann keine Flieger treffen.',
      dmg: [24, 40, 68, 115], range: [2.6, 2.8, 3.1, 3.4], rate: [0.55, 0.6, 0.7, 0.8], splash: [0.9, 1, 1.15, 1.3],
    },
    frost: {
      name: 'Frostkristall', icon: '❄️', cost: 70, color: '#5bc8f0', air: true, kind: 'magic',
      desc: 'Verlangsamt alle Gegner rund um den Einschlag.',
      dmg: [4, 7, 11, 18], range: [2.6, 2.8, 3, 3.3], rate: [1, 1.1, 1.25, 1.4], slow: [0.35, 0.45, 0.55, 0.62], splash: [0.7, 0.8, 0.9, 1],
    },
    storm: {
      name: 'Sturmturm', icon: '⚡', cost: 120, color: '#f5d742', air: true, kind: 'magic',
      desc: 'Kettenblitz, der zwischen mehreren Gegnern springt.',
      dmg: [16, 27, 45, 75], range: [2.8, 3, 3.3, 3.6], rate: [0.8, 0.9, 1, 1.15], chain: [3, 4, 5, 7],
    },
    arcane: {
      name: 'Arkaner Turm', icon: '🔮', cost: 140, color: '#a35cf0', air: true, kind: 'magic',
      desc: 'Riesige Reichweite und gewaltiger Einzelschaden, aber langsam.',
      dmg: [60, 105, 180, 300], range: [4.5, 5, 5.6, 6.5], rate: [0.4, 0.43, 0.47, 0.52],
    },
    fire: {
      name: 'Drachenfeuer', icon: '🔥', cost: 130, color: '#ff6a2a', air: true, kind: 'magic',
      desc: 'Feuerwelle trifft alle Gegner in der Nähe und setzt sie in Brand.',
      dmg: [10, 17, 28, 46], range: [1.7, 1.85, 2, 2.2], rate: [0.9, 1, 1.1, 1.2], burn: [8, 14, 24, 40],
    },
  };
  const TOWER_KEYS = Object.keys(TOWERS);
  const UPGRADE_FACTOR = [0.9, 1.5, 2.4];
  const MAX_LEVEL = 4;
  const TARGET_MODES = ['first', 'last', 'strong', 'near'];
  const TARGET_LABEL = { first: 'Vorderster', last: 'Hinterster', strong: 'Stärkster', near: 'Nächster' };

  const ENEMIES = {
    goblin:   { name: 'Goblin',      hp: 28,   speed: 1.6,  gold: 4,   r: 9,  color: '#6fbf3a' },
    wolf:     { name: 'Schattenwolf', hp: 20,  speed: 2.6,  gold: 4,   r: 10, color: '#8f8f9a' },
    orc:      { name: 'Ork',         hp: 75,   speed: 1.05, gold: 7,   r: 12, color: '#4d7a2e' },
    bat:      { name: 'Riesenfledermaus', hp: 26, speed: 2.0, gold: 5, r: 9,  color: '#6b3fa0', flying: true },
    slime:    { name: 'Schleim',     hp: 80,   speed: 1.0,  gold: 5,   r: 12, color: '#3fd0a0', split: 'slimelet' },
    slimelet: { name: 'Schleimling', hp: 25,   speed: 1.5,  gold: 2,   r: 7,  color: '#62e2bb' },
    shaman:   { name: 'Schamane',    hp: 60,   speed: 1.1,  gold: 10,  r: 10, color: '#b03a3a', healer: true },
    golem:    { name: 'Steingolem',  hp: 200,  speed: 0.7,  gold: 14,  r: 14, color: '#8a7c6a', armor: 0.5, lives: 2 },
    troll:    { name: 'Trollkönig',  hp: 1400, speed: 0.55, gold: 120, r: 22, color: '#4f8f7a', boss: true, lives: 10, armor: 0.25, regen: 0.01 },
    dragon:   { name: 'Uralter Drache', hp: 1300, speed: 0.75, gold: 150, r: 22, color: '#c0392b', boss: true, flying: true, lives: 10 },
    lich:     { name: 'Lichkönig',   hp: 1600, speed: 0.6,  gold: 180, r: 20, color: '#5b2a86', boss: true, lives: 10, summon: true },
  };

  const START_GOLD = 220, START_LIVES = 20;
  const METEOR_CD = 45, METEOR_RADIUS = 1.6 * TILE;
  const STORE_KEY = 'runenwacht-best-v1';

  // ---------------------------------------------------------------- Hilfsfunktionen
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  function seeded(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function fmt(n) {
    n = Math.floor(n);
    if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
    if (n >= 1e4) return (n / 1e3).toFixed(1) + 'k';
    return String(n);
  }
  function circle(x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
  function ellipse(x, y, rx, ry, fill, rot = 0) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }

  function loadBest() { try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; } catch { return {}; } }
  function saveBest(b) { try { localStorage.setItem(STORE_KEY, JSON.stringify(b)); } catch { /* ignore */ } }

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

  // ---------------------------------------------------------------- Hintergrund (vorgerendert)
  function renderBackground(map, path) {
    const SC = 2;
    const c = document.createElement('canvas');
    c.width = W * SC; c.height = H * SC;
    const g = c.getContext('2d');
    g.scale(SC, SC);
    const rnd = seeded(map.id.length * 9973 + map.points.length * 31);
    const th = map.theme;

    // Gras
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        g.fillStyle = th.grass[Math.floor(rnd() * th.grass.length)];
        g.fillRect(col * TILE, r * TILE, TILE + 1, TILE + 1);
      }
    }
    // weiche Flecken
    for (let i = 0; i < 140; i++) {
      g.globalAlpha = 0.045;
      g.fillStyle = rnd() < 0.5 ? '#000' : '#fff';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, 10 + rnd() * 40, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;

    // Lava-Ströme (Vulkan)
    if (th.deco === 'lava') {
      for (let i = 0; i < 9; i++) {
        let x = rnd() * W, y = rnd() * H;
        g.strokeStyle = '#ff6a1a'; g.lineWidth = 3 + rnd() * 3; g.lineCap = 'round';
        g.shadowColor = '#ff4400'; g.shadowBlur = 12;
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += rand(-30, 30) * (rnd() + 0.5); y += rand(-30, 30) * (rnd() + 0.5); g.lineTo(x, y); }
        g.stroke();
      }
      g.shadowBlur = 0;
    }

    // Weg
    const drawLine = (w, col) => {
      g.strokeStyle = col; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'butt';
      g.beginPath();
      path.pts.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
      g.stroke();
    };
    drawLine(TILE * 0.98, 'rgba(0,0,0,0.25)');
    drawLine(TILE * 0.9, th.edge);
    drawLine(TILE * 0.74, th.path);
    // Kiesel & Spuren
    for (const idx of path.tiles) {
      const tx = (idx % COLS) * TILE, ty = Math.floor(idx / COLS) * TILE;
      for (let k = 0; k < 5; k++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,255,255,0.15)';
        g.beginPath();
        g.ellipse(tx + 10 + rnd() * 28, ty + 10 + rnd() * 28, 1.5 + rnd() * 2.5, 1 + rnd() * 2, rnd() * 3, 0, TAU);
        g.fill();
      }
    }

    // Dekoration auf freien Feldern
    for (let r = 0; r < ROWS; r++) {
      for (let col = 0; col < COLS; col++) {
        if (path.tiles.has(r * COLS + col)) continue;
        const cx = col * TILE, cy = r * TILE;
        const n = 2 + Math.floor(rnd() * 4);
        for (let k = 0; k < n; k++) {
          const x = cx + 6 + rnd() * 36, y = cy + 6 + rnd() * 36, v = rnd();
          if (th.deco === 'lava') {
            if (v < 0.3) { g.fillStyle = '#2a201d'; g.beginPath(); g.ellipse(x, y, 3 + rnd() * 4, 2 + rnd() * 3, 0, 0, TAU); g.fill(); }
            else if (v < 0.36) { g.fillStyle = '#ff8a2a'; g.globalAlpha = 0.7; g.beginPath(); g.arc(x, y, 1.5, 0, TAU); g.fill(); g.globalAlpha = 1; }
            else if (v < 0.5) { g.strokeStyle = '#5a4a3f'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-6, 6), y + rand(-6, 6)); g.stroke(); }
          } else {
            if (v < 0.45) {
              // Grasbüschel
              g.strokeStyle = th.deco === 'autumn' ? '#6a6a2a' : '#356e2a'; g.lineWidth = 1.3;
              g.beginPath();
              g.moveTo(x, y); g.lineTo(x - 2, y - 5);
              g.moveTo(x, y); g.lineTo(x, y - 6);
              g.moveTo(x, y); g.lineTo(x + 2, y - 5);
              g.stroke();
            } else if (v < 0.55) {
              const cols = th.deco === 'autumn' ? ['#e07a2a', '#c94a2a', '#f2c14e'] : ['#f5e663', '#ff8fb5', '#ffffff', '#9ec9ff'];
              g.fillStyle = cols[Math.floor(rnd() * cols.length)];
              g.beginPath(); g.arc(x, y, 1.8, 0, TAU); g.fill();
            } else if (v < 0.58) {
              g.fillStyle = '#8a8580'; g.beginPath(); g.ellipse(x, y, 3.5, 2.5, 0, 0, TAU); g.fill();
              g.fillStyle = '#aaa59f'; g.beginPath(); g.ellipse(x - 1, y - 1, 1.8, 1.2, 0, 0, TAU); g.fill();
            }
          }
        }
      }
    }

    // Vignette
    const vg = g.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, W * 0.65);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, W, H);
    return c;
  }

  // Vorgerenderte Karten (auch für die Vorschau im Menü)
  const PREPARED = MAPS.map((m) => { const p = buildPath(m); return { path: p, bg: renderBackground(m, p) }; });

  // ---------------------------------------------------------------- Spielzustand
  let S = null;
  const view = { k: 1 };

  function newGame(mapIdx) {
    const map = MAPS[mapIdx];
    S = {
      map, mapIdx,
      path: PREPARED[mapIdx].path,
      bg: PREPARED[mapIdx].bg,
      gold: START_GOLD, lives: START_LIVES, wave: 0, score: 0,
      towers: [], grid: new Array(COLS * ROWS).fill(null),
      enemies: [], newEnemies: [], projectiles: [], effects: [], particles: [], texts: [],
      spawners: [], waveRunning: false, nextTimer: -1,
      time: 0, speed: 1, paused: false, over: false, auto: S ? S.auto : true,
      selected: null, buildType: null, ghost: null, hover: null,
      spellMode: false, meteorCd: 0,
      shake: 0, hurtFlash: 0, banner: null,
    };
    hideOverlay();
    renderInfo();
    syncHud(true);
  }

  // Skalierung der Gegner pro Welle
  const hpMult = (w) => S.map.diff * (1 + 0.1 * (w - 1)) * Math.pow(1.05, w - 1);
  const goldMult = (w) => 1 + 0.05 * (w - 1);

  // ---------------------------------------------------------------- Wellen
  function makeWave(w) {
    const list = [];
    const pool = [['goblin', 1, 5], ['wolf', 3, 3], ['orc', 4, 4], ['bat', 5, 3], ['slime', 7, 3], ['shaman', 9, 2], ['golem', 11, 2]]
      .filter((u) => w >= u[1]);
    const total = pool.reduce((s, u) => s + u[2], 0);
    const pick = () => {
      let v = Math.random() * total;
      for (const u of pool) { v -= u[2]; if (v <= 0) return u[0]; }
      return pool[0][0];
    };
    let n = Math.floor(6 + w * 1.25);
    let interval = Math.max(0.3, 0.95 - w * 0.015);
    let boss = null;

    if (w % 10 === 0) {
      boss = ['troll', 'dragon', 'lich'][(w / 10 - 1) % 3];
      n = Math.floor(n * 0.6);
      for (let i = 0; i < n; i++) list.push(pick());
      const bosses = 1 + Math.floor(w / 40);
      for (let i = 0; i < bosses; i++) list.push(boss);
    } else if (w % 5 === 0) {
      const sw = ['wolf', 'goblin', 'bat', 'slime'][(w / 5 - 1) % 4];
      n = Math.floor(n * 1.6);
      for (let i = 0; i < n; i++) list.push(sw);
      interval *= 0.55;
    } else {
      for (let i = 0; i < n; i++) list.push(pick());
    }
    return { list, interval, boss };
  }

  function startWave() {
    if (!S || S.over || S.spawners.length) return;
    // Bonus für frühes Rufen
    let bonus = 0;
    if (S.waveRunning) bonus = 10 + S.wave * 2;
    else if (S.nextTimer > 0) bonus = Math.ceil(S.nextTimer) * 2;
    if (bonus > 0) {
      S.gold += bonus;
      floatText(W / 2, 40, `+${bonus} 💰 Frühstart`, '#f2c14e');
    }
    S.wave++;
    S.waveRunning = true;
    S.nextTimer = -1;
    const wv = makeWave(S.wave);
    S.spawners.push({ queue: wv.list, t: 0, interval: wv.interval, wave: S.wave });
    S.banner = { text: wv.boss ? `Welle ${S.wave} – ${ENEMIES[wv.boss].name}!` : `Welle ${S.wave}`, life: 2.2, boss: !!wv.boss };
  }

  function spawnEnemy(type, wave, d = 0) {
    const def = ENEMIES[type];
    const hp = def.hp * hpMult(wave);
    const e = {
      type, def, wave, hp, maxHp: hp, speed: def.speed, d, x: -TILE, y: 0, ang: 0,
      slowT: 0, slowF: 0, burnT: 0, burnDps: 0,
      armor: def.armor || 0, flying: !!def.flying, r: def.r,
      gold: Math.max(1, Math.round(def.gold * goldMult(wave))),
      off: def.boss ? 0 : rand(-7, 7), wob: Math.random() * 10, timer: 0, hitFlash: 0, dead: false,
    };
    placeEnemy(e);
    S.newEnemies.push(e);
    return e;
  }
  function placeEnemy(e) {
    const p = posAt(S.path, e.d);
    e.ang = p.ang;
    e.x = p.x - Math.sin(p.ang) * e.off;
    e.y = p.y + Math.cos(p.ang) * e.off;
  }

  // ---------------------------------------------------------------- Kampf
  function hurt(e, amount, kind, src) {
    if (e.dead) return;
    if (kind === 'phys') amount *= 1 - e.armor;
    e.hp -= amount;
    e.hitFlash = 0.07;
    if (e.hp <= 0) kill(e, src);
  }

  function kill(e, src) {
    e.dead = true;
    S.gold += e.gold;
    S.score += Math.round(e.def.gold * 10 * S.map.diff * (1 + S.wave * 0.05));
    if (src) src.kills++;
    floatText(e.x, e.y - e.r - 6, `+${e.gold}`, '#f2c14e');
    burst(e.x, e.y, e.def.color, e.def.boss ? 60 : 12, e.def.boss ? 4 : 2);
    if (e.def.boss) { S.shake = 0.5; burst(e.x, e.y, '#f2c14e', 40, 3); }
    if (e.def.split) {
      for (const dd of [-10, 6]) {
        const s = spawnEnemy(e.def.split, e.wave, Math.max(0, e.d + dd));
        s.off = e.off + rand(-6, 6);
      }
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

  // ---------------------------------------------------------------- Effekte
  function burst(x, y, color, n, speed = 2) {
    for (let i = 0; i < n && S.particles.length < 700; i++) {
      const a = Math.random() * TAU, v = rand(20, 80) * speed;
      S.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.3, 0.7), max: 0.7, color, size: rand(1.5, 3.5), grav: 60 });
    }
  }
  function floatText(x, y, text, color) {
    S.texts.push({ x, y, text, color, life: 1.1 });
  }
  function ring(x, y, r1, color, life = 0.35, r0 = 4) {
    S.effects.push({ type: 'ring', x, y, r0, r1, color, life, max: life });
  }

  // ---------------------------------------------------------------- Türme
  function canBuild(c, r) {
    return c >= 0 && c < COLS && r >= 0 && r < ROWS && !S.path.tiles.has(r * COLS + c) && !S.grid[r * COLS + c];
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
    burst(t.x, t.y + 8, '#cbbfa8', 14, 1.2);
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
    ring(t.x, t.y, TILE, '242,193,78', 0.5);
    burst(t.x, t.y - 10, '#f2c14e', 20, 1.5);
    renderInfo();
  }

  function sellSelected() {
    const t = S.selected;
    if (!t) return;
    const v = sellValue(t);
    S.gold += v;
    floatText(t.x, t.y - 20, `+${v}`, '#f2c14e');
    burst(t.x, t.y, '#a19c95', 18, 1.5);
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
      if (t.cd > 0) return;
      let any = false;
      for (const e of S.enemies) {
        if (e.dead || !inRange(t, e, range + e.r)) continue;
        any = true;
        hurt(e, def.dmg[L], 'magic', t);
        e.burnT = 2.5;
        e.burnDps = Math.max(e.burnDps, def.burn[L]);
        e.burnSrc = t;
      }
      if (any) {
        t.cd = 1 / def.rate[L];
        t.flash = 1;
        ring(t.x, t.y - 6, range, '255,120,40', 0.45, 10);
        for (let i = 0; i < 16; i++) {
          const a = (i / 16) * TAU;
          S.particles.push({ x: t.x, y: t.y - 6, vx: Math.cos(a) * range * 2, vy: Math.sin(a) * range * 2, life: 0.35, max: 0.4, color: i % 2 ? '#ffb02a' : '#ff5a1a', size: 4, grav: 0 });
        }
      }
      return;
    }

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
    const sx = t.x, sy = t.y - 14;

    switch (t.type) {
      case 'archer':
        S.projectiles.push({ kind: 'arrow', x: sx, y: sy, target, tx: target.x, ty: target.y, speed: 620, dmg, src: t });
        break;
      case 'arcane':
        S.projectiles.push({ kind: 'arcane', x: sx, y: sy - 6, target, tx: target.x, ty: target.y, speed: 520, dmg, src: t });
        break;
      case 'frost':
        S.projectiles.push({ kind: 'frost', x: sx, y: sy - 4, target, tx: target.x, ty: target.y, speed: 420, dmg, src: t,
          slow: def.slow[L], radius: def.splash[L] * TILE });
        break;
      case 'cannon': {
        const dist = Math.hypot(target.x - sx, target.y - sy);
        const time = dist / 360;
        const lead = posAt(S.path, target.d + target.speed * TILE * (target.slowT > 0 ? 1 - target.slowF : 1) * time);
        S.projectiles.push({ kind: 'ball', x: sx, y: sy, sx, sy, tx: lead.x, ty: lead.y, t: 0, dur: Math.max(0.15, time), dmg, src: t,
          radius: def.splash[L] * TILE });
        break;
      }
      case 'storm': {
        const hit = new Set([target]);
        const pts = [{ x: t.x, y: t.y - 30 }, { x: target.x, y: target.y }];
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
          pts.push({ x: next.x, y: next.y });
          cur = next;
        }
        S.effects.push({ type: 'bolt', pts: jagged(pts), life: 0.22, max: 0.22 });
        break;
      }
    }
  }

  function jagged(pts) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const n = 5;
      for (let k = 1; k < n; k++) {
        const t = k / n;
        out.push({ x: a.x + (b.x - a.x) * t + rand(-7, 7), y: a.y + (b.y - a.y) * t + rand(-7, 7) });
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
      p.y = p.sy + (p.ty - p.sy) * k - Math.sin(k * Math.PI) * 40;
      if (k >= 1) {
        p.done = true;
        splash(p.tx, p.ty, p.radius, (e) => hurt(e, p.dmg, 'phys', p.src), false);
        ring(p.tx, p.ty, p.radius, '255,190,90', 0.35);
        burst(p.tx, p.ty, '#ffb04a', 14, 1.6);
        burst(p.tx, p.ty, '#555', 8, 1);
      }
      return;
    }
    if (p.target && !p.target.dead) { p.tx = p.target.x; p.ty = p.target.y - (p.target.flying ? 10 : 0); }
    const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), step = p.speed * dt;
    p.ang = Math.atan2(dy, dx);
    if (p.kind === 'arcane' && Math.random() < 0.8) {
      S.particles.push({ x: p.x, y: p.y, vx: rand(-15, 15), vy: rand(-15, 15), life: 0.3, max: 0.3, color: '#c99bff', size: 2.5, grav: 0 });
    }
    if (dist <= step + 2) {
      p.done = true;
      const alive = p.target && !p.target.dead;
      if (p.kind === 'arrow') {
        if (alive) hurt(p.target, p.dmg, 'phys', p.src);
      } else if (p.kind === 'arcane') {
        if (alive) hurt(p.target, p.dmg, 'magic', p.src);
        burst(p.tx, p.ty, '#c99bff', 10, 1.2);
      } else if (p.kind === 'frost') {
        splash(p.tx, p.ty, p.radius, (e) => {
          hurt(e, p.dmg, 'magic', p.src);
          const f = e.def.boss ? p.slow * 0.5 : p.slow;
          if (f >= e.slowF || e.slowT <= 0) e.slowF = f;
          e.slowT = 1.6;
        });
        ring(p.tx, p.ty, p.radius, '150,220,255', 0.35);
        burst(p.tx, p.ty, '#c8f0ff', 8, 1);
      }
      return;
    }
    p.x += (dx / dist) * step;
    p.y += (dy / dist) * step;
  }

  // ---------------------------------------------------------------- Gegner
  function updateEnemy(e, dt) {
    e.hitFlash = Math.max(0, e.hitFlash - dt);
    let f = 1;
    if (e.slowT > 0) { e.slowT -= dt; f = 1 - e.slowF; } else e.slowF = 0;
    e.d += e.speed * TILE * f * dt;

    if (e.burnT > 0) {
      e.burnT -= dt;
      hurt(e, e.burnDps * dt, 'magic', e.burnSrc);
      if (Math.random() < dt * 14) S.particles.push({ x: e.x + rand(-5, 5), y: e.y - 4, vx: rand(-8, 8), vy: -40, life: 0.4, max: 0.4, color: Math.random() < 0.5 ? '#ff8a2a' : '#ffd23a', size: 2.5, grav: -20 });
      if (e.burnT <= 0) e.burnDps = 0;
    }
    if (e.dead) return;
    if (e.def.regen) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * e.def.regen * dt);
    if (e.def.healer) {
      e.timer += dt;
      if (e.timer > 2.5) {
        e.timer = 0;
        let healed = false;
        for (const o of S.enemies) {
          if (o.dead || o === e || o.hp >= o.maxHp) continue;
          if ((o.x - e.x) ** 2 + (o.y - e.y) ** 2 > (1.7 * TILE) ** 2) continue;
          o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12);
          healed = true;
        }
        if (healed) ring(e.x, e.y, 1.7 * TILE, '120,255,120', 0.5);
      }
    }
    if (e.def.summon) {
      e.timer += dt;
      if (e.timer > 4) {
        e.timer = 0;
        for (let i = 0; i < 2; i++) { const s = spawnEnemy('goblin', e.wave, Math.max(0, e.d - 20 - i * 12)); s.off = rand(-9, 9); }
        ring(e.x, e.y, TILE, '180,100,255', 0.5);
      }
    }
    if (e.d >= S.path.len) {
      e.dead = true;
      const dmg = e.def.lives || 1;
      S.lives = Math.max(0, S.lives - dmg);
      S.shake = Math.min(0.6, S.shake + 0.2 + dmg * 0.03);
      S.hurtFlash = 0.4;
      floatText(W - 40, e.y - 20, `-${dmg} ❤️`, '#ff5a4a');
      return;
    }
    placeEnemy(e);
  }

  // ---------------------------------------------------------------- Meteor
  function castMeteor(x, y) {
    if (S.meteorCd > 0) return;
    S.meteorCd = METEOR_CD;
    S.spellMode = false;
    S.effects.push({ type: 'meteor', x, y, t: 0.55, max: 0.55 });
    renderInfo();
  }
  function meteorImpact(m) {
    const dmg = 140 * hpMult(Math.max(1, S.wave)) / S.map.diff;
    splash(m.x, m.y, METEOR_RADIUS, (e) => { hurt(e, dmg, 'magic', null); e.burnT = 3; e.burnDps = Math.max(e.burnDps, dmg * 0.1); });
    ring(m.x, m.y, METEOR_RADIUS, '255,140,40', 0.6, 10);
    ring(m.x, m.y, METEOR_RADIUS * 0.7, '255,230,120', 0.4, 5);
    burst(m.x, m.y, '#ff7a1a', 40, 3);
    burst(m.x, m.y, '#ffd23a', 25, 2);
    burst(m.x, m.y, '#3a2a20', 15, 1.5);
    S.shake = 0.45;
  }

  // ---------------------------------------------------------------- Update
  function update(dt) {
    S.time += dt;
    if (S.nextTimer > 0) { S.nextTimer -= dt; if (S.nextTimer <= 0) startWave(); }
    if (S.meteorCd > 0) S.meteorCd = Math.max(0, S.meteorCd - dt);

    for (const sp of S.spawners) {
      sp.t -= dt;
      while (sp.t <= 0 && sp.queue.length) { spawnEnemy(sp.queue.shift(), sp.wave); sp.t += sp.interval; }
    }
    S.spawners = S.spawners.filter((s) => s.queue.length);
    flushNewEnemies();

    for (const e of S.enemies) if (!e.dead) updateEnemy(e, dt);
    flushNewEnemies();
    for (const t of S.towers) updateTower(t, dt);
    for (const p of S.projectiles) updateProjectile(p, dt);
    S.projectiles = S.projectiles.filter((p) => !p.done);

    for (const fx of S.effects) {
      if (fx.type === 'meteor') { fx.t -= dt; if (fx.t <= 0) { meteorImpact(fx); fx.life = 0; } else fx.life = 1; }
      else fx.life -= dt;
    }
    S.effects = S.effects.filter((fx) => fx.life > 0);
    for (const p of S.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.vx *= 0.96; p.vy *= 0.96; }
    S.particles = S.particles.filter((p) => p.life > 0);
    for (const t of S.texts) { t.life -= dt; t.y -= 28 * dt; }
    S.texts = S.texts.filter((t) => t.life > 0);
    flushNewEnemies();
    S.enemies = S.enemies.filter((e) => !e.dead);

    S.shake = Math.max(0, S.shake - dt);
    S.hurtFlash = Math.max(0, S.hurtFlash - dt);
    if (S.banner) { S.banner.life -= dt; if (S.banner.life <= 0) S.banner = null; }

    if (S.waveRunning && !S.spawners.length && !S.enemies.length) {
      S.waveRunning = false;
      const bonus = 15 + S.wave * 3;
      S.gold += bonus;
      S.score += S.wave * 50;
      floatText(W / 2, H / 2, `Welle ${S.wave} geschafft! +${bonus} 💰`, '#8fe07a');
      if (S.auto) S.nextTimer = 8;
    }

    if (S.lives <= 0 && !S.over) gameOver();
  }
  function flushNewEnemies() {
    if (S.newEnemies.length) { S.enemies.push(...S.newEnemies); S.newEnemies.length = 0; }
  }

  // ================================================================ Rendering
  function render(time) {
    ctx.setTransform(view.k, 0, 0, view.k, 0, 0);
    if (!S) {
      ctx.drawImage(PREPARED[0].bg, 0, 0, W, H);
      return;
    }
    ctx.save();
    if (S.shake > 0) ctx.translate(rand(-1, 1) * S.shake * 12, rand(-1, 1) * S.shake * 12);
    ctx.drawImage(S.bg, 0, 0, W, H);

    drawPortal(time);

    // Reichweite des ausgewählten Turms
    if (S.selected) drawRange(S.selected.x, S.selected.y, S.selected.def.range[S.selected.level - 1] * TILE, true);

    // Bodenebene: Türme & Gegner nach y sortiert
    const list = [];
    for (const t of S.towers) list.push({ y: t.y + 6, t });
    for (const e of S.enemies) if (!e.flying) list.push({ y: e.y, e });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) it.t ? drawTower(it.t, time) : drawEnemy(it.e, time);

    drawCastle(time);

    for (const e of S.enemies) if (e.flying) drawEnemy(e, time);
    for (const p of S.projectiles) drawProjectile(p);
    for (const fx of S.effects) drawEffect(fx, time);

    for (const p of S.particles) {
      ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    // Bau-Vorschau
    if (S.buildType && S.ghost) {
      const { c, r } = S.ghost;
      const ok = canBuild(c, r) && S.gold >= TOWERS[S.buildType].cost;
      const x = (c + 0.5) * TILE, y = (r + 0.5) * TILE;
      ctx.fillStyle = ok ? 'rgba(120,255,120,0.18)' : 'rgba(255,80,80,0.25)';
      ctx.fillRect(c * TILE, r * TILE, TILE, TILE);
      drawRange(x, y, TOWERS[S.buildType].range[0] * TILE, ok);
      ctx.globalAlpha = 0.65;
      drawTower({ type: S.buildType, def: TOWERS[S.buildType], x, y, level: 1, angle: -Math.PI / 2, flash: 0 }, time);
      ctx.globalAlpha = 1;
    }
    // Meteor-Zielkreis
    if (S.spellMode && S.hover) {
      ctx.beginPath(); ctx.arc(S.hover.x, S.hover.y, METEOR_RADIUS, 0, TAU);
      ctx.fillStyle = 'rgba(255,120,40,0.15)'; ctx.fill();
      ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,160,60,0.9)'; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
    }

    // Schwebende Texte
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const t of S.texts) {
      ctx.globalAlpha = clamp(t.life * 1.5, 0, 1);
      ctx.font = 'bold 15px Georgia, serif';
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    drawBossBar();
    drawBanner();
    if (S.nextTimer > 0 && !S.waveRunning) {
      ctx.font = 'bold 17px Georgia, serif'; ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(W / 2 - 120, 8, 240, 30);
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

  function drawRange(x, y, r, ok) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.09)' : 'rgba(255,60,60,0.1)';
    ctx.fill();
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.6)' : 'rgba(255,90,90,0.7)';
    ctx.lineWidth = 1.5; ctx.stroke(); ctx.setLineDash([]);
  }

  function drawPortal(time) {
    const p = S.path.pts[1];
    const s = S.path.pts[0];
    // Portal an der Kante, an der der Weg die Karte betritt
    const x = s.x < 0 ? 6 : p.x, y = s.y;
    ctx.save();
    ctx.translate(x, y);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 30);
    g.addColorStop(0, 'rgba(220,150,255,0.9)');
    g.addColorStop(0.5, 'rgba(120,40,200,0.6)');
    g.addColorStop(1, 'rgba(60,0,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(0, 0, 14, 28, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(230,190,255,0.8)'; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, 10 - i * 3, 22 - i * 6, 0, time * (2 + i) + i, time * (2 + i) + i + 3.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawCastle(time) {
    const end = S.path.pts[S.path.pts.length - 1];
    const x = W - 14, y = end.y;
    ctx.save();
    ctx.translate(x, y);
    ellipse(2, 20, 26, 8, 'rgba(0,0,0,0.35)');
    // Türme
    for (const sx of [-1, 1]) {
      ctx.fillStyle = '#8d8478'; ctx.fillRect(-10, sx * 20 - 12, 22, 22);
      ctx.fillStyle = '#a59c8f'; ctx.fillRect(-10, sx * 20 - 14, 22, 5);
      ctx.fillStyle = '#6a4bb0';
      ctx.beginPath(); ctx.moveTo(-12, sx * 20 - 12); ctx.lineTo(1, sx * 20 - 30); ctx.lineTo(14, sx * 20 - 12); ctx.fill();
    }
    // Mauer + Tor
    ctx.fillStyle = '#9a9186'; ctx.fillRect(-8, -14, 20, 30);
    ctx.fillStyle = '#3a2a1c';
    ctx.beginPath(); ctx.moveTo(-8, 12); ctx.lineTo(-8, -2); ctx.arc(0, -2, 8, Math.PI, 0); ctx.lineTo(8, 12); ctx.fill();
    // Flagge
    ctx.strokeStyle = '#4a3a2a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, -50); ctx.lineTo(1, -30); ctx.stroke();
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath(); ctx.moveTo(1, -50);
    ctx.quadraticCurveTo(-8, -47 + Math.sin(time * 5) * 2, -16, -46);
    ctx.lineTo(1, -40); ctx.fill();
    ctx.restore();
  }

  // ---------------------------------------------------------------- Türme zeichnen
  function drawTower(t, time) {
    const { x, y } = t;
    const ty = y - 8;
    ctx.save();
    ellipse(x + 3, y + 15, 19, 7, 'rgba(0,0,0,0.35)');
    // Steinsockel
    const g = ctx.createLinearGradient(x - 17, 0, x + 17, 0);
    g.addColorStop(0, '#5f5c58'); g.addColorStop(0.45, '#a8a39b'); g.addColorStop(1, '#55524e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(x, y + 12, 17, 7, 0, 0, Math.PI); ctx.lineTo(x - 17, y - 6); ctx.lineTo(x + 17, y - 6); ctx.closePath(); ctx.fill();
    ctx.fillRect(x - 17, y - 6, 34, 18);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x - 17, y + 3); ctx.lineTo(x + 17, y + 3);
    ctx.moveTo(x - 6, y - 6); ctx.lineTo(x - 6, y + 3); ctx.moveTo(x + 7, y + 3); ctx.lineTo(x + 7, y + 13); ctx.stroke();
    ellipse(x, y - 6, 17, 7.5, '#c2bcb1');
    ctx.strokeStyle = t.def.color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y - 6, 15.5, 6.5, 0, 0, TAU); ctx.stroke();

    switch (t.type) {
      case 'archer': {
        ellipse(x, ty + 2, 11, 5, '#7a4b24');
        // Schütze
        circle(x, ty - 4, 6.5, '#2f6e2a');
        circle(x, ty - 6, 4.2, '#e8c39a');
        ctx.fillStyle = '#245a20'; ctx.beginPath(); ctx.arc(x, ty - 7, 4.6, Math.PI, 0); ctx.fill();
        ctx.translate(x, ty - 4); ctx.rotate(t.angle);
        ctx.strokeStyle = '#6b3f17'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(4, 0, 10, -1.2, 1.2); ctx.stroke();
        const pull = t.flash > 0.5 ? 0 : 3;
        ctx.strokeStyle = '#eee'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(4 + Math.cos(-1.2) * 10, Math.sin(-1.2) * 10); ctx.lineTo(4 - pull, 0); ctx.lineTo(4 + Math.cos(1.2) * 10, Math.sin(1.2) * 10); ctx.stroke();
        if (t.flash < 0.5) { ctx.strokeStyle = '#d9c7a0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(4 - pull, 0); ctx.lineTo(15, 0); ctx.stroke(); }
        break;
      }
      case 'cannon': {
        ellipse(x, ty + 2, 12, 5.5, '#5a4636');
        ctx.translate(x, ty - 2); ctx.rotate(t.angle);
        const rc = -t.flash * 4;
        ctx.fillStyle = '#2b2b2b'; ctx.fillRect(rc, -4.5, 20, 9);
        ctx.fillStyle = '#4a4a4a'; ctx.fillRect(rc + 17, -5.5, 5, 11);
        ctx.fillStyle = '#b8862b'; ctx.fillRect(rc + 6, -5, 2.5, 10);
        circle(0, 0, 8, '#3a3a3a');
        circle(-2, -2, 3, '#666');
        if (t.flash > 0.7) circle(rc + 25, 0, 6 * t.flash, 'rgba(255,200,80,0.8)');
        break;
      }
      case 'frost': {
        const bob = Math.sin(time * 2.5 + x) * 2.5;
        const cy = ty - 12 + bob;
        const gl = ctx.createRadialGradient(x, cy, 1, x, cy, 24);
        gl.addColorStop(0, `rgba(170,235,255,${0.5 + t.flash * 0.4})`); gl.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 24, cy - 24, 48, 48);
        const cg = ctx.createLinearGradient(x - 7, cy - 14, x + 7, cy + 10);
        cg.addColorStop(0, '#f2fdff'); cg.addColorStop(1, '#3aa8e0');
        ctx.fillStyle = cg;
        ctx.beginPath(); ctx.moveTo(x, cy - 15); ctx.lineTo(x + 7.5, cy); ctx.lineTo(x, cy + 10); ctx.lineTo(x - 7.5, cy); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, cy - 15); ctx.lineTo(x, cy + 10); ctx.moveTo(x - 7.5, cy); ctx.lineTo(x + 7.5, cy); ctx.stroke();
        for (let i = 0; i < 3; i++) {
          const a = time * 1.5 + (i * TAU) / 3;
          circle(x + Math.cos(a) * 13, cy + Math.sin(a) * 5, 1.8, '#d8f6ff');
        }
        break;
      }
      case 'storm': {
        ctx.fillStyle = '#5a4a36'; ctx.fillRect(x - 3, ty - 18, 6, 20);
        ctx.fillStyle = '#c07a3a'; ctx.fillRect(x - 6, ty - 8, 12, 3); ctx.fillRect(x - 5, ty - 14, 10, 3);
        const oy = ty - 24;
        const gl = ctx.createRadialGradient(x, oy, 1, x, oy, 20);
        gl.addColorStop(0, `rgba(255,250,180,${0.6 + t.flash * 0.4})`); gl.addColorStop(1, 'rgba(255,230,60,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 20, oy - 20, 40, 40);
        circle(x, oy, 7, '#ffe14a');
        circle(x - 2, oy - 2, 3, '#fffbe0');
        if (Math.random() < 0.35) {
          ctx.strokeStyle = 'rgba(255,255,200,0.9)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(x, oy);
          let px = x, py = oy; const a = Math.random() * TAU;
          for (let k = 0; k < 3; k++) { px += Math.cos(a) * 5 + rand(-3, 3); py += Math.sin(a) * 5 + rand(-3, 3); ctx.lineTo(px, py); }
          ctx.stroke();
        }
        break;
      }
      case 'arcane': {
        ctx.fillStyle = '#3b2457';
        ctx.beginPath(); ctx.moveTo(x - 8, ty + 2); ctx.lineTo(x - 4, ty - 16); ctx.lineTo(x + 4, ty - 16); ctx.lineTo(x + 8, ty + 2); ctx.fill();
        ctx.fillStyle = '#c99bff'; ctx.fillRect(x - 1, ty - 12, 2, 10);
        const oy = ty - 26 + Math.sin(time * 2 + x) * 2;
        const gl = ctx.createRadialGradient(x, oy, 1, x, oy, 22);
        gl.addColorStop(0, `rgba(210,160,255,${0.55 + t.flash * 0.45})`); gl.addColorStop(1, 'rgba(150,80,255,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 22, oy - 22, 44, 44);
        circle(x, oy, 6.5, '#a35cf0');
        circle(x - 2, oy - 2, 2.5, '#f1e2ff');
        ctx.strokeStyle = 'rgba(220,190,255,0.8)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.ellipse(x, oy, 13, 5, 0, time * 2, time * 2 + 4.5); ctx.stroke();
        break;
      }
      case 'fire': {
        // Feuerschale
        const gl = ctx.createRadialGradient(x, ty - 8, 1, x, ty - 8, 26);
        gl.addColorStop(0, `rgba(255,170,60,${0.45 + t.flash * 0.5})`); gl.addColorStop(1, 'rgba(255,90,20,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - 26, ty - 34, 52, 52);
        for (let i = 0; i < 3; i++) {
          const fx = x + (i - 1) * 5, h = 12 + Math.sin(time * 12 + i * 2 + x) * 3 + t.flash * 6;
          ctx.fillStyle = i === 1 ? '#ffd23a' : '#ff6a1a';
          ctx.beginPath(); ctx.moveTo(fx - 4.5, ty - 2); ctx.quadraticCurveTo(fx - 4, ty - h * 0.6, fx, ty - h); ctx.quadraticCurveTo(fx + 4, ty - h * 0.6, fx + 4.5, ty - 2); ctx.fill();
        }
        ctx.fillStyle = '#2f2723';
        ctx.beginPath(); ctx.ellipse(x, ty - 2, 12, 4, 0, 0, Math.PI); ctx.lineTo(x - 12, ty - 3); ctx.fill();
        ctx.fillStyle = '#4a3c34'; ctx.fillRect(x - 13, ty - 4, 26, 3);
        break;
      }
    }
    ctx.restore();
    // Stufen-Abzeichen
    for (let i = 0; i < t.level; i++) {
      const px = x - (t.level - 1) * 3.5 + i * 7, py = y + 8;
      ctx.fillStyle = '#f2c14e';
      ctx.beginPath(); ctx.moveTo(px, py - 3); ctx.lineTo(px + 2.5, py); ctx.lineTo(px, py + 3); ctx.lineTo(px - 2.5, py); ctx.fill();
    }
  }

  // ---------------------------------------------------------------- Gegner zeichnen
  function eyes(x, y, ang, r, color = '#fff', pupil = '#111') {
    const fx = Math.cos(ang) * r * 0.35, fy = Math.sin(ang) * r * 0.25;
    const px = -Math.sin(ang), py = Math.cos(ang);
    for (const s of [-1, 1]) {
      const ex = x + fx + px * s * r * 0.33, ey = y + fy + py * s * r * 0.2 - r * 0.15;
      circle(ex, ey, r * 0.22, color);
      if (pupil) circle(ex + Math.cos(ang) * r * 0.08, ey + Math.sin(ang) * r * 0.06, r * 0.11, pupil);
    }
  }

  function drawEnemy(e, time) {
    const r = e.r, ang = e.ang;
    let x = e.x, y = e.y;
    const bob = Math.sin(time * 9 + e.wob) * 1.2;
    const col = e.hitFlash > 0 ? '#ffffff' : e.def.color;
    if (e.flying) {
      ellipse(x, y + 10, r * 0.8, r * 0.3, 'rgba(0,0,0,0.25)');
      y -= 14 + Math.sin(time * 4 + e.wob) * 3;
    } else {
      ellipse(x, y + r * 0.7, r * 0.9, r * 0.35, 'rgba(0,0,0,0.3)');
      y += bob - 2;
    }
    const dirX = Math.cos(ang);

    switch (e.type) {
      case 'goblin':
        ctx.fillStyle = col;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(x + s * r * 0.6, y - r * 0.3); ctx.lineTo(x + s * r * 1.5, y - r * 0.8); ctx.lineTo(x + s * r * 0.7, y + r * 0.1); ctx.fill(); }
        circle(x, y, r, col);
        circle(x, y + r * 0.55, r * 0.55, '#6b4a2a');
        eyes(x, y, ang, r, '#ffe55a');
        break;
      case 'orc':
        circle(x, y, r, col);
        ctx.fillStyle = '#5a5a5a'; ctx.beginPath(); ctx.arc(x, y - 2, r, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
        eyes(x, y + 1, ang, r, '#ff4a2a', null);
        ctx.fillStyle = '#fffbe8';
        ctx.beginPath(); ctx.moveTo(x - 4, y + 4); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x - 2, y + 4); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 2, y + 4); ctx.lineTo(x + 3, y + 1); ctx.lineTo(x + 4, y + 4); ctx.fill();
        break;
      case 'wolf': {
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 1.6, -4 + Math.sin(time * 14 + e.wob) * 3, -r * 1.9, -2); ctx.stroke();
        ellipse(0, 0, r * 1.05, r * 0.6, col);
        circle(r * 0.9, 0, r * 0.5, col);
        ellipse(r * 1.3, 0, r * 0.35, r * 0.25, col);
        ctx.fillStyle = col;
        for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(r * 0.7, s * r * 0.3); ctx.lineTo(r * 0.75, s * r * 0.75); ctx.lineTo(r * 1.0, s * r * 0.35); ctx.fill(); }
        circle(r * 1.05, -r * 0.22, 1.6, '#ff3a2a'); circle(r * 1.05, r * 0.22, 1.6, '#ff3a2a');
        ctx.restore();
        break;
      }
      case 'bat': {
        const flap = Math.sin(time * 18 + e.wob);
        ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#4a2a70';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(x, y);
          ctx.lineTo(x + s * r * 2.2, y - r * (0.4 + flap * 0.9));
          ctx.lineTo(x + s * r * 1.6, y + r * 0.3);
          ctx.lineTo(x + s * r * 1.0, y + r * 0.1);
          ctx.closePath(); ctx.fill();
        }
        circle(x, y, r * 0.75, col);
        circle(x - 2.5, y - 1, 1.6, '#ff3a3a'); circle(x + 2.5, y - 1, 1.6, '#ff3a3a');
        break;
      }
      case 'slime':
      case 'slimelet': {
        const sq = Math.sin(time * 6 + e.wob) * 0.12;
        ctx.globalAlpha = 0.9;
        ellipse(x, y + r * 0.2, r * (1.1 + sq), r * (0.85 - sq), col);
        ctx.globalAlpha = 1;
        ellipse(x - r * 0.35, y - r * 0.15, r * 0.25, r * 0.15, 'rgba(255,255,255,0.6)');
        eyes(x, y + r * 0.1, ang, r);
        break;
      }
      case 'shaman': {
        ctx.strokeStyle = '#6b4a2a'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + dirX * 8 + 6, y + 8); ctx.lineTo(x + dirX * 8 + 6, y - 16); ctx.stroke();
        const gl = ctx.createRadialGradient(x + dirX * 8 + 6, y - 18, 0, x + dirX * 8 + 6, y - 18, 9);
        gl.addColorStop(0, '#d0ffb0'); gl.addColorStop(1, 'rgba(80,255,80,0)');
        ctx.fillStyle = gl; ctx.fillRect(x + dirX * 8 - 4, y - 28, 20, 20);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x - r, y + r * 0.8); ctx.lineTo(x, y - r * 1.2); ctx.lineTo(x + r, y + r * 0.8); ctx.fill();
        circle(x, y - r * 0.2, r * 0.6, '#e8d7b0');
        ctx.fillStyle = '#222'; ctx.fillRect(x - 3, y - r * 0.35, 2, 2); ctx.fillRect(x + 1, y - r * 0.35, 2, 2);
        break;
      }
      case 'golem': {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.roundRect(x - r, y - r, r * 2, r * 1.9, 5); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.fillRect(x - r, y + r * 0.4, r * 2, r * 0.5);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x - 5, y - r); ctx.lineTo(x - 2, y - 3); ctx.lineTo(x - 7, y + 5); ctx.stroke();
        circle(x - 4 + dirX * 2, y - 3, 2.5, '#ffa53a'); circle(x + 4 + dirX * 2, y - 3, 2.5, '#ffa53a');
        ellipse(x - r - 2, y + 2, 4, 6, col); ellipse(x + r + 2, y + 2, 4, 6, col);
        break;
      }
      case 'troll': {
        ctx.save(); ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 6; ctx.lineCap = 'round';
        const sw = Math.sin(time * 3) * 0.4;
        ctx.beginPath(); ctx.moveTo(x + r * 0.8, y); ctx.lineTo(x + r * 0.8 + Math.cos(-1 + sw) * 22, y + Math.sin(-1 + sw) * 22); ctx.stroke();
        ctx.restore();
        circle(x, y, r, col);
        ellipse(x, y + r * 0.35, r * 0.7, r * 0.5, '#6aa891');
        eyes(x, y - 3, ang, r * 0.8, '#ffe14a');
        ctx.fillStyle = '#fffbe8';
        ctx.beginPath(); ctx.moveTo(x - 7, y + 6); ctx.lineTo(x - 5, y - 1); ctx.lineTo(x - 3, y + 6); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x + 3, y + 6); ctx.lineTo(x + 5, y - 1); ctx.lineTo(x + 7, y + 6); ctx.fill();
        crown(x, y - r + 1, 12);
        break;
      }
      case 'dragon': {
        const flap = Math.sin(time * 6 + e.wob);
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.fillStyle = e.hitFlash > 0 ? '#fff' : '#8a1f1a';
        for (const s of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(-4, 0);
          ctx.lineTo(-10, s * r * (2.2 + flap * 0.5));
          ctx.lineTo(4, s * r * (1.6 + flap * 0.4));
          ctx.lineTo(10, s * r * 0.3);
          ctx.closePath(); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-r, 0); ctx.quadraticCurveTo(-r * 1.6, Math.sin(time * 4) * 8, -r * 2.1, 0); ctx.stroke();
        ellipse(0, 0, r * 1.1, r * 0.55, col);
        ellipse(r * 1.1, 0, r * 0.45, r * 0.35, col);
        ctx.fillStyle = '#f2c14e';
        ctx.beginPath(); ctx.moveTo(r * 0.9, -6); ctx.lineTo(r * 0.6, -13); ctx.lineTo(r * 1.1, -7); ctx.fill();
        ctx.beginPath(); ctx.moveTo(r * 0.9, 6); ctx.lineTo(r * 0.6, 13); ctx.lineTo(r * 1.1, 7); ctx.fill();
        circle(r * 1.25, -4, 2.2, '#ffe14a'); circle(r * 1.25, 4, 2.2, '#ffe14a');
        ctx.restore();
        if (Math.random() < 0.3) S.particles.push({ x: x + Math.cos(ang) * r * 1.6, y: y + Math.sin(ang) * r * 1.6, vx: Math.cos(ang) * 40, vy: Math.sin(ang) * 40, life: 0.3, max: 0.3, color: '#ff8a2a', size: 3, grav: 0 });
        break;
      }
      case 'lich': {
        const gl = ctx.createRadialGradient(x, y, 2, x, y, r * 2);
        gl.addColorStop(0, 'rgba(180,100,255,0.45)'); gl.addColorStop(1, 'rgba(120,40,200,0)');
        ctx.fillStyle = gl; ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.moveTo(x - r, y + r); ctx.quadraticCurveTo(x, y - r * 1.8, x + r, y + r); ctx.fill();
        circle(x, y - r * 0.35, r * 0.5, '#e8e2d0');
        circle(x - 3, y - r * 0.4, 2.2, '#7af0ff'); circle(x + 3, y - r * 0.4, 2.2, '#7af0ff');
        crown(x, y - r * 0.8, 10);
        break;
      }
    }

    // Statuseffekte
    if (e.slowT > 0) {
      ctx.globalAlpha = 0.35;
      circle(x, y, r + 2, '#8fdcff');
      ctx.globalAlpha = 1;
    }

    // Lebensbalken
    if (e.hp < e.maxHp || e.def.boss) {
      const bw = Math.max(18, r * 2.2), bh = e.def.boss ? 5 : 3.5, bx = x - bw / 2, by = y - r - (e.def.boss ? 18 : 9);
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 1, by - 1, bw + 2, bh + 2);
      const f = clamp(e.hp / e.maxHp, 0, 1);
      ctx.fillStyle = f > 0.5 ? '#6ee05a' : f > 0.25 ? '#f2c14e' : '#ff4a3a';
      ctx.fillRect(bx, by, bw * f, bh);
    }
  }

  function crown(x, y, w) {
    ctx.fillStyle = '#f2c14e';
    ctx.beginPath();
    ctx.moveTo(x - w / 2, y); ctx.lineTo(x - w / 2, y - 7); ctx.lineTo(x - w / 4, y - 3);
    ctx.lineTo(x, y - 9); ctx.lineTo(x + w / 4, y - 3); ctx.lineTo(x + w / 2, y - 7); ctx.lineTo(x + w / 2, y);
    ctx.fill();
  }

  // ---------------------------------------------------------------- Projektile & Effekte zeichnen
  function drawProjectile(p) {
    switch (p.kind) {
      case 'arrow':
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang || 0);
        ctx.strokeStyle = '#e8d8b0'; ctx.lineWidth = 1.8;
        ctx.beginPath(); ctx.moveTo(-9, 0); ctx.lineTo(5, 0); ctx.stroke();
        ctx.fillStyle = '#ccc'; ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(3, -2.5); ctx.lineTo(3, 2.5); ctx.fill();
        ctx.fillStyle = '#c0392b'; ctx.fillRect(-10, -1.5, 3, 3);
        ctx.restore();
        break;
      case 'ball':
        circle(p.x, p.y, 4.5, '#1e1e1e');
        circle(p.x - 1.2, p.y - 1.2, 1.5, '#777');
        break;
      case 'frost': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 8);
        g.addColorStop(0, '#ffffff'); g.addColorStop(1, 'rgba(120,220,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 8, p.y - 8, 16, 16);
        break;
      }
      case 'arcane': {
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 10);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#c99bff'); g.addColorStop(1, 'rgba(150,80,255,0)');
        ctx.fillStyle = g; ctx.fillRect(p.x - 10, p.y - 10, 20, 20);
        break;
      }
    }
  }

  function drawEffect(fx) {
    if (fx.type === 'ring') {
      const k = 1 - fx.life / fx.max;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r0 + (fx.r1 - fx.r0) * k, 0, TAU);
      ctx.strokeStyle = `rgba(${fx.color},${(1 - k) * 0.9})`;
      ctx.lineWidth = 3 * (1 - k) + 1; ctx.stroke();
      ctx.fillStyle = `rgba(${fx.color},${(1 - k) * 0.15})`; ctx.fill();
    } else if (fx.type === 'bolt') {
      const a = fx.life / fx.max;
      ctx.lineJoin = 'round';
      for (const [w, c] of [[6, `rgba(255,240,120,${a * 0.35})`], [2, `rgba(255,255,230,${a})`]]) {
        ctx.strokeStyle = c; ctx.lineWidth = w;
        ctx.beginPath(); fx.pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.stroke();
      }
    } else if (fx.type === 'meteor') {
      const k = 1 - fx.t / fx.max;
      const sx = fx.x + 260 * (1 - k), sy = fx.y - 420 * (1 - k);
      ctx.beginPath(); ctx.arc(fx.x, fx.y, METEOR_RADIUS * (0.3 + 0.7 * k), 0, TAU);
      ctx.strokeStyle = `rgba(255,120,40,${0.3 + k * 0.5})`; ctx.lineWidth = 2; ctx.stroke();
      const g = ctx.createLinearGradient(sx, sy, sx + 60, sy - 100);
      g.addColorStop(0, 'rgba(255,200,80,0.9)'); g.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.strokeStyle = g; ctx.lineWidth = 12; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 60, sy - 100); ctx.stroke();
      circle(sx, sy, 13, '#ff8a2a'); circle(sx, sy, 9, '#ffd23a'); circle(sx - 2, sy - 2, 4, '#fff6d0');
    }
  }

  function drawBossBar() {
    const boss = S.enemies.find((e) => e.def.boss && !e.dead);
    if (!boss) return;
    const bw = 360, bx = W / 2 - bw / 2, by = H - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.65)'; ctx.fillRect(bx - 4, by - 18, bw + 8, 34);
    ctx.fillStyle = '#5a1a1a'; ctx.fillRect(bx, by, bw, 10);
    ctx.fillStyle = '#e0412e'; ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 10);
    ctx.font = 'bold 13px Georgia, serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#f2c14e';
    ctx.fillText(`👑 ${boss.def.name}`, W / 2, by - 7);
  }

  function drawBanner() {
    const b = S.banner;
    if (!b) return;
    const a = clamp(Math.min(b.life, 2.2 - b.life) * 3, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `bold ${b.boss ? 40 : 34}px Georgia, serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.strokeText(b.text, W / 2, H * 0.3);
    ctx.fillStyle = b.boss ? '#ff6a4a' : '#f2c14e';
    ctx.fillText(b.text, W / 2, H * 0.3);
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
    S.spellMode = false;
    S.selected = null;
    S.ghost = null;
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
        <p class="hint">Besiegt: ${t.kills}${d.air ? '' : ' · trifft keine Flieger'}</p>`;
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
        <p>Wähle einen Turm und baue ihn neben den Weg. Tippe auf einen Turm, um ihn zu verbessern.</p>
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

    const wb = $('btnWave');
    let label, disabled = false;
    if (S.spawners.length) { label = '⚔ Welle läuft'; disabled = true; }
    else if (S.waveRunning) label = `⏩ Früh rufen +${10 + S.wave * 2}💰`;
    else if (S.nextTimer > 0) label = `▶ Welle ${S.wave + 1} (${Math.ceil(S.nextTimer)})`;
    else label = `▶ Welle ${S.wave + 1} starten`;
    setText('btnWave', label);
    if (cache.wbd !== disabled) { cache.wbd = disabled; wb.disabled = disabled; }

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
      const tk = `Besiegt: ${S.selected.kills}`;
      const hint = $('info').querySelector('.hint');
      if (hint && cache.kills !== tk) { cache.kills = tk; hint.textContent = tk + (S.selected.def.air ? '' : ' · trifft keine Flieger'); }
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
  $('btnSpeed').addEventListener('click', () => { if (S) { S.speed = S.speed % 3 + 1; syncHud(); } });
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
    S.buildType = null; S.selected = null; S.ghost = null;
    renderInfo();
  });

  function togglePause(force) {
    if (!S || S.over) return;
    S.paused = force !== undefined ? force : !S.paused;
    if (S.paused) showPause(); else hideOverlay();
    syncHud();
  }

  // ---------------------------------------------------------------- Eingabe auf der Karte
  function toWorld(ev) {
    const rect = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - rect.left) / rect.width) * W, y: ((ev.clientY - rect.top) / rect.height) * H };
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
    S.selected = tw && tw !== S.selected ? tw : null;
    renderInfo();
  });

  window.addEventListener('keydown', (ev) => {
    if (!S || S.over) return;
    const k = ev.key.toLowerCase();
    if (k >= '1' && k <= '6') chooseBuild(TOWER_KEYS[+k - 1]);
    else if (k === ' ') { ev.preventDefault(); togglePause(); }
    else if (S.paused) return;
    else if (k === 'escape') { S.buildType = null; S.selected = null; S.spellMode = false; S.ghost = null; renderInfo(); }
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
  function hideOverlay() { overlay.classList.remove('show'); overlay.innerHTML = ''; }

  function showMenu() {
    if (S) { S.over = true; }
    const best = loadBest();
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
        <details class="help">
          <summary>📜 Wie wird gespielt?</summary>
          <ul>
            <li>Monster kommen aus dem Portal und wollen zu deiner Burg. Jedes Monster, das durchkommt, kostet Leben.</li>
            <li>Baue Türme neben den Weg (Turm wählen → Feld antippen; auf dem Tablet zum Bestätigen nochmal tippen).</li>
            <li>Tippe auf einen Turm, um ihn zu verbessern (bis Stufe 4), zu verkaufen oder sein Ziel zu ändern.</li>
            <li>Alle 5 Wellen kommt ein Schwarm, alle 10 Wellen ein Boss. Die Wellen werden endlos stärker!</li>
            <li>💣 Kanonen treffen keine Flieger. ❄️ Frost verlangsamt. 🏹/💣 sind physisch – Golems sind dagegen gepanzert.</li>
            <li>Rufe Wellen früh, um Bonusgold zu bekommen. ☄️ Der Meteor hilft in Notlagen.</li>
          </ul>
        </details>
      </div>`;
    overlay.querySelectorAll('.mapcard').forEach((b) => {
      const i = +b.dataset.map;
      const cv = b.querySelector('canvas');
      cv.getContext('2d').drawImage(PREPARED[i].bg, 0, 0, cv.width, cv.height);
      b.addEventListener('click', () => newGame(i));
    });
    overlay.classList.add('show');
  }

  function showPause() {
    overlay.innerHTML = `
      <div class="card" style="max-width:420px">
        <h2>⏸ Pausiert</h2>
        <p class="big">Welle <b>${S.wave}</b> · ⭐ <b>${fmt(S.score)}</b></p>
        <div class="buttons">
          <button class="btn primary" id="ovResume">▶ Weiter</button>
          <button class="btn danger" id="ovQuit">🏳 Aufgeben</button>
        </div>
      </div>`;
    $('ovResume').onclick = () => togglePause(false);
    $('ovQuit').onclick = () => { S.paused = false; gameOver(true); };
    overlay.classList.add('show');
  }

  function gameOver(gaveUp) {
    S.over = true;
    const best = loadBest();
    const prev = best[S.map.id];
    const isRecord = !prev || S.wave > prev.wave || (S.wave === prev.wave && S.score > prev.score);
    if (isRecord && S.wave > 0) { best[S.map.id] = { wave: S.wave, score: S.score }; saveBest(best); }
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

  // ---------------------------------------------------------------- Größe & Loop
  function resize() {
    const st = $('stage');
    const cw = st.clientWidth - 10, ch = st.clientHeight - 10;
    const k = Math.max(0.1, Math.min(cw / W, ch / H));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.style.width = `${Math.floor(W * k)}px`;
    canvas.style.height = `${Math.floor(H * k)}px`;
    canvas.width = Math.round(W * k * dpr);
    canvas.height = Math.round(H * k * dpr);
    view.k = (Math.floor(W * k) / W) * dpr;
  }
  new ResizeObserver(resize).observe($('stage'));
  window.addEventListener('resize', resize);

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (S && !S.paused && !S.over) {
      for (let i = 0; i < S.speed && !S.over; i++) update(dt);
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
  window.__runenwacht = { get state() { return S; }, startWave, spawnEnemy };
})();
