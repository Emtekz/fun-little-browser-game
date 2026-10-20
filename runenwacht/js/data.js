// Spieldaten: Karten, Türme, Gegner
export const TILE = 48, COLS = 20, ROWS = 12, W = COLS * TILE, H = ROWS * TILE;

export const MAPS = [
  {
    id: 'hain', name: 'Grüner Hain', diff: 1, theme: 'forest',
    desc: 'Ein verwunschener Waldweg mit Glühwürmchen – ideal für den Einstieg.',
    ground: ['#4c8a3a', '#5a9a45', '#437d33', '#66a84e'], path: '#b89566', pathDark: '#6e5232', stone: '#a99a86',
    light: { day: 0.06, night: 0.58, color: '8,14,40' },
    points: [[-1, 2], [4, 2], [4, 8], [9, 8], [9, 3], [14, 3], [14, 9], [17, 9], [17, 5], [20, 5]],
  },
  {
    id: 'pass', name: 'Schlangenpass', diff: 1.25, theme: 'autumn',
    desc: 'Ein langer Pfad durch die Herbsthügel. Die Monster sind zäher.',
    ground: ['#8f8a3e', '#a08f3e', '#7f7a38', '#b0903a'], path: '#c9ad7c', pathDark: '#7c6236', stone: '#b8a88a',
    light: { day: 0.04, night: 0.55, color: '30,12,40' },
    points: [[-1, 1], [17, 1], [17, 4], [2, 4], [2, 7], [17, 7], [17, 10], [20, 10]],
  },
  {
    id: 'frost', name: 'Frostgipfel', diff: 1.4, theme: 'winter',
    desc: 'Eisige Bergpfade im ewigen Schneetreiben.',
    ground: ['#e3ebf3', '#d2dfeb', '#f2f6fb', '#c4d4e3'], path: '#9a8f88', pathDark: '#5f5852', stone: '#b9b3ad',
    light: { day: 0.03, night: 0.52, color: '12,22,60' },
    points: [[-1, 5], [3, 5], [3, 1], [10, 1], [10, 6], [6, 6], [6, 10], [15, 10], [15, 3], [18, 3], [18, 8], [20, 8]],
  },
  {
    id: 'vulkan', name: 'Feuerschlund', diff: 1.6, theme: 'lava',
    desc: 'Glühende Lava und die stärksten Monster. Nur für Helden!',
    ground: ['#3d302c', '#45362f', '#2f2522', '#4a3a31'], path: '#7a5a44', pathDark: '#2e1c12', stone: '#5e4d42',
    light: { day: 0.32, night: 0.62, color: '35,6,0' },
    points: [[-1, 10], [3, 10], [3, 2], [8, 2], [8, 9], [13, 9], [13, 2], [17, 2], [17, 10], [20, 10]],
  },
];

export const TOWERS = {
  archer: {
    name: 'Bogenschützen', icon: '🏹', cost: 50, color: '#3f8f3a', light: '255,190,110', air: true, kind: 'phys',
    desc: 'Schnelle Pfeile. Trifft auch fliegende Gegner.',
    dmg: [9, 15, 25, 42], range: [3, 3.3, 3.7, 4.2], rate: [1.5, 1.8, 2.2, 2.8],
  },
  cannon: {
    name: 'Zwergenkanone', icon: '💣', cost: 80, color: '#b8862b', light: '255,170,90', air: false, kind: 'phys',
    desc: 'Explosiver Flächenschaden. Kann keine Flieger treffen.',
    dmg: [24, 40, 68, 115], range: [2.6, 2.8, 3.1, 3.4], rate: [0.55, 0.6, 0.7, 0.8], splash: [0.9, 1, 1.15, 1.3],
  },
  frost: {
    name: 'Frostkristall', icon: '❄️', cost: 70, color: '#5bc8f0', light: '140,220,255', air: true, kind: 'magic',
    desc: 'Verlangsamt alle Gegner rund um den Einschlag.',
    dmg: [4, 7, 11, 18], range: [2.6, 2.8, 3, 3.3], rate: [1, 1.1, 1.25, 1.4], slow: [0.35, 0.45, 0.55, 0.62], splash: [0.7, 0.8, 0.9, 1],
  },
  storm: {
    name: 'Sturmturm', icon: '⚡', cost: 120, color: '#f5d742', light: '255,240,150', air: true, kind: 'magic',
    desc: 'Kettenblitz, der zwischen mehreren Gegnern springt.',
    dmg: [16, 27, 45, 75], range: [2.8, 3, 3.3, 3.6], rate: [0.8, 0.9, 1, 1.15], chain: [3, 4, 5, 7],
  },
  arcane: {
    name: 'Arkaner Turm', icon: '🔮', cost: 140, color: '#a35cf0', light: '200,140,255', air: true, kind: 'magic',
    desc: 'Riesige Reichweite und gewaltiger Einzelschaden, aber langsam.',
    dmg: [60, 105, 180, 300], range: [4.5, 5, 5.6, 6.5], rate: [0.4, 0.43, 0.47, 0.52],
  },
  fire: {
    name: 'Drachenfeuer', icon: '🔥', cost: 130, color: '#ff6a2a', light: '255,130,40', air: true, kind: 'fire',
    desc: 'Feuerwelle trifft alle Gegner in der Nähe und setzt sie in Brand.',
    dmg: [10, 17, 28, 46], range: [1.7, 1.85, 2, 2.2], rate: [0.9, 1, 1.1, 1.2], burn: [8, 14, 24, 40],
  },
};
export const TOWER_KEYS = Object.keys(TOWERS);
export const UPGRADE_FACTOR = [0.9, 1.5, 2.4];
export const MAX_LEVEL = 4;
export const KIND_LABEL = { phys: 'Physisch', magic: 'Magie', fire: 'Feuer' };

// unlock: ab welcher Welle der Gegner zufällig auftaucht (0 = nie zufällig), wt: Häufigkeit
export const ENEMIES = {
  goblin:   { name: 'Goblin', hp: 28, speed: 1.6, gold: 4, r: 10, color: '#6fbf3a', unlock: 1, wt: 5,
              desc: 'Schwach, aber flink und zahlreich.' },
  wolf:     { name: 'Schattenwolf', hp: 22, speed: 2.6, gold: 4, r: 11, color: '#8f8f9a', unlock: 3, wt: 3,
              desc: 'Sehr schnell. Jagt oft im Rudel.' },
  orc:      { name: 'Ork', hp: 75, speed: 1.05, gold: 7, r: 12, color: '#4d7a2e', unlock: 4, wt: 4,
              desc: 'Robuster Fußsoldat mit Axt.' },
  bat:      { name: 'Riesenfledermaus', hp: 26, speed: 2.0, gold: 5, r: 10, color: '#6b3fa0', flying: true, unlock: 5, wt: 3,
              desc: 'Fliegt – Kanonen können sie nicht treffen.' },
  skeleton: { name: 'Skelettkrieger', hp: 45, speed: 1.2, gold: 5, r: 11, color: '#e8e2cf', revive: 0.5, unlock: 6, wt: 3,
              desc: 'Setzt sich nach dem Tod einmal wieder zusammen.' },
  slime:    { name: 'Schleim', hp: 80, speed: 1.0, gold: 5, r: 13, color: '#3fd0a0', split: 'slimelet', splitN: 2, unlock: 7, wt: 3,
              desc: 'Teilt sich beim Tod in zwei Schleimlinge.' },
  slimelet: { name: 'Schleimling', hp: 25, speed: 1.5, gold: 2, r: 8, color: '#62e2bb', unlock: 0,
              desc: 'Kleiner Ableger eines Schleims.' },
  spider:   { name: 'Höhlenspinne', hp: 40, speed: 1.7, gold: 6, r: 11, color: '#3a2a3a', leap: true, unlock: 8, wt: 3,
              desc: 'Springt immer wieder ein großes Stück nach vorne.' },
  shaman:   { name: 'Goblin-Schamane', hp: 60, speed: 1.1, gold: 10, r: 11, color: '#b03a3a', healer: true, unlock: 9, wt: 2,
              desc: 'Heilt alle Verbündeten in der Nähe.' },
  ghost:    { name: 'Irrgeist', hp: 55, speed: 1.3, gold: 8, r: 11, color: '#bfe6ff', res: { phys: 0.7 }, unlock: 10, wt: 2,
              desc: 'Körperlos: Pfeile und Kanonen wirken kaum.' },
  golem:    { name: 'Steingolem', hp: 200, speed: 0.7, gold: 14, r: 15, color: '#8a7c6a', res: { phys: 0.5 }, lives: 2, unlock: 11, wt: 2,
              desc: 'Sein Steinpanzer halbiert physischen Schaden.' },
  knight:   { name: 'Todesritter', hp: 140, speed: 0.9, gold: 12, r: 13, color: '#6d7480', res: { phys: 0.35 }, aura: true, unlock: 12, wt: 2,
              desc: 'Gepanzert. Sein Banner schützt Verbündete in der Nähe (−25 % Schaden).' },
  firelem:  { name: 'Feuerelementar', hp: 110, speed: 1.1, gold: 10, r: 12, color: '#ff7a1a', res: { fire: 1 }, unlock: 14, wt: 2,
              desc: 'Immun gegen Feuer und Brand.' },
  gargoyle: { name: 'Gargoyle', hp: 90, speed: 1.4, gold: 10, r: 12, color: '#7d8590', flying: true, res: { phys: 0.4 }, unlock: 15, wt: 2,
              desc: 'Fliegender Steinwächter mit dicker Haut.' },
  assassin: { name: 'Schattenklinge', hp: 70, speed: 1.4, gold: 11, r: 11, color: '#3b2f4f', blink: true, unlock: 17, wt: 2,
              desc: 'Teleportiert sich durch die Schatten nach vorne.' },
  minotaur: { name: 'Minotaurus', hp: 260, speed: 0.9, gold: 16, r: 16, color: '#7a4a2a', enrage: true, slowRes: 0.5, lives: 2, unlock: 19, wt: 2,
              desc: 'Wird bei halber Gesundheit rasend und doppelt so schnell. Kaum zu verlangsamen.' },
  imp:      { name: 'Imp', hp: 35, speed: 2.3, gold: 4, r: 9, color: '#d8382a', flying: true, res: { fire: 1 }, unlock: 20, wt: 2,
              desc: 'Kleiner fliegender Feuerteufel, immun gegen Feuer.' },
  necro:    { name: 'Nekromant', hp: 120, speed: 0.9, gold: 15, r: 12, color: '#2c3a2c', summon: 'skeleton', summonN: 1, summonCd: 4.5, unlock: 22, wt: 1,
              desc: 'Erweckt unaufhörlich Skelettkrieger.' },
  ent:      { name: 'Baumhirte', hp: 600, speed: 0.5, gold: 30, r: 18, color: '#6b4a2a', regen: 0.02, res: { phys: 0.2, fire: -0.5 }, lives: 3, unlock: 25, wt: 1,
              desc: 'Uralter Baumriese. Regeneriert, aber anfällig für Feuer (+50 %).' },

  // Bosse
  troll:    { name: 'Trollkönig', hp: 1400, speed: 0.55, gold: 120, r: 22, color: '#4f8f7a', boss: true, lives: 10, res: { phys: 0.25 }, regen: 0.01,
              desc: 'Boss: regeneriert ständig und ist leicht gepanzert.' },
  dragon:   { name: 'Uralter Drache', hp: 1300, speed: 0.75, gold: 150, r: 22, color: '#c0392b', boss: true, flying: true, lives: 10, res: { fire: 0.5 },
              desc: 'Boss: fliegt und widersteht Feuer.' },
  lich:     { name: 'Lichkönig', hp: 1600, speed: 0.6, gold: 180, r: 20, color: '#5b2a86', boss: true, lives: 10, summon: 'skeleton', summonN: 2, summonCd: 4,
              desc: 'Boss: ruft Skelettkrieger aus ihren Gräbern.' },
  hydra:    { name: 'Hydra', hp: 1500, speed: 0.6, gold: 160, r: 23, color: '#2f8f6a', boss: true, lives: 10, split: 'hydrahead', splitN: 3,
              desc: 'Boss: zerfällt beim Tod in drei wütende Köpfe.' },
  hydrahead:{ name: 'Hydrakopf', hp: 320, speed: 0.9, gold: 25, r: 14, color: '#3aa07a', lives: 3, unlock: 0,
              desc: 'Ein abgetrennter Hydrakopf – immer noch gefährlich.' },
  demon:    { name: 'Dämonenfürst', hp: 2000, speed: 0.55, gold: 220, r: 24, color: '#8a1a1a', boss: true, lives: 10, res: { fire: 1 },
              summon: 'imp', summonN: 2, summonCd: 3.5,
              desc: 'Boss: immun gegen Feuer, beschwört Imps.' },
};
export const BOSS_ORDER = ['troll', 'dragon', 'lich', 'hydra', 'demon'];
export const SWARM_ORDER = ['wolf', 'goblin', 'bat', 'skeleton', 'spider', 'slime', 'imp', 'ghost'];

export function traitsOf(def) {
  const t = [];
  if (def.boss) t.push('👑 Boss');
  if (def.flying) t.push('🪽 Fliegt');
  const res = def.res || {};
  for (const k of ['phys', 'magic', 'fire']) {
    if (!res[k]) continue;
    if (res[k] >= 1) t.push(`🛡 immun: ${KIND_LABEL[k]}`);
    else if (res[k] > 0) t.push(`🛡 ${KIND_LABEL[k]} −${Math.round(res[k] * 100)} %`);
    else t.push(`💥 ${KIND_LABEL[k]} +${Math.round(-res[k] * 100)} %`);
  }
  if (def.lives > 1) t.push(`❤️ −${def.lives}`);
  return t;
}
