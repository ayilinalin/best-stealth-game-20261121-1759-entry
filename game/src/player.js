// SHADOWLINE — the thief: walk, run, sneak, and the noise each one makes.
//
// Movement is circle-vs-wall: the player slides along walls instead of
// sticking to them. Stance is one of 'walk', 'run' or 'sneak' and decides
// speed, noise radius and how fast a guard's meter fills. A click on the
// floor sets a waypoint the player walks to on their own, so the game plays
// with the mouse as well as the keyboard.
import { PLAYER, TILE } from './config.js';

export class Player {
  constructor(start) {
    this.x = (start.col + 0.5) * TILE;
    this.y = (start.row + 0.5) * TILE;
    this.radius = PLAYER.radius;
    this.stance = 'walk';
    this.moving = false;
    this.faceAngle = -Math.PI / 2;
    this.waypoint = null;
    this.lootCollected = 0;
    this.steps = 0;
  }

  /** Speed in pixels per second for the current stance. */
  get speed() {
    if (this.stance === 'run') return PLAYER.runSpeed;
    if (this.stance === 'sneak') return PLAYER.sneakSpeed;
    return PLAYER.walkSpeed;
  }

  /** Noise radius in pixels for the current stance, while moving. */
  get noiseRadius() {
    if (!this.moving) return 0;
    if (this.stance === 'run') return PLAYER.noiseRun;
    if (this.stance === 'sneak') return PLAYER.noiseSneak;
    return PLAYER.noiseWalk;
  }

  /** Set the stance from the held keys: Shift runs, C or Control sneaks. */
  setStanceFromKeys(keys) {
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) this.stance = 'run';
    else if (keys.has('KeyC') || keys.has('ControlLeft') || keys.has('ControlRight')) this.stance = 'sneak';
    else this.stance = 'walk';
  }

  /**
   * One step: read the keys (and the click waypoint), move, collide, and
   * pick up loot. Returns 'loot' when an idol was just collected.
   */
  update(dt, keys, level, walls) {
    let dx = 0;
    let dy = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) dy -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) dy += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) dx -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) dx += 1;
    if (dx !== 0 || dy !== 0) {
      // A key press always wins over the click waypoint.
      this.waypoint = null;
    } else if (this.waypoint !== null) {
      const wx = this.waypoint.x - this.x;
      const wy = this.waypoint.y - this.y;
      if (Math.hypot(wx, wy) < 6) {
        this.waypoint = null;
      } else {
        dx = wx;
        dy = wy;
      }
    }
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    if (this.moving) {
      const step = this.speed * dt;
      const nx = this.x + (dx / len) * step;
      const ny = this.y + (dy / len) * step;
      this.faceAngle = Math.atan2(dy, dx);
      // Move axis by axis so the player slides along walls.
      if (!this.hitsWall(nx, this.y, walls)) this.x = nx;
      if (!this.hitsWall(this.x, ny, walls)) this.y = ny;
      this.steps += 1;
    }
    for (const item of level.loot) {
      if (item.taken) continue;
      const lx = (item.col + 0.5) * TILE;
      const ly = (item.row + 0.5) * TILE;
      if (Math.hypot(lx - this.x, ly - this.y) < this.radius + 12) {
        item.taken = true;
        this.lootCollected += 1;
        return 'loot';
      }
    }
    return null;
  }

  /** True when a circle at (x, y) overlaps any solid tile. */
  hitsWall(x, y, walls) {
    const r = this.radius;
    const col0 = Math.floor((x - r) / TILE);
    const col1 = Math.floor((x + r) / TILE);
    const row0 = Math.floor((y - r) / TILE);
    const row1 = Math.floor((y + r) / TILE);
    for (let row = row0; row <= row1; row += 1) {
      for (let col = col0; col <= col1; col += 1) {
        if (row < 0 || row >= walls.length || col < 0 || col >= walls[0].length) return true;
        if (!walls[row][col]) continue;
        const nearestX = Math.max(col * TILE, Math.min(x, (col + 1) * TILE));
        const nearestY = Math.max(row * TILE, Math.min(y, (row + 1) * TILE));
        if (Math.hypot(x - nearestX, y - nearestY) < r) return true;
      }
    }
    return false;
  }

  /** True when the player stands on the exit tile. */
  onExit(level) {
    const col = Math.floor(this.x / TILE);
    const row = Math.floor(this.y / TILE);
    return col === level.exit.col && row === level.exit.row;
  }
}
