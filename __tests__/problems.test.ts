import { genMath, gen4Digit, revealMs } from '../src/gate/problems';
import type { Difficulty } from '../src/storage';

const MAX_SUM: Record<Difficulty, number> = { easy: 18, normal: 35, hard: 50 };

describe('genMath', () => {
  (['easy', 'normal', 'hard'] as Difficulty[]).forEach((d) => {
    it(`(${d}) answer equals a+b and stays within sum cap, 300x`, () => {
      for (let i = 0; i < 300; i++) {
        const p = genMath(d);
        const m = p.text.match(/^(\d+) \+ (\d+)$/);
        expect(m).not.toBeNull();
        const a = parseInt(m![1], 10);
        const b = parseInt(m![2], 10);
        expect(a + b).toBe(p.answer);
        expect(p.answer).toBeLessThanOrEqual(MAX_SUM[d]);
        expect(a).toBeGreaterThanOrEqual(1);
        expect(b).toBeGreaterThanOrEqual(1);
      }
    });
  });
});

describe('gen4Digit', () => {
  it('always returns 4 digit chars (zero-padded)', () => {
    for (let i = 0; i < 200; i++) {
      const s = gen4Digit();
      expect(s).toMatch(/^\d{4}$/);
    }
  });
});

describe('revealMs', () => {
  it('maps difficulty to reveal duration', () => {
    expect(revealMs('easy')).toBe(3000);
    expect(revealMs('normal')).toBe(2500);
    expect(revealMs('hard')).toBe(2000);
  });
});
