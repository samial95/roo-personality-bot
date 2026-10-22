// Synthesized beeps only — no audio files. Off until the user turns it on.
let ctx: AudioContext | null = null;
export let soundOn = false;

export function setSound(on: boolean) {
  soundOn = on;
  if (on && !ctx) ctx = new AudioContext();
  if (on) void ctx?.resume();
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', delay = 0, gain = 0.06) {
  if (!soundOn || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export const sfx = {
  click: () => tone(880, 0.06, 'triangle'),
  hover: () => tone(1320, 0.04, 'sine', 0, 0.025),
  select: () => (tone(660, 0.08, 'triangle'), tone(990, 0.1, 'triangle', 0.06)),
  poke: () => (tone(520, 0.08, 'square', 0, 0.04), tone(780, 0.12, 'square', 0.07, 0.04)),
  tick: () => tone(1200, 0.03, 'square', 0, 0.02),
  reveal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.25, 'triangle', i * 0.08)),
  move: () => tone(740, 0.1, 'sawtooth', 0, 0.03),
};
