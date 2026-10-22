import { test, expect } from '@playwright/test';
import { score, encodeShare, decodeShare, DEFAULT_LOOK, cloneLook } from '../src/state';

test.describe('scoring', () => {
  test('majority wins', () => {
    expect(score(['playful', 'playful', 'dramatic'])).toEqual({ winner: 'playful', mix: { playful: 67, dramatic: 33 } });
  });
  test('three-way tie goes to the Q3 answer and sums to 100', () => {
    const r = score(['shy', 'playful', 'dramatic']);
    expect(r.winner).toBe('dramatic');
    expect(Object.values(r.mix).reduce((a, b) => a! + b!, 0)).toBe(100);
    expect(r.mix.dramatic).toBe(34);
  });
  test('unanimous', () => {
    expect(score(['calm', 'calm', 'calm']).mix).toEqual({ calm: 100 });
  });
});

test.describe('share URL', () => {
  test('round-trips the full look', () => {
    const look = cloneLook(DEFAULT_LOOK);
    Object.assign(look, { body: 'sky', accent: 'gold', glow: 'pink', finish: 'glossy' });
    look.acc.head = 'party';
    look.acc.hand = 'balloon';
    look.acc.antennas = 'stars';
    const q = encodeShare('playful', { playful: 67, dramatic: 33 }, look);
    expect(q).toContain('p=playful');
    expect(q).toContain('head=party');
    expect(decodeShare('?' + q)).toEqual({ p: 'playful', mix: { playful: 67, dramatic: 33 }, look });
  });
  test('rejects bad ids', () => {
    expect(decodeShare('?p=evil')).toBeNull();
    expect(decodeShare('?p=calm&b=<script>&head=nope')?.look).toEqual(DEFAULT_LOOK);
  });
});
