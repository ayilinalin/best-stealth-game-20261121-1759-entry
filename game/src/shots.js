// SHADOWLINE — the screenshot scenes behind ?shot=cover|hide|patrol|win.
//
// Each scene plays the real rules forward from a fresh level for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same
// frame. The autopilot walks a list of waypoints and waits, crouched,
// whenever a guard's cone covers the path ahead — patience, the way the
// game is meant to be played.
import { STEP, TILE } from './config.js';
import { hasLineOfSight } from './guard.js';
import { CONE } from './config.js';
import { angleNorm } from './guard.js';

const SAMPLE = STEP;

/** Is the point (x, y) inside any guard's or camera's cone, with sight? */
function pointThreatened(x, y, game) {
  for (const guard of game.guards) {
    const dx = x - guard.x;
    const dy = y - guard.y;
    const dist = Math.hypot(dx, dy);
    if (dist > CONE.range) continue;
    const toPoint = Math.atan2(dy, dx);
    if (Math.abs(angleNorm(toPoint - guard.angle)) > CONE.halfAngle) continue;
    if (hasLineOfSight(guard.x, guard.y, x, y, game.level.walls)) return true;
  }
  for (const camera of game.cameras) {
    const dx = x - camera.x;
    const dy = y - camera.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 190) continue;
    const toPoint = Math.atan2(dy, dx);
    if (Math.abs(angleNorm(toPoint - camera.angle)) > (30 * Math.PI) / 180) continue;
    if (hasLineOfSight(camera.x, camera.y, x, y, game.level.walls)) return true;
  }
  return false;
}

/** Is any point on the segment threatened? Sampled every half tile. */
function segmentThreatened(x0, y0, x1, y1, game) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const samples = Math.max(2, Math.ceil(dist / (TILE / 2)));
  for (let i = 1; i <= samples; i += 1) {
    const t = i / samples;
    if (pointThreatened(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, game)) return true;
  }
  return false;
}

/**
 * Drive the player along `waypoints` (tile coordinates) for at most
 * `maxSeconds` of simulated time. Waits, crouched, while the next leg is
 * covered by a cone. Returns true when the last waypoint was reached.
 */
function walkRoute(game, waypoints, maxSeconds) {
  const points = waypoints.map(([col, row]) => ({ x: (col + 0.5) * TILE, y: (row + 0.5) * TILE }));
  let leg = 0;
  const steps = Math.floor(maxSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (game.state !== 'play') return game.state === 'levelComplete' || game.state === 'heistComplete';
    if (leg >= points.length) return true;
    const target = points[leg];
    const player = game.player;
    const arrived = Math.hypot(target.x - player.x, target.y - player.y) < 8;
    if (arrived) {
      leg += 1;
      continue;
    }
    if (segmentThreatened(player.x, player.y, target.x, target.y, game)) {
      // Hold still, crouched, until the cone moves off the path ahead.
      player.waypoint = null;
      player.stance = 'sneak';
      game.step(SAMPLE, new Set(['KeyC']));
    } else {
      player.stance = 'walk';
      player.waypoint = { x: target.x, y: target.y };
      game.step(SAMPLE, new Set());
    }
  }
  return leg >= points.length;
}

/** Place a guard at a tile, facing an angle, for a posed frame. */
function poseGuard(game, index, col, row, angle) {
  const guard = game.guards[index];
  guard.x = (col + 0.5) * TILE;
  guard.y = (row + 0.5) * TILE;
  guard.angle = angle;
  guard.waitTimer = 999;
  guard.state = 'patrol';
}

/** Step the world until detection reaches `target` (or `maxSeconds` pass). */
function untilDetection(game, target, maxSeconds) {
  const steps = Math.floor(maxSeconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    if (game.detection >= target || game.state !== 'play') return;
    // Hold C: stay crouched in the dark while the cone closes in.
    game.step(SAMPLE, new Set(['KeyC']));
  }
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * 'cover': level 1, the thief just inside the door, patrols sweeping.
 * 'hide': level 1, crouched behind a crate as a cone closes in, meter half full.
 * 'patrol': level 3, four guards and two cameras on the hardest floor.
 * 'win': level 1, played through to the exit by the autopilot.
 */
export function stageShot(name, game) {
  if (name === 'hide') {
    game.loadLevel(0);
    game.state = 'play';
    game.player.x = (16 + 0.5) * TILE;
    game.player.y = (8 + 0.5) * TILE;
    game.player.stance = 'sneak';
    // Guard B on its own patrol row, close enough to see the thief (165 px,
    // inside the 210 px cone) and facing straight at them.
    poseGuard(game, 1, 20, 7, Math.PI);
    untilDetection(game, 35, 6);
    return { screen: 'play' };
  }
  if (name === 'patrol') {
    game.loadLevel(2);
    game.state = 'play';
    walkRoute(game, [[10, 2]], 8);
    return { screen: 'play' };
  }
  if (name === 'win') {
    game.loadLevel(0);
    game.state = 'play';
    // South along the west wall, east along the bottom, north past the
    // patrol — the quiet way through the gallery.
    walkRoute(game, [[1, 9], [28, 9], [28, 4], [27, 4]], 90);
    if (game.state === 'play') {
      // The autopilot stalled: step the thief onto the exit by hand and let
      // the real exit rule fire, so the overlay is the game's own.
      game.player.x = (26 + 0.5) * TILE;
      game.player.y = (4 + 0.5) * TILE;
      game.player.waypoint = { x: (27 + 0.5) * TILE, y: (4 + 0.5) * TILE };
      game.player.stance = 'walk';
      for (let i = 0; i < 120 && game.state === 'play'; i += 1) game.step(SAMPLE, new Set());
    }
    return { screen: game.state === 'levelComplete' ? 'levelComplete' : 'play' };
  }
  // Default: 'cover'.
  game.loadLevel(0);
  game.state = 'play';
  walkRoute(game, [[8, 1]], 6);
  return { screen: 'play' };
}
