// SHADOWLINE — guards: patrol, vision, suspicion and chase.
//
// A guard walks its waypoints and pauses at each one. Every step it asks
// one question: can I see the player? Sight needs three things — the player
// inside the cone, a clear line (no wall between us), and enough light. The
// answer feeds a single detection meter owned by the game: while any guard
// (or camera) sees the player it fills, while nobody sees them it drains.
// Crossing the suspicion line makes the nearest guard walk over to look;
// crossing the chase line makes every guard converge.
import { CONE, DETECT, TILE } from './config.js';
import { shadowKey } from './level.js';

const TAU = Math.PI * 2;

/** Centre of a tile, in pixels (playfield origin is below the HUD). */
export function tileCenter(col, row) {
  return { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE };
}

/** Normalise an angle to (-PI, PI]. */
export function angleNorm(a) {
  while (a > Math.PI) a -= TAU;
  while (a <= -Math.PI) a += TAU;
  return a;
}

/**
 * True when the straight segment between two points crosses no solid tile.
 * Walks the segment in small steps and asks the level's wall grid.
 */
export function hasLineOfSight(x0, y0, x1, y1, walls) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy);
  const steps = Math.max(1, Math.ceil(dist / 6));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    const col = Math.floor((x0 + dx * t) / TILE);
    const row = Math.floor((y0 + dy * t) / TILE);
    if (row < 0 || row >= walls.length || col < 0 || col >= walls[0].length) return false;
    if (walls[row][col]) return false;
  }
  return true;
}

/** Is the player standing on a shadow tile? */
export function playerInShadow(player, level) {
  const col = Math.floor(player.x / TILE);
  const row = Math.floor(player.y / TILE);
  return level.shadows.has(shadowKey(col, row));
}

export class Guard {
  constructor(def, level) {
    this.level = level;
    this.waypoints = def.waypoints.map(([col, row]) => tileCenter(col, row));
    this.pause = def.pause ?? 1;
    this.targetIndex = 1 % this.waypoints.length;
    const start = this.waypoints[0];
    this.x = start.x;
    this.y = start.y;
    this.speed = 62;
    this.angle = 0;
    this.waitTimer = 0;
    this.state = 'patrol';
    this.investigate = null;
    this.suspicion = 0;
    this.arrived = false;
    this.lookTimer = 0;
    this.faceAngle = 0;
    this.seesPlayer = false;
  }

  /** Where the guard is looking, in radians. */
  get facing() {
    return this.angle;
  }

  /** Update one step. Returns nothing; detection is folded into `game`. */
  update(dt, game) {
    const player = game.player;
    this.seesPlayer = this.canSee(player);
    if (this.state === 'patrol') this.patrol(dt, game);
    else if (this.state === 'investigate') this.investigatePoint(dt, game);
    else if (this.state === 'chase') this.chasePlayer(dt, game);
    // A guard that spots the player hard turns to face them.
    if (this.seesPlayer && game.detection >= DETECT.suspectAt) {
      this.angle = Math.atan2(player.y - this.y, player.x - this.x);
    }
  }

  /** Can this guard see the player right now? Also returns the exposure 0..1. */
  canSee(player) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE.range || dist < 1) return false;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleNorm(toPlayer - this.angle)) > CONE.halfAngle) return false;
    if (!hasLineOfSight(this.x, this.y, player.x, player.y, this.level.walls)) return false;
    return true;
  }

  /** How fast detection fills from this guard: stance, light and distance. */
  exposureRate(player, inShadow) {
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.hypot(dx, dy);
    let rate = DETECT.baseRate;
    if (player.stance === 'run') rate *= DETECT.runMult;
    else if (player.stance === 'sneak') rate *= DETECT.sneakMult;
    if (inShadow) rate *= DETECT.shadowMult;
    if (dist < DETECT.nearDist) rate *= 1.6;
    else if (dist > DETECT.farDist) rate *= 0.55;
    return rate;
  }

  /** Walk to `tx, ty` at this guard's speed; true when arrived. */
  moveToward(tx, ty, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) return true;
    const step = Math.min(dist, this.speed * dt);
    this.x += (dx / dist) * step;
    this.y += (dy / dist) * step;
    this.angle = Math.atan2(dy, dx);
    return dist - step < 2;
  }

  patrol(dt, game) {
    if (this.waitTimer > 0) {
      this.waitTimer -= dt;
      return;
    }
    const target = this.waypoints[this.targetIndex];
    if (this.moveToward(target.x, target.y, dt)) {
      this.targetIndex = (this.targetIndex + 1) % this.waypoints.length;
      this.waitTimer = this.pause;
    }
    // A suspicious guard leaves the patrol to look.
    if (game.detection >= DETECT.suspectAt && this.seesPlayer) {
      this.state = 'investigate';
      this.investigate = { x: game.player.x, y: game.player.y };
      this.arrived = false;
    }
  }

  investigatePoint(dt, game) {
    const point = this.investigate;
    if (point === null) {
      this.state = 'patrol';
      return;
    }
    if (!this.arrived) {
      if (this.moveToward(point.x, point.y, dt)) {
        this.arrived = true;
        this.faceAngle = this.angle;
        this.lookTimer = 2.2;
      }
    } else {
      // Arrived: sweep the gaze side to side, then give up and patrol on.
      this.lookTimer -= dt;
      this.angle = this.faceAngle + Math.sin((2.2 - this.lookTimer) * 2.4) * 1.1;
      if (this.lookTimer <= 0) {
        this.state = 'patrol';
        this.investigate = null;
        this.arrived = false;
      }
    }
    if (game.detection >= DETECT.chaseAt && this.seesPlayer) this.state = 'chase';
    if (game.detection < DETECT.suspectAt * 0.5) {
      this.state = 'patrol';
      this.investigate = null;
      this.arrived = false;
    }
  }

  chasePlayer(dt, game) {
    this.speed = 96;
    if (this.seesPlayer) {
      this.moveToward(game.player.x, game.player.y, dt);
    } else {
      this.speed = 62;
      this.state = 'investigate';
      this.investigate = { x: game.player.x, y: game.player.y };
      this.arrived = false;
    }
  }
}
