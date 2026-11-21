// SHADOWLINE — the game itself: state, loop, detection, noise, scoring.
//
// States: title → play → (caught | levelComplete) → play … → heistComplete.
// One fixed step (1/60 s) advances the world: the player moves, the guards
// patrol and look, the cameras sweep, and a single detection meter fills
// while anyone sees the thief and drains while nobody does. Fill it and the
// run ends; reach the green exit and the floor is cleared.
//
// ?shot=cover|hide|patrol|win stages a screenshot scene and freezes it;
// ?selftest=1 runs the rules headlessly and reports in document.title.
import { COLORS, DETECT, HUD_H, SCORE, STEP, TILE, VIEW_H, VIEW_W } from './config.js';
import { LEVELS as LEVEL_DEFS, parseLevel } from './level.js';
import { Guard, hasLineOfSight, playerInShadow } from './guard.js';
import { Player } from './player.js';
import { drawWorld } from './render.js';
import { drawCaught, drawHeistComplete, drawHud, drawLevelComplete, drawTitle } from './hud.js';
import { alarmSound, ensureAudio, lootSound, stepSound, winSound } from './audio.js';
import { stageShot } from './shots.js';
import { mulberry32 } from './rng.js';

const CAMERA_RANGE = 190;
const CAMERA_HALF = (30 * Math.PI) / 180;
function stanceMult(player) {
  if (player.stance === 'run') return DETECT.runMult;
  if (player.stance === 'sneak') return DETECT.sneakMult;
  return 1;
}

function distanceMult(dist) {
  if (dist < DETECT.nearDist) return 1.6;
  if (dist > DETECT.farDist) return 0.55;
  return 1;
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.keys = new Set();
    this.state = 'title';
    this.levelIndex = 0;
    this.score = 0;
    this.scoreAtLevelStart = 0;
    this.runLoot = 0;
    this.runLootAtLevelStart = 0;
    this.totalLootMax = LEVEL_DEFS.reduce((n, def) => n + def.map.join('').split('L').length - 1, 0);
    this.detection = 0;
    this.time = 0;
    this.levelTime = 0;
    this.lastBonus = 0;
    this.frozen = false;
    this.rng = mulberry32(1);
    this.seed = 1;
    this.level = null;
    this.player = null;
    this.guards = [];
    this.cameras = [];
    this.loadLevel(0);
    this.state = 'title';
  }

  /** Load a floor fresh: new loot, guards on their patrols, meter empty. */
  loadLevel(index) {
    this.levelIndex = index;
    this.level = parseLevel(LEVEL_DEFS[index], index);
    this.player = new Player(this.level.playerStart);
    this.guards = this.level.guards.map((def) => {
      const guard = new Guard(def, this.level);
      guard.waitTimer = this.rng() * 0.4;
      return guard;
    });
    this.cameras = this.level.cameras.map((def) => {
      const x = (def.tile[0] + 0.5) * TILE;
      const y = (def.tile[1] + 0.5) * TILE;
      return { ...def, x, y, phase: this.rng() * Math.PI * 2, angle: def.baseAngle };
    });
    this.detection = 0;
    this.levelTime = 0;
    this.scoreAtLevelStart = this.score;
    this.runLootAtLevelStart = this.runLoot;
    this.state = 'play';
  }

  /** True when any guard currently sees the player. */
  anyGuardSeesPlayer() {
    return this.guards.some((guard) => guard.seesPlayer);
  }

  /** Does this camera see the player right now? */
  cameraSees(camera) {
    const dx = this.player.x - camera.x;
    const dy = this.player.y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CAMERA_RANGE || dist < 1) return false;
    const toPlayer = Math.atan2(dy, dx);
    if (Math.abs(((toPlayer - camera.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > CAMERA_HALF) return false;
    return hasLineOfSight(camera.x, camera.y, this.player.x, this.player.y, this.level.walls);
  }

  /** One fixed step of the world. `keys` is the set of held key codes. */
  step(dt, keys) {
    this.time += dt;
    if (this.state !== 'play') return;
    this.levelTime += dt;
    // Cameras sweep first: guards and detection read the fresh angle.
    for (const camera of this.cameras) {
      camera.angle = camera.baseAngle + Math.sin(this.time * camera.speed + camera.phase) * camera.sweep;
    }
    this.player.setStanceFromKeys(keys);
    const pickup = this.player.update(dt, keys, this.level, this.level.walls);
    if (pickup === 'loot') {
      this.score += SCORE.loot;
      this.runLoot += 1;
      lootSound();
    }
    for (const guard of this.guards) guard.update(dt, this);
    // Detection: every watcher that sees the thief fills the meter.
    const inShadow = playerInShadow(this.player, this.level);
    let rate = 0;
    for (const guard of this.guards) {
      if (guard.seesPlayer) rate += guard.exposureRate(this.player, inShadow);
    }
    for (const camera of this.cameras) {
      if (this.cameraSees(camera)) {
        const dist = Math.hypot(this.player.x - camera.x, this.player.y - camera.y);
        let cameraRate = DETECT.baseRate * stanceMult(this.player) * distanceMult(dist);
        if (inShadow) cameraRate *= DETECT.shadowMult;
        rate += cameraRate;
      }
    }
    if (rate > 0) {
      this.detection = Math.min(100, this.detection + rate * dt);
    } else {
      this.detection = Math.max(0, this.detection - DETECT.decayRate * dt);
    }
    // Noise: a running thief is heard, and the nearest guard comes to look.
    const noise = this.player.noiseRadius;
    if (noise > 0 && this.player.moving) {
      for (const guard of this.guards) {
        if (guard.state !== 'patrol') continue;
        const dist = Math.hypot(guard.x - this.player.x, guard.y - this.player.y);
        if (dist < noise + 30) {
          guard.state = 'investigate';
          guard.investigate = { x: this.player.x, y: this.player.y };
          guard.arrived = false;
        }
      }
    }
    if (this.detection >= 100) {
      this.state = 'caught';
      alarmSound();
      return;
    }
    if (this.player.onExit(this.level)) this.completeLevel();
  }

  /** The exit rule: bank the time bonus and open the next floor. */
  completeLevel() {
    const bonus = SCORE.levelTimeBonus + Math.max(0, Math.round(150 - this.levelTime)) * SCORE.timeBonusPerSecond;
    this.lastBonus = bonus;
    this.score += bonus;
    winSound();
    if (this.levelIndex >= LEVEL_DEFS.length - 1) {
      this.score += SCORE.winBonus;
      this.state = 'heistComplete';
    } else {
      this.state = 'levelComplete';
    }
  }

  /** Next floor after a clear, or restart after the heist. */
  advance() {
    if (this.state === 'levelComplete') this.loadLevel(this.levelIndex + 1);
    else if (this.state === 'heistComplete') this.restart();
  }

  /** Retry the current floor, rolling the score back to its start. */
  retry() {
    this.score = this.scoreAtLevelStart;
    this.runLoot = this.runLootAtLevelStart;
    this.loadLevel(this.levelIndex);
  }

  /** A fresh run from floor one. */
  restart() {
    this.score = 0;
    this.runLoot = 0;
    this.loadLevel(0);
    this.state = 'title';
  }

  /** Draw one frame: the world, the HUD, and any overlay for the state. */
  render() {
    const ctx = this.ctx;
    ctx.fillStyle = COLORS.page;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    drawWorld(ctx, this);
    drawHud(ctx, this);
    if (this.state === 'title') drawTitle(ctx, this);
    else if (this.state === 'levelComplete') drawLevelComplete(ctx, this);
    else if (this.state === 'caught') drawCaught(ctx, this);
    else if (this.state === 'heistComplete') drawHeistComplete(ctx, this);
  }
}

/**
 * The headless rule check behind ?selftest=1: movement, walls, sight,
 * the exit and the shot stager, each on the real step function. The verdict
 * lands in document.title so a script can read it without a browser UI.
 */
function runSelfTest(game) {
  const results = [];
  const check = (name, ok) => results.push(`${name}:${ok ? 'ok' : 'FAIL'}`);
  // 1. The player moves when a key is held.
  game.loadLevel(0);
  game.state = 'play';
  const x0 = game.player.x;
  for (let i = 0; i < 30; i += 1) game.step(STEP, new Set(['KeyD']));
  check('move', game.player.x > x0 + 20);
  // 2. A wall stops the player: the drawn circle never crosses the wall
  //    edge (the left wall ends at x=40), it just slides up to it.
  game.loadLevel(0);
  game.state = 'play';
  const wx0 = game.player.x;
  for (let i = 0; i < 120; i += 1) game.step(STEP, new Set(['KeyA']));
  check('wall', game.player.x >= wx0 - 14 && game.player.x - game.player.radius >= 39);
  // 3. Standing in a guard's cone fills the meter.
  game.loadLevel(0);
  game.state = 'play';
  const guard = game.guards[0];
  game.player.x = guard.x + 100;
  game.player.y = guard.y;
  guard.angle = 0;
  guard.waitTimer = 999;
  for (let i = 0; i < 90; i += 1) game.step(STEP, new Set());
  check('detect', game.detection > 5);
  // 4. Reaching the exit clears the floor.
  game.loadLevel(0);
  game.state = 'play';
  game.player.x = (game.level.exit.col + 0.5) * TILE;
  game.player.y = (game.level.exit.row + 0.5) * TILE;
  game.step(STEP, new Set());
  check('exit', game.state === 'levelComplete');
  // 5. Every staged scene renders without throwing and without a catch.
  let staged = true;
  for (const name of ['cover', 'hide', 'patrol', 'win']) {
    try {
      stageShot(name, game);
      if (game.state === 'caught') staged = false;
    } catch {
      staged = false;
    }
  }
  check('shots', staged);
  const passed = results.filter((r) => r.endsWith(':ok')).length;
  document.title = `SELFTEST ${passed}/${results.length} ${results.join(' ')}`;
  return passed === results.length;
}

/** Boot: wire input, stage a shot or a self-test, and run the loop. */
function boot() {
  const canvas = document.getElementById('game');
  const game = new Game(canvas);
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get('seed') ?? '1', 10);
  if (Number.isFinite(seed) && seed > 0) {
    game.seed = seed;
    game.rng = mulberry32(seed);
  }
  window.addEventListener('keydown', (event) => {
    ensureAudio();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
    if (event.repeat) return;
    game.keys.add(event.code);
    if (event.code === 'Enter') {
      if (game.state === 'title') game.state = 'play';
      else if (game.state === 'levelComplete' || game.state === 'heistComplete') game.advance();
    }
    if (event.code === 'KeyR' && game.state === 'caught') game.retry();
    if (event.code === 'KeyM' && game.state === 'title') game.state = 'play';
  });
  window.addEventListener('keyup', (event) => {
    game.keys.delete(event.code);
  });
  canvas.addEventListener('mousedown', (event) => {
    ensureAudio();
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * VIEW_W;
    const y = ((event.clientY - rect.top) / rect.height) * VIEW_H;
    if (game.state === 'title') {
      game.state = 'play';
      return;
    }
    if (game.state === 'levelComplete' || game.state === 'heistComplete') {
      game.advance();
      return;
    }
    if (game.state === 'caught') {
      game.retry();
      return;
    }
    if (y > HUD_H) game.player.waypoint = { x, y: y - HUD_H };
  });
  // A soft footstep tick while the thief walks, from the loop below.
  let lastStepSound = 0;
  if (params.get('selftest') === '1') {
    runSelfTest(game);
    game.loadLevel(0);
    game.state = 'title';
  }
  const shot = params.get('shot');
  if (shot !== null) {
    stageShot(shot, game);
    game.frozen = true;
  }
  let last = performance.now();
  let accumulator = 0;
  function frame(now) {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!game.frozen) {
      accumulator += elapsed;
      while (accumulator >= STEP) {
        game.step(STEP, game.keys);
        accumulator -= STEP;
      }
      if (game.state === 'play' && game.player.moving && game.time - lastStepSound > 0.34) {
        lastStepSound = game.time;
        stepSound(game.player.stance === 'sneak');
      }
    }
    game.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

boot();
