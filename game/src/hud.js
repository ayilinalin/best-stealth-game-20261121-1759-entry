// SHADOWLINE — the HUD strip and the full-screen overlays.
//
// The HUD is a 40-pixel bar across the top: level name, loot, timer, score,
// and the detection meter — the one number that decides whether the run
// lives. Overlays (title, level complete, caught, heist complete) are drawn
// on top of the frozen world so every screenshot stays legible.
import { COLORS, HUD_H, VIEW_W } from './config.js';

/** The detection meter: a bar that fills amber, then red. */
function drawDetectionMeter(ctx, x, y, w, detection) {
  ctx.fillStyle = '#131a2c';
  ctx.fillRect(x, y, w, 14);
  ctx.strokeStyle = '#33405f';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 13);
  const fill = Math.max(0, Math.min(1, detection / 100));
  ctx.fillStyle = detection >= 65 ? COLORS.danger : detection >= 40 ? COLORS.gold : COLORS.ok;
  if (fill > 0) ctx.fillRect(x + 2, y + 2, (w - 4) * fill, 10);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(detection >= 65 ? 'SPOTTED!' : detection >= 40 ? 'SUSPICIOUS' : 'HIDDEN', x + w + 8, y + 7);
}

/** The top bar: what the player needs in one glance. */
export function drawHud(ctx, game) {
  ctx.fillStyle = COLORS.hudBg;
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.fillStyle = '#1d2740';
  ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('SHADOWLINE', 12, HUD_H / 2);
  ctx.font = '13px sans-serif';
  ctx.fillStyle = COLORS.hudDim;
  ctx.fillText(game.level.name, 138, HUD_H / 2);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`LOOT ${game.player.lootCollected}/${game.level.loot.length}`, 430, HUD_H / 2);
  ctx.fillStyle = COLORS.hudText;
  const totalSeconds = Math.floor(game.levelTime ?? game.time);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  ctx.fillText(`TIME ${minutes}:${String(seconds).padStart(2, '0')}`, 520, HUD_H / 2);
  ctx.fillText(`SCORE ${game.score}`, 610, HUD_H / 2);
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '12px sans-serif';
  ctx.fillText('DETECT', 730, HUD_H / 2);
  drawDetectionMeter(ctx, 790, HUD_H / 2 - 7, 150, game.detection);
  ctx.fillStyle = COLORS.hudDim;
  ctx.textAlign = 'right';
  ctx.fillText('WASD move · Shift run · C sneak · click to walk', VIEW_W - 12, HUD_H / 2);
}

/** A dim veil plus a centred panel with a title, lines and a hint. */
function overlay(ctx, title, titleColor, lines, hint) {
  ctx.fillStyle = 'rgba(6, 10, 20, 0.72)';
  ctx.fillRect(0, 0, VIEW_W, HUD_H + 440);
  ctx.fillStyle = '#101828';
  ctx.strokeStyle = '#33405f';
  ctx.lineWidth = 2;
  const pw = 560;
  const ph = 150 + lines.length * 26;
  const px = (VIEW_W - pw) / 2;
  const py = 110;
  ctx.beginPath();
  ctx.roundRect(px, py, pw, ph, 12);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = titleColor;
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(title, VIEW_W / 2, py + 52);
  ctx.fillStyle = COLORS.hudText;
  ctx.font = '15px sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, py + 92 + i * 26);
  });
  ctx.fillStyle = COLORS.hudDim;
  ctx.font = '13px sans-serif';
  ctx.fillText(hint, VIEW_W / 2, py + ph - 18);
}

export function drawTitle(ctx, game) {
  overlay(
    ctx,
    'SHADOWLINE',
    COLORS.gold,
    ['A night heist in the city museum.', game.level.brief, 'Reach the green EXIT unseen. Grab the gold idols on the way.'],
    'Press ENTER or click to start  ·  WASD / arrows to move  ·  Shift to run  ·  C to sneak',
  );
}

export function drawLevelComplete(ctx, game) {
  overlay(
    ctx,
    'CLEAN GETAWAY',
    COLORS.ok,
    [`${game.level.name} cleared — unseen.`, `Loot ${game.player.lootCollected}/${game.level.loot.length}  ·  Time bonus +${game.lastBonus}`, `Score ${game.score}`],
    'Press ENTER for the next floor',
  );
}

export function drawCaught(ctx, game) {
  overlay(
    ctx,
    'CAUGHT!',
    COLORS.danger,
    ['A guard spotted you in the open.', `${game.level.name}  ·  Loot kept: ${game.player.lootCollected}`, 'Shadows and cover break line of sight — sneak, don\'t sprint.'],
    'Press R to retry the floor',
  );
}

export function drawHeistComplete(ctx, game) {
  overlay(
    ctx,
    'HEIST COMPLETE',
    COLORS.gold,
    ['Every floor cleared. The museum never saw you.', `Final score ${game.score}  ·  Idols ${game.runLoot}/${game.totalLootMax}`, 'SHADOWLINE — thanks for playing.'],
    'Press ENTER to run it again',
  );
}
