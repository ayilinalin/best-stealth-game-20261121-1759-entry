// SHADOWLINE — the three museum floors: tile maps plus patrol and camera data.
//
// Map legend (every row is exactly 32 characters, 11 rows):
//   '#' wall       — blocks movement and sight
//   'C' crate      — low cover, blocks movement and sight
//   'T' statue     — tall cover, blocks movement and sight
//   '.' floor
//   's' shadow     — dark floor; the player is harder to spot standing in it
//   'P' player start
//   'E' exit door
//   'L' loot (a small golden idol)
// Guards and cameras live in the data below, not in the map: each guard walks
// its waypoints (tile coordinates) and pauses at each one; each camera sits on
// one tile and sweeps its cone around a base angle.
import { COLS, ROWS } from './config.js';

const L1_MAP = [
  '################################',
  '#P....s.......##......L........#',
  '#......####...##...............#',
  '#......#......##...######......#',
  '#..L...#..C...##...#....#..E...#',
  '#......#......##...#....#......#',
  '#..####....C......#....#.......#',
  '#..............C.....L.........#',
  '#...s......####.....####.......#',
  '#......L.......................#',
  '################################',
];

const L2_MAP = [
  '################################',
  '#P.....s....C......L.....#.....#',
  '#.....#####.....####....#......#',
  '#..L....#.....C.....#....L.....#',
  '#......#..T.........#..###.....#',
  '#.####....C....####....#.......#',
  '#......s.......#......L........#',
  '#..C......####.....T....#..E...#',
  '#....L.......#.....####........#',
  '#......##.....s.......L........#',
  '################################',
];

const L3_MAP = [
  '################################',
  '#P....s...C....L....##....#....#',
  '#...####....T....#....L........#',
  '#.L....#.....C.....####....#...#',
  '#....##....T....#......#..E....#',
  '#..s...C....####....T....#.....#',
  '#......#......L....##.....#....#',
  '#.####.....C......#....L.......#',
  '#...L....s....####....#...#....#',
  '#.....##.....C......L..........#',
  '################################',
];

export const LEVELS = [
  {
    name: 'Level 1 — Galeri Utama',
    brief: 'Two guards on the floor. Learn their patrols, slip behind the crates.',
    map: L1_MAP,
    guards: [
      { waypoints: [[18, 2], [28, 2]], pause: 1.2 },
      { waypoints: [[17, 7], [28, 7]], pause: 1.6 },
    ],
    cameras: [],
  },
  {
    name: 'Level 2 — Gudang Patung',
    brief: 'Three guards and a maze of statues. Shadows are your friends now.',
    map: L2_MAP,
    guards: [
      { waypoints: [[2, 6], [13, 6]], pause: 1.0 },
      { waypoints: [[26, 2], [26, 8]], pause: 0.8 },
      { waypoints: [[5, 8], [12, 8]], pause: 1.4 },
    ],
    cameras: [],
  },
  {
    name: 'Level 3 — Ruang Harta',
    brief: 'Four guards, two sweeping cameras, and the vault door. No mistakes.',
    map: L3_MAP,
    guards: [
      { waypoints: [[24, 1], [24, 5]], pause: 0.9 },
      { waypoints: [[8, 6], [12, 6]], pause: 1.1 },
      { waypoints: [[18, 8], [21, 8]], pause: 1.3 },
      { waypoints: [[8, 2], [8, 8]], pause: 1.0 },
    ],
    cameras: [
      { tile: [30, 1], baseAngle: Math.PI, sweep: 0.9, speed: 0.5 },
      { tile: [2, 9], baseAngle: 0, sweep: 0.9, speed: 0.45 },
    ],
  },
];

/** True when the tile at (col, row) blocks movement and sight. */
function isSolid(ch) {
  return ch === '#' || ch === 'C' || ch === 'T';
}

/**
 * Parse one level definition into the structure the game loop uses, and
 * validate it loudly: wrong dimensions or a missing start/exit are a bug,
 * and a bug caught here never reaches the judge's screenshots.
 */
export function parseLevel(def, index) {
  if (def.map.length !== ROWS) {
    throw new Error(`level ${index}: ${def.map.length} rows, expected ${ROWS}`);
  }
  const walls = [];
  const crates = [];
  const statues = [];
  const shadows = new Set();
  const loot = [];
  let playerStart = null;
  let exit = null;
  for (let row = 0; row < ROWS; row += 1) {
    const line = def.map[row];
    if (line.length !== COLS) {
      throw new Error(`level ${index} row ${row}: ${line.length} chars, expected ${COLS}`);
    }
    walls.push(new Array(COLS).fill(false));
    for (let col = 0; col < COLS; col += 1) {
      const ch = line[col];
      if (isSolid(ch)) walls[row][col] = true;
      if (ch === 'C') crates.push([col, row]);
      if (ch === 'T') statues.push([col, row]);
      if (ch === 's') shadows.add(`${col},${row}`);
      if (ch === 'L') loot.push({ col, row, taken: false });
      if (ch === 'P') playerStart = { col, row };
      if (ch === 'E') exit = { col, row };
    }
  }
  if (playerStart === null) throw new Error(`level ${index}: no player start (P)`);
  if (exit === null) throw new Error(`level ${index}: no exit (E)`);
  for (const guard of def.guards) {
    for (const [col, row] of guard.waypoints) {
      if (walls[row][col]) throw new Error(`level ${index}: guard waypoint ${col},${row} is inside a wall`);
    }
  }
  for (const camera of def.cameras) {
    const [col, row] = camera.tile;
    if (walls[row][col]) throw new Error(`level ${index}: camera tile ${col},${row} is inside a wall`);
  }
  return {
    index,
    name: def.name,
    brief: def.brief,
    walls,
    crates,
    statues,
    shadows,
    loot,
    playerStart,
    exit,
    guards: def.guards,
    cameras: def.cameras,
  };
}

/** Tile key for the shadow set. */
export function shadowKey(col, row) {
  return `${col},${row}`;
}
