// Move, poke and reveal timelines. Pure GSAP on a Pose object, no DOM or three.js, so the
// same source drives the site and scripts/bake-clips.ts (which bakes the Blender NLA clips).
import gsap from 'gsap';
import type { Move, Personality } from '../data/content';
import type { Expression } from './face';

export const PX = 1 / 216; // one Figma pixel in world units at the default framing
export const DEG = Math.PI / 180;
export const HOVER = 0.32;

/** Additive pose channels; idle and moves each produce one and they are summed. */
export interface Pose {
  x: number;
  y: number;
  z: number;
  rx: number;
  ry: number;
  rz: number;
  sq: number; // squash (+) / stretch (−), clamped to ±12%
  wide: number;
  armL: number; // raise outward, radians
  armR: number;
  antL: number; // tilt outward
  antR: number;
  antX: number; // whip back/forward
}
export const zero = (): Pose => ({ x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, sq: 0, wide: 0, armL: 0, armR: 0, antL: 0, antR: 0, antX: 0 });

export interface MoveCtx {
  pose: Pose;
  p: Personality | null;
  balloon?: boolean;
  face?: (e: Expression | null) => void;
  pulse?: () => void;
  blush?: () => void;
  blink?: (ms: number) => void;
}

export const MOVE_FACE: Record<Move, Expression> = { dance: 'happy', wave: 'happy', spin: 'dizzy', jump: 'surprised', nap: 'sleepy', surprise: 'surprised' };

function mods(p: Personality | null) {
  if (p === 'shy') return { amp: 0.7, speed: 0.8, extra: 0, hold: 0, ease: 'power2.out' };
  if (p === 'playful') return { amp: 1.3, speed: 1, extra: 1, hold: 0, ease: 'power2.out' };
  if (p === 'dramatic') return { amp: 1, speed: 1, extra: 0, hold: 0.6, ease: 'power2.out' };
  if (p === 'calm') return { amp: 1, speed: 0.6, extra: 0, hold: 0, ease: 'sine.inOut' };
  return { amp: 1, speed: 1, extra: 0, hold: 0, ease: 'power2.out' };
}

const noop = () => {};

export function moveTimeline(m: Move, c: MoveCtx): gsap.core.Timeline {
  const { amp, speed, extra, hold, ease } = mods(c.p);
  const a = c.pose;
  const face = c.face ?? noop;
  const pulse = c.pulse ?? noop;
  const sq = (v: number) => (c.p === 'calm' ? 0 : v);
  const reps = 1 + extra;
  const tl = gsap.timeline();
  switch (m) {
    case 'dance':
      face('happy');
      for (let i = 0; i < 4 * reps; i++) {
        const s = i % 2 ? 1 : -1;
        tl.to(a, { x: s * 12 * PX * amp, rz: -s * 4 * DEG * amp, armL: (s > 0 ? 25 : -5) * DEG * amp, armR: (s > 0 ? -5 : 25) * DEG * amp, y: 6 * PX * amp, duration: 0.25, ease }).to(a, {
          y: 0,
          duration: 0.25,
          ease: 'sine.in',
        });
      }
      break;
    case 'wave':
      face('happy');
      tl.to(a, { armR: 2.09 * Math.min(amp, 1.1), rz: -4 * DEG, duration: 0.3, ease: 'back.out(1.6)' });
      for (let i = 0; i < 3 * reps; i++) tl.to(a, { armR: `+=${20 * DEG * amp}`, duration: 0.16, yoyo: true, repeat: 1, ease: 'sine.inOut' });
      break;
    case 'spin':
      for (let i = 0; i < reps; i++) tl.to(a, { ry: `+=${Math.PI * 2}`, duration: 0.8, ease: 'power2.inOut' });
      tl.call(() => face('dizzy'))
        .to(a, { rz: 3 * DEG, duration: 0.15, yoyo: true, repeat: 3 })
        .set(a, { ry: 0 });
      break;
    case 'jump': {
      const h = 80 * PX * amp * (c.balloon ? 1.4 : 1);
      for (let i = 0; i < reps; i++) {
        tl.to(a, { sq: sq(0.1), duration: 0.12, ease: 'power2.out' })
          .to(a, { sq: sq(-0.08), y: h, duration: 0.32, ease: 'power2.out' })
          .to(a, { sq: 0, duration: 0.15 }, '<0.12')
          .to(a, { y: 0, duration: 0.3, ease: 'power2.in' })
          .call(pulse)
          .to(a, { sq: sq(0.1), duration: 0.07 })
          .to(a, { sq: 0, duration: 0.25, ease: 'elastic.out(1,0.5)' });
      }
      break;
    }
    case 'nap':
      face('sleepy');
      tl.to(a, { rx: 15 * DEG * Math.min(amp, 1), y: -8 * PX, armL: -0.1, armR: -0.1, antL: 0.3, antR: 0.3, duration: 0.8, ease: 'sine.inOut' }).to({}, { duration: 1.6 * reps });
      break;
    case 'surprise':
      face('surprised');
      tl.to(a, { antL: -0.25, antR: -0.25, armL: 45 * DEG * amp, armR: 45 * DEG * amp, z: -30 * PX, sq: sq(-0.06), duration: 0.18, ease: 'back.out(2)' }).to({}, { duration: 0.6 * reps });
      break;
  }
  // Dramatic ends every move on a held pose.
  if (hold) tl.to(a, { rz: 3 * DEG, armL: '+=0.4', duration: 0.2 }).to({}, { duration: hold });
  // settle back to rest inside the clip so baked clips end where idle starts
  tl.to(a, { x: 0, y: 0, z: 0, rx: 0, rz: 0, sq: 0, armL: 0, armR: 0, antL: 0, antR: 0, duration: 0.25, ease: 'sine.inOut' });
  tl.timeScale(speed);
  return tl;
}

export function pokeTimeline(c: MoveCtx): gsap.core.Timeline {
  const a = c.pose;
  const face = c.face ?? noop;
  const pulse = c.pulse ?? noop;
  const tl = gsap.timeline();
  switch (c.p) {
    case 'shy':
      face('wink'); // covers its face; one eye peeks out
      tl.to(a, { armL: -0.9, armR: -0.9, rx: 8 * DEG, duration: 0.25, ease: 'power2.out' }).to({}, { duration: 1.2 });
      break;
    case 'playful':
      face('playful');
      tl.to(a, { y: 60 * PX, sq: -0.08, duration: 0.3, ease: 'power2.out' })
        .to(a, { ry: Math.PI * 2, duration: 0.5, ease: 'none' }, '<')
        .to(a, { y: 0, sq: 0, duration: 0.25, ease: 'power2.in' })
        .to(a, { sq: 0.1, duration: 0.06 })
        .to(a, { sq: 0, duration: 0.25 })
        .set(a, { ry: 0 });
      break;
    case 'dramatic':
      face('surprised');
      tl.to(a, { rx: -70 * DEG, y: -20 * PX, duration: 0.5, ease: 'power2.in' })
        .call(() => face('dizzy'))
        .to({}, { duration: 0.4 })
        .to(a, { rx: 0, y: 0, duration: 0.35, ease: 'back.out(2)' })
        .call(() => face('happy'))
        .to(a, { rx: 25 * DEG, armR: 0.6, duration: 0.3 }) // bow, catches the rose
        .to(a, { rx: 0, armR: 0, duration: 0.3 }, '+=0.3');
      break;
    case 'calm':
      face('calm');
      tl.to(a, { z: -40 * PX, duration: 1.2, ease: 'sine.out' })
        .to(a, { armR: 1.6, duration: 0.6, ease: 'sine.inOut' }, '<0.3')
        .to(a, { armR: '+=0.3', duration: 0.5, yoyo: true, repeat: 1, ease: 'sine.inOut' })
        .call(pulse)
        .to(a, { z: 0, armR: 0, duration: 1, ease: 'sine.inOut' });
      break;
    default:
      face('surprised');
      tl.to(a, { sq: 0.1, antX: -0.5, duration: 0.08 })
        .to(a, { sq: -0.05, y: 20 * PX, duration: 0.2, ease: 'power2.out' })
        .to(a, { sq: 0, y: 0, duration: 0.2, ease: 'power2.in' })
        .to(a, { rz: 6 * DEG, duration: 0.09 })
        .to(a, { rz: -6 * DEG, duration: 0.18 })
        .to(a, { rz: 6 * DEG, duration: 0.18 })
        .to(a, { rz: -6 * DEG, duration: 0.18 })
        .to(a, { rz: 0, antX: 0, duration: 0.12 });
  }
  return tl;
}

export function revealTimeline(p: Personality, c: MoveCtx): gsap.core.Timeline {
  const a = c.pose;
  const face = c.face ?? noop;
  const pulse = c.pulse ?? noop;
  const tl = gsap.timeline();
  if (p === 'shy') {
    // rises from behind the blanket, peeks straight at you, panics, hides, turns away blushing
    tl.fromTo(a, { y: -0.9, ry: 0.62 }, { y: 0, duration: 1.1, ease: 'power2.out' })
      .call(() => face('default'))
      .to({}, { duration: 0.55 })
      .call(() => face('surprised'))
      .to(a, { y: -0.2, sq: 0.1, armL: -0.95, armR: -0.95, rx: 0.2, duration: 0.16, ease: 'power3.out' }) // EEP
      .call(() => {
        face('wink');
        c.blush?.();
      })
      .to(a, { ry: 0, x: -0.1, duration: 0.7, ease: 'sine.inOut' }, '+=0.5')
      .to(a, { y: 0, sq: 0, armL: 0, armR: 0, rx: 0, x: 0, duration: 0.9, ease: 'sine.inOut' }, '+=0.5')
      .call(() => face(null));
  } else if (p === 'playful') {
    // cannonballs in, squashes, double spin, ta-da, one more hop for good measure
    tl.fromTo(a, { y: 3.5 }, { y: 0, duration: 0.55, ease: 'power3.in' })
      .to(a, { sq: 0.12, duration: 0.08 })
      .call(pulse)
      .to(a, { sq: 0, duration: 0.3, ease: 'elastic.out(1,0.4)' })
      .to(a, { ry: Math.PI * 4, duration: 0.9, ease: 'power2.inOut' })
      .set(a, { ry: 0 })
      .to(a, { armL: 1.5, armR: 1.5, rz: 0.1, duration: 0.25, ease: 'back.out(2)' })
      .call(() => face('happy'))
      .to(a, { y: 0.4, sq: -0.06, duration: 0.25, ease: 'power2.out' }, '+=0.3')
      .to(a, { y: 0, sq: 0, duration: 0.25, ease: 'power2.in' })
      .call(pulse)
      .to(a, { armL: 0, armR: 0, rz: 0, duration: 0.4 }, '+=0.4')
      .call(() => face(null));
  } else if (p === 'dramatic') {
    // back to the audience… a slow turn… THE pose, held
    tl.fromTo(a, { ry: Math.PI }, { ry: 0, duration: 1.8, ease: 'power2.inOut' })
      .call(() => face('surprised'))
      .to(a, { armL: 2.6, armR: 2.6, rx: -0.2, sq: -0.05, duration: 0.35, ease: 'back.out(1.6)' })
      .call(() => face(null))
      .to(a, { armL: 0, armR: 0, rx: 0, sq: 0, duration: 0.6, ease: 'power2.inOut' }, '+=1.2');
  } else {
    // drifts up slower than seems possible, one very long blink
    tl.fromTo(a, { y: -0.5 }, { y: 0, duration: 2.6, ease: 'sine.inOut' })
      .call(() => c.blink?.(600))
      .call(pulse, [], '-=0.6');
  }
  return tl;
}

export type ClipKind = Move | 'poke' | 'reveal';

/** Builds any clip by name; used by the baker. */
export function clipTimeline(kind: ClipKind, c: MoveCtx & { p: Personality }): gsap.core.Timeline {
  if (kind === 'poke') return pokeTimeline(c);
  if (kind === 'reveal') return revealTimeline(c.p, c);
  return moveTimeline(kind, c);
}
