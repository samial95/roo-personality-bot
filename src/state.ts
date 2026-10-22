import {
  ACCENT_COLORS,
  ACCESSORIES,
  BODY_COLORS,
  FINISHES,
  GLOW_COLORS,
  PERSONALITIES,
  SLOTS,
  type Option,
  type Personality,
  type Slot,
} from './data/content';

export type Screen = 'boot' | 'intro' | 'q1' | 'q2' | 'q3' | 'installing' | 'reveal' | 'customize' | 'share';
export type Tab = 'color' | 'moves' | 'accessories';
export type Mix = Partial<Record<Personality, number>>;

export interface Look {
  body: string;
  accent: string;
  glow: string;
  finish: string;
  acc: Record<Slot, string>;
}

export const DEFAULT_LOOK: Look = {
  body: 'white',
  accent: 'metal',
  glow: 'auto',
  finish: 'matte',
  acc: { head: 'none', antennas: 'caps', face: 'none', hand: 'none', ground: 'none' },
};

export const cloneLook = (l: Look): Look => ({ ...l, acc: { ...l.acc } });

export function isCustomized(l: Look): boolean {
  return encodeLook(l).toString() !== '';
}

/** +1 per answer; highest wins; ties go to the Q3 answer. */
export function score(answers: Personality[]): { winner: Personality; mix: Mix } {
  const counts: Mix = {};
  for (const a of answers) counts[a] = (counts[a] ?? 0) + 1;
  const max = Math.max(...Object.values(counts).map((n) => n ?? 0));
  const tied = PERSONALITIES.filter((p) => counts[p] === max);
  const last = answers[answers.length - 1];
  const winner = tied.length > 1 && tied.includes(last) ? last : tied[0];
  return { winner, mix: toPercent(counts, winner) };
}

/** Whole percentages that always sum to 100; rounding remainder goes to the winner. */
function toPercent(counts: Mix, winner: Personality): Mix {
  const total = Object.values(counts).reduce((s, n) => s + (n ?? 0), 0);
  const mix: Mix = {};
  let sum = 0;
  for (const p of PERSONALITIES) {
    if (!counts[p]) continue;
    mix[p] = Math.round(((counts[p] ?? 0) / total) * 100);
    sum += mix[p]!;
  }
  mix[winner] = (mix[winner] ?? 0) + (100 - sum);
  return mix;
}

/** Mix entries sorted winner-first, then by share. */
export function mixEntries(mix: Mix, winner: Personality): [Personality, number][] {
  return (Object.entries(mix) as [Personality, number][])
    .filter(([, n]) => n > 0)
    .sort((a, b) => (a[0] === winner ? -1 : b[0] === winner ? 1 : b[1] - a[1]));
}

// ---- URL encoding: ?p=playful&m=p67d33&b=sky&a=gold&g=auto&f=matte&head=party&hand=balloon

const MIX_KEY: Record<Personality, string> = { shy: 's', playful: 'p', dramatic: 'd', calm: 'c' };
const SLOT_KEY: Record<Slot, string> = { head: 'head', antennas: 'ant', face: 'face', hand: 'hand', ground: 'ground' };

function encodeLook(l: Look): URLSearchParams {
  const q = new URLSearchParams();
  if (l.body !== DEFAULT_LOOK.body) q.set('b', l.body);
  if (l.accent !== DEFAULT_LOOK.accent) q.set('a', l.accent);
  if (l.glow !== DEFAULT_LOOK.glow) q.set('g', l.glow);
  if (l.finish !== DEFAULT_LOOK.finish) q.set('f', l.finish);
  for (const s of SLOTS) if (l.acc[s] !== DEFAULT_LOOK.acc[s]) q.set(SLOT_KEY[s], l.acc[s]);
  return q;
}

export function encodeShare(p: Personality, mix: Mix, look: Look): string {
  const q = new URLSearchParams({ p });
  const m = mixEntries(mix, p)
    .map(([k, n]) => MIX_KEY[k] + n)
    .join('');
  if (m) q.set('m', m);
  encodeLook(look).forEach((v, k) => q.set(k, v));
  return q.toString();
}

export function decodeShare(search: string): { p: Personality; mix: Mix; look: Look } | null {
  const q = new URLSearchParams(search);
  const p = q.get('p') as Personality | null;
  if (!p || !PERSONALITIES.includes(p)) return null;
  const mix: Mix = {};
  for (const [, k, n] of (q.get('m') ?? '').matchAll(/([spdc])(\d{1,3})/g)) {
    const key = PERSONALITIES.find((x) => MIX_KEY[x] === k)!;
    mix[key] = Math.min(100, Number(n));
  }
  if (!Object.keys(mix).length) mix[p] = 100;
  const look = cloneLook(DEFAULT_LOOK);
  // Unknown ids fall back to defaults so a bad link still renders a valid Roo.
  const pick = (key: string, opts: Option[], fallback: string) => {
    const v = q.get(key);
    return v && opts.some((o) => o.id === v) ? v : fallback;
  };
  look.body = pick('b', BODY_COLORS, look.body);
  look.accent = pick('a', ACCENT_COLORS, look.accent);
  look.glow = pick('g', GLOW_COLORS, look.glow);
  look.finish = pick('f', FINISHES, look.finish);
  for (const s of SLOTS) look.acc[s] = pick(SLOT_KEY[s], ACCESSORIES[s], look.acc[s]);
  return { p, mix, look };
}
