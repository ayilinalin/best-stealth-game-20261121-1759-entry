// SHADOWLINE — procedural sound: no audio files, everything is synthesised
// with WebAudio on first input (browsers block audio before a gesture).
// Footsteps tick, a pickup blips, an alarm stings, a win arpeggiates.

let ctx = null;
let master = null;

/** Create the audio graph on the first user gesture; silent until then. */
export function ensureAudio() {
  if (ctx !== null) return;
  try {
    const AudioContext = window.AudioContext ?? window.webkitAudioContext;
    if (AudioContext === undefined) return;
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

/** A short oscillator blip: frequency slides from `from` to `to`. */
function blip(from, to, duration, type = 'sine', when = 0) {
  if (ctx === null || master === null) return;
  try {
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + duration);
    gain.gain.setValueAtTime(0.5, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  } catch {
    // Sound is garnish: never let it break the game.
  }
}

/** A footstep: a low thud, quieter while sneaking. */
export function stepSound(sneak) {
  if (sneak) blip(140, 90, 0.05, 'triangle');
  else blip(190, 110, 0.06, 'triangle');
}

/** The chime of a collected idol. */
export function lootSound() {
  blip(880, 1320, 0.12, 'sine');
  blip(1320, 1760, 0.1, 'sine', 0.07);
}

/** The alarm sting when the meter fills. */
export function alarmSound() {
  blip(520, 780, 0.18, 'sawtooth');
  blip(780, 520, 0.18, 'sawtooth', 0.16);
}

/** The win arpeggio when a floor is cleared. */
export function winSound() {
  [523, 659, 784, 1047].forEach((freq, i) => blip(freq, freq, 0.14, 'sine', i * 0.09));
}
