// Kristallwacht – Spieldaten
export const COLS = 9, LANES = 5;
export const MAX_LEVEL = 3;
export const LEVEL_DMG = [1, 1.5, 2.25];
export const LEVEL_HP = [1, 1.4, 1.9];

// Verteidiger in Kartenreihenfolge. unlock = ab welcher Welle verfügbar
export const DEFENDERS = {
  bloom: {
    name: 'Manablüte', cost: 50, cd: 7.5, hp: 300, unlock: 1,
    desc: 'Erzeugt regelmäßig Mana-Kristalle. Die Grundlage jeder Verteidigung.',
    prod: { every: 13, first: 5, amount: [25, 35, 50] },
  },
  archer: {
    name: 'Elfenschützin', cost: 100, cd: 7.5, hp: 300, unlock: 1,
    desc: 'Schießt Pfeile auf alle Monster in ihrer Reihe.',
    shot: { rate: 0.7, dmg: 20, kind: 'arrow' },
  },
  wall: {
    name: 'Steinwächter', cost: 50, cd: 25, hp: 4000, unlock: 2,
    desc: 'Ein lebender Steinwall, an dem sich Monster die Zähne ausbeißen.',
  },
  mine: {
    name: 'Runenfalle', cost: 25, cd: 25, hp: 300, unlock: 3,
    desc: 'Lädt sich 12 Sekunden lang auf und sprengt dann das erste Monster, das darüberläuft.',
    arm: 12, blast: 1800,
  },
  frost: {
    name: 'Frostmagier', cost: 175, cd: 7.5, hp: 300, unlock: 4,
    desc: 'Eisgeschosse verlangsamen Monster um die Hälfte.',
    shot: { rate: 0.7, dmg: 20, kind: 'ice', slow: 0.5 },
  },
  bomb: {
    name: 'Feuerrune', cost: 150, cd: 40, hp: 9999, unlock: 6,
    desc: 'Explodiert sofort und vernichtet alles in einem 3×3-Bereich.',
    blast: 1800,
  },
  dwarf: {
    name: 'Zwergenarmbrust', cost: 200, cd: 7.5, hp: 300, unlock: 8,
    desc: 'Feuert zwei Bolzen kurz hintereinander.',
    shot: { rate: 0.7, dmg: 20, kind: 'bolt', double: true },
  },
  thorns: {
    name: 'Dornenranke', cost: 100, cd: 7.5, hp: Infinity, unlock: 10,
    desc: 'Verletzt alle Monster, die darüberlaufen. Wird nicht gefressen – nur Trolle zertrampeln sie.',
    dps: 20,
  },
  storm: {
    name: 'Sturmkristall', cost: 225, cd: 10, hp: 300, unlock: 12,
    desc: 'Ein Blitz trifft das vorderste Monster der Reihe und springt auf zwei weitere über.',
    shot: { rate: 0.55, dmg: 45, chain: 3 },
  },
  dragon: {
    name: 'Drachenwelpe', cost: 300, cd: 15, hp: 450, unlock: 15,
    desc: 'Speit Feuer auf alle Monster bis zu drei Felder vor sich und setzt sie in Brand.',
    breath: { rate: 0.5, dmg: 40, reach: 3, burn: 12 },
  },
};
export const DEF_KEYS = Object.keys(DEFENDERS);

// art = welche Monster-Grafik verwendet wird, r = Größe der Grafik
export const MONSTERS = {
  goblin: {
    name: 'Goblin', art: 'goblin', r: 10, color: '#6fbf3a', hp: 190, speed: 0.22, bite: 100, pts: 1, unlock: 1, wt: 6,
    desc: 'Ein ganz gewöhnlicher, sehr hungriger Goblin.',
  },
  helmgob: {
    name: 'Helmgoblin', art: 'goblin', r: 10, color: '#6fbf3a', hp: 190, armor: 370, armorKind: 'helm', speed: 0.22, bite: 100, pts: 2, unlock: 2, wt: 5,
    desc: 'Trägt einen Eisentopf als Helm, der einiges aushält.',
  },
  wolf: {
    name: 'Schattenwolf', art: 'wolf', r: 11, color: '#8f8f9a', hp: 170, speed: 0.5, bite: 70, pts: 2, unlock: 3, wt: 3,
    desc: 'Rennt mehr als doppelt so schnell wie ein Goblin.',
  },
  skeleton: {
    name: 'Skelettkrieger', art: 'skeleton', r: 11, color: '#e8e2cf', hp: 190, speed: 0.22, bite: 100, revive: 0.5, pts: 2, unlock: 4, wt: 3,
    desc: 'Setzt sich nach dem Tod einmal wieder zusammen.',
  },
  shieldorc: {
    name: 'Schildork', art: 'orc', r: 12, color: '#4d7a2e', hp: 270, armor: 1100, armorKind: 'shield', speed: 0.2, bite: 120, pts: 4, unlock: 5, wt: 3,
    desc: 'Ein schwerer Turmschild schluckt sehr viel Schaden.',
  },
  bat: {
    name: 'Riesenfledermaus', art: 'bat', r: 10, color: '#6b3fa0', hp: 130, speed: 0.4, flying: true, pts: 2, unlock: 6, wt: 2,
    desc: 'Fliegt über alle Verteidiger hinweg. Wälle und Fallen helfen nicht.',
  },
  assassin: {
    name: 'Schattenklinge', art: 'assassin', r: 11, color: '#3b2f4f', hp: 340, speed: 0.45, bite: 100, jump: true, pts: 3, unlock: 7, wt: 2,
    desc: 'Springt über den ersten Verteidiger und läuft danach langsamer.',
  },
  shaman: {
    name: 'Goblin-Schamane', art: 'shaman', r: 11, color: '#b03a3a', hp: 300, speed: 0.2, bite: 80, healer: true, pts: 4, unlock: 9, wt: 2,
    desc: 'Heilt alle Monster in seiner Nähe.',
  },
  golem: {
    name: 'Steingolem', art: 'golem', r: 15, color: '#8a7c6a', hp: 1300, speed: 0.15, bite: 160, pts: 6, unlock: 11, wt: 2,
    desc: 'Extrem zäh, aber sehr langsam.',
  },
  necro: {
    name: 'Nekromant', art: 'necro', r: 12, color: '#2c3a2c', hp: 600, speed: 0.18, bite: 80, summon: 'skeleton', summonCd: 9, pts: 6, unlock: 13, wt: 1,
    desc: 'Lässt immer wieder Skelette vor sich aus dem Boden steigen.',
  },
  imp: {
    name: 'Imp', art: 'imp', r: 9, color: '#d8382a', hp: 160, speed: 0.6, flying: true, fireImmune: true, pts: 3, unlock: 14, wt: 2,
    desc: 'Pfeilschneller Flieger, immun gegen Feuer.',
  },
  troll: {
    name: 'Bergtroll', art: 'troll', r: 22, color: '#4f8f7a', hp: 3000, speed: 0.17, smash: true, pts: 12, unlock: 16, wt: 1,
    desc: 'Zerschmettert jeden Verteidiger mit einem einzigen Keulenschlag.',
  },

  // Bosse – alle 10 Wellen
  trollking: {
    name: 'Trollkönig', art: 'troll', r: 22, color: '#3f7f6a', hp: 9000, speed: 0.13, smash: true, boss: true, crown: true,
    desc: 'Boss: zerschmettert alles und ist riesig zäh.',
  },
  dragon: {
    name: 'Uralter Drache', art: 'dragon', r: 22, color: '#c0392b', hp: 4500, speed: 0.18, flying: true, fireImmune: true, scorch: true, boss: true,
    desc: 'Boss: fliegt und verbrennt die Verteidiger unter sich.',
  },
  lich: {
    name: 'Lichkönig', art: 'lich', r: 20, color: '#5b2a86', hp: 7000, speed: 0.14, bite: 250, summon: 'skeleton', summonCd: 5, boss: true,
    desc: 'Boss: ruft unablässig Skelettkrieger herbei.',
  },
  demon: {
    name: 'Dämonenfürst', art: 'demon', r: 24, color: '#8a1a1a', hp: 11000, speed: 0.12, smash: true, fireImmune: true, summon: 'imp', summonCd: 7, boss: true,
    desc: 'Boss: immun gegen Feuer, zerschmettert Verteidiger und beschwört Imps.',
  },
};
export const BOSS_ORDER = ['trollking', 'dragon', 'lich', 'demon'];

export function monsterTraits(d) {
  const t = [];
  if (d.boss) t.push('👑 Boss');
  if (d.flying) t.push('🪽 fliegt');
  if (d.armor) t.push(d.armorKind === 'helm' ? '⛑ Helm' : '🛡 Schild');
  if (d.fireImmune) t.push('🔥 feuerfest');
  if (d.smash) t.push('💥 zerschmettert');
  if (d.jump) t.push('🦘 springt');
  if (d.revive) t.push('💀 steht auf');
  if (d.healer) t.push('✚ heilt');
  if (d.summon) t.push('🪄 beschwört');
  return t;
}
