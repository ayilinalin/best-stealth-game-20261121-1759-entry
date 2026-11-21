// SHADOWLINE — the hand-in program: copy game/ and screenshots/ from this
// repository into the output directory and write dossier.json with
// buildDossier from vendor/makefun-game.ts, exactly as the kit's RULES say.
// Runs on Node 22 with no install and no network. It writes the same bytes
// every run: the dossier is canonical JSON over file contents only.
import { cpSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });
cpSync(join(repoRoot, 'screenshots'), join(outDir, 'screenshots'), { recursive: true });

const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
// The gate refuses a dossier over 1.5 MiB: fail loudly here, not there.
if (dossier.length > 1572864) {
  throw new Error(`dossier.json is ${dossier.length} bytes, over the 1.5 MiB gate cap`);
}
const gameFiles = readdirSync(join(outDir, 'game'), { recursive: true }).length;
const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => !f.startsWith('.')).length;
console.log(`SHADOWLINE: wrote ${outDir}/dossier.json (${dossier.length} bytes, ${gameFiles} game entries, ${shots} screenshots)`);
