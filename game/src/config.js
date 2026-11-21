// SHADOWLINE — shared constants: one place for every number the game tunes.
export const TILE = 40;
export const COLS = 32;
export const ROWS = 11;
export const HUD_H = 40;
export const VIEW_W = COLS * TILE;
export const VIEW_H = HUD_H + ROWS * TILE;
export const STEP = 1 / 60;

// Player movement, tiles per second converted to pixels in player.js.
export const PLAYER = {
  radius: 13,
  walkSpeed: 150,
  runSpeed: 235,
  sneakSpeed: 85,
  // Noise radius in pixels while moving: guards inside it hear the player.
  noiseWalk: 46,
  noiseRun: 130,
  noiseSneak: 0,
};

// A guard's vision cone.
export const CONE = {
  range: 210,
  halfAngle: (34 * Math.PI) / 180,
  // Rays cast when drawing the cone so walls clip it.
  rays: 26,
};

// Detection: 0 hidden, 100 caught. Rates are per second of exposure.
export const DETECT = {
  // Base fill while the player stands in a cone, in clear light.
  baseRate: 55,
  // Multipliers by stance and light.
  runMult: 1.6,
  sneakMult: 0.45,
  shadowMult: 0.25,
  // Distance falloff: closer than this counts double, further counts less.
  nearDist: 90,
  farDist: 190,
  // How fast the meter drains while unseen.
  decayRate: 26,
  // Above this the guard turns suspicious and investigates.
  suspectAt: 40,
  // Above this the guard chases the player's last seen spot.
  chaseAt: 65,
};

export const SCORE = {
  loot: 100,
  levelTimeBonus: 500,
  timeBonusPerSecond: 8,
  winBonus: 1000,
};

// Palette: a night museum — cold floor, warm cones, readable silhouettes.
export const COLORS = {
  page: '#0a0e1a',
  floorA: '#1c2436',
  floorB: '#202a40',
  floorLine: '#2a3550',
  shadowFloor: '#121a2e',
  shadowEdge: '#1d2a47',
  wall: '#3d4a68',
  wallTop: '#57678c',
  crate: '#6b5433',
  crateTop: '#8a6f45',
  crateEdge: '#4a3a22',
  statue: '#7d8aa5',
  statueTop: '#9fb0cc',
  exit: '#27e07a',
  exitDark: '#0d7a40',
  loot: '#ffd94a',
  lootGlow: 'rgba(255, 217, 74, 0.25)',
  player: '#eaf6ff',
  playerRing: '#57c8ff',
  guard: '#ff5a4e',
  guardDark: '#a32e26',
  cone: 'rgba(255, 214, 90, 0.28)',
  coneEdge: 'rgba(255, 214, 90, 0.55)',
  coneAlert: 'rgba(255, 90, 78, 0.34)',
  coneAlertEdge: 'rgba(255, 90, 78, 0.65)',
  camera: '#c9d4e8',
  cameraCone: 'rgba(120, 200, 255, 0.22)',
  hudBg: '#0d1322',
  hudText: '#dfe8ff',
  hudDim: '#8b98b8',
  danger: '#ff5a4e',
  ok: '#27e07a',
  gold: '#ffd94a',
};
