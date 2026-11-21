// SHADOWLINE — the top-down view: floor, cover, cones, and the thief.
//
// Everything is drawn with canvas paths, no images: the floor is a checker
// of cold tiles, cover reads as solid blocks with a lit top edge, and a
// guard's vision is a translucent cone clipped by walls — cast one ray per
// slice of the arc and stop each ray at the first solid tile, so the cone
// never shines through a wall the guard cannot see past.
import { COLORS, CONE, HUD_H, TILE } from './config.js';
import { angleNorm } from './guard.js';

const CAMERA_RANGE = 190;
const CAMERA_HALF = (30 * Math.PI) / 180;

/** The tiles a point at (x, y) in playfield pixels stands on. */
function tileAt(x, y, walls) {
  const col = Math.floor(x / TILE);
  const row = Math.floor(y / TILE);
  if (row < 0 || row >= walls.length || col < 0 || col >= walls[0].length) return true;
  return walls[row][col];
}

/**
 * Cast one ray from (x, y) along `angle` until it hits a wall or `range`:
 * the distance the cone reaches in that direction.
 */
export function castRay(x, y, angle, range, walls) {
  const step = 4;
  const dx = Math.cos(angle) * step;
  const dy = Math.sin(angle) * step;
  let px = x;
  let py = y;
  for (let d = 0; d < range; d += step) {
    px += dx;
    py += dy;
    if (tileAt(px, py, walls)) return Math.max(0, d);
  }
  return range;
}

/** Fill a vision cone from (x, y) along `angle`, clipped by the walls. */
function drawCone(ctx, x, y, angle, halfAngle, range, walls, fill, edge) {
  const rays = CONE.rays;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = castRay(x, y, a, range, walls);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = edge;
  ctx.lineWidth = 1;
  ctx.stroke();
}

/** The museum floor: alternating cold tiles, shadow patches, and a grid. */
function drawFloor(ctx, level) {
  for (let row = 0; row < level.walls.length; row += 1) {
    for (let col = 0; col < level.walls[0].length; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      const inShadow = level.shadows.has(`${col},${row}`);
      ctx.fillStyle = inShadow ? COLORS.shadowFloor : (col + row) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = inShadow ? COLORS.shadowEdge : COLORS.floorLine;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
    }
  }
}

/** Walls, crates and statues: a solid block with a lit top edge. */
function drawCover(ctx, level) {
  for (let row = 0; row < level.walls.length; row += 1) {
    for (let col = 0; col < level.walls[0].length; col += 1) {
      const x = col * TILE;
      const y = row * TILE;
      if (!level.walls[row][col]) continue;
      const isCrate = level.crates.some(([c, r]) => c === col && r === row);
      const isStatue = level.statues.some(([c, r]) => c === col && r === row);
      if (isCrate) {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
        ctx.fillStyle = COLORS.crateTop;
        ctx.fillRect(x + 2, y + 2, TILE - 4, 8);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 2, y + TILE / 2);
        ctx.lineTo(x + TILE - 2, y + TILE / 2);
        ctx.strokeStyle = COLORS.crateEdge;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (isStatue) {
        ctx.fillStyle = COLORS.statue;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = COLORS.statueTop;
        ctx.beginPath();
        ctx.arc(x + TILE / 2 - 3, y + TILE / 2 - 3, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = COLORS.wall;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x + TILE / 2, y + TILE / 2, 14, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 6);
        ctx.strokeStyle = COLORS.floorLine;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      }
    }
  }
}

/** The exit door: a green gate with an arrow, pulsing gently. */
function drawExit(ctx, level, time) {
  const x = level.exit.col * TILE;
  const y = level.exit.row * TILE;
  const pulse = 0.75 + 0.25 * Math.sin(time * 3);
  ctx.fillStyle = COLORS.exitDark;
  ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = `rgba(39, 224, 122, ${0.55 * pulse + 0.25})`;
  ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
  // A plain arrow, drawn with paths so it renders in any font set.
  ctx.fillStyle = '#062b18';
  ctx.beginPath();
  ctx.moveTo(x + 12, y + TILE / 2 - 6);
  ctx.lineTo(x + 26, y + TILE / 2 - 6);
  ctx.lineTo(x + 26, y + TILE / 2 - 11);
  ctx.lineTo(x + 34, y + TILE / 2);
  ctx.lineTo(x + 26, y + TILE / 2 + 11);
  ctx.lineTo(x + 26, y + TILE / 2 + 6);
  ctx.lineTo(x + 12, y + TILE / 2 + 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.exit;
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('EXIT', x + TILE / 2, y + TILE - 8);
}

/** Loot idols: small gold diamonds with a soft glow. */
function drawLoot(ctx, level, time) {
  for (const item of level.loot) {
    if (item.taken) continue;
    const x = (item.col + 0.5) * TILE;
    const y = (item.row + 0.5) * TILE + Math.sin(time * 2 + item.col) * 2;
    ctx.fillStyle = COLORS.lootGlow;
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.loot;
    ctx.beginPath();
    ctx.moveTo(x, y - 9);
    ctx.lineTo(x + 7, y);
    ctx.lineTo(x, y + 9);
    ctx.lineTo(x - 7, y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#7a5b00';
    ctx.beginPath();
    ctx.arc(x, y, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Wall cameras: a dome and a sweeping blue cone. */
function drawCameras(ctx, cameras, walls, time) {
  for (const camera of cameras) {
    // The game step keeps camera.angle fresh; fall back to the sweep math.
    const angle = camera.angle ?? camera.baseAngle + Math.sin(time * camera.speed) * camera.sweep;
    drawCone(ctx, camera.x, camera.y, angle, CAMERA_HALF, CAMERA_RANGE, walls, COLORS.cameraCone, 'rgba(120, 200, 255, 0.4)');
    ctx.fillStyle = COLORS.camera;
    ctx.beginPath();
    ctx.arc(camera.x, camera.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#22304a';
    ctx.beginPath();
    ctx.arc(camera.x + Math.cos(angle) * 4, camera.y + Math.sin(angle) * 4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One guard: cone first, then the body, then the alarm mark above. */
function drawGuard(ctx, guard, walls, detection) {
  const alert = detection >= 40;
  drawCone(
    ctx,
    guard.x,
    guard.y,
    guard.angle,
    CONE.halfAngle,
    CONE.range,
    walls,
    alert ? COLORS.coneAlert : COLORS.cone,
    alert ? COLORS.coneAlertEdge : COLORS.coneEdge,
  );
  ctx.fillStyle = COLORS.guardDark;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.guard;
  ctx.beginPath();
  ctx.arc(guard.x, guard.y, 11, 0, Math.PI * 2);
  ctx.fill();
  // Facing tick: a short nose showing where the guard looks.
  ctx.strokeStyle = '#ffd9d6';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(guard.x, guard.y);
  ctx.lineTo(guard.x + Math.cos(guard.angle) * 15, guard.y + Math.sin(guard.angle) * 15);
  ctx.stroke();
  if (guard.state !== 'patrol') {
    ctx.fillStyle = guard.state === 'chase' ? '#ff2e1f' : COLORS.loot;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(guard.state === 'chase' ? '!' : '?', guard.x, guard.y - 16);
  }
}

/** The player: a pale circle with a facing tick and a stance ring. */
function drawPlayer(ctx, player, time) {
  if (player.waypoint !== null) {
    ctx.strokeStyle = 'rgba(87, 200, 255, 0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(player.waypoint.x, player.waypoint.y, 8 + Math.sin(time * 5) * 2, 0, Math.PI * 2);
    ctx.stroke();
  }
  const noise = player.noiseRadius;
  if (noise > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(player.x, player.y, noise, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = player.stance === 'sneak' ? '#9fb6d8' : COLORS.player;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.playerRing;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = '#0a0e1a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y);
  ctx.lineTo(player.x + Math.cos(player.faceAngle) * (player.radius + 2), player.y + Math.sin(player.faceAngle) * (player.radius + 2));
  ctx.stroke();
}

/**
 * Draw the whole playfield (below the HUD strip). `game` carries the level,
 * player, guards, cameras, detection and clock.
 */
export function drawWorld(ctx, game) {
  const level = game.level;
  ctx.save();
  ctx.translate(0, HUD_H);
  drawFloor(ctx, level);
  drawExit(ctx, level, game.time);
  drawLoot(ctx, level, game.time);
  // Cover before the actors, so the thief and the guards stay readable.
  drawCover(ctx, level);
  drawCameras(ctx, game.cameras, level.walls, game.time);
  for (const guard of game.guards) drawGuard(ctx, guard, level.walls, game.detection);
  drawPlayer(ctx, game.player, game.time);
  ctx.restore();
}

/** Re-export for the shot stager: the cone math it reuses is in guard.js. */
export { angleNorm };
