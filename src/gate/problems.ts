import type { Difficulty } from '../storage';

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export type MathProblem = { text: string; answer: number };

// 난이도별 산수 문제
export function genMath(difficulty: Difficulty): MathProblem {
  if (difficulty === 'easy') {
    const a = randInt(1, 9);
    const b = randInt(1, 9);
    return { text: `${a} + ${b}`, answer: a + b };
  }
  if (difficulty === 'hard') {
    const a = randInt(3, 19);
    const b = randInt(3, 19);
    return { text: `${a} × ${b}`, answer: a * b };
  }
  // normal: 두 자리 덧셈
  const a = randInt(11, 89);
  const b = randInt(11, 89);
  return { text: `${a} + ${b}`, answer: a + b };
}

// 기억용 4자리 숫자 (앞자리 0 허용)
export function gen4Digit(): string {
  return String(randInt(0, 9999)).padStart(4, '0');
}

// 숫자 노출 시간(ms)
export function revealMs(difficulty: Difficulty): number {
  return difficulty === 'easy' ? 3000 : difficulty === 'hard' ? 2000 : 2500;
}
