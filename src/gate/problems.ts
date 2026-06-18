import type { Difficulty } from '../storage';

const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

export type MathProblem = { text: string; answer: number };

// 난이도별 산수 문제 — 취중에도 풀 수 있게 덧셈만, 합 50 이하.
// (곱셈/큰 수는 술 마시면 오히려 짜증나서 앱을 지우게 됨)
export function genMath(difficulty: Difficulty): MathProblem {
  // 난이도 = 합의 상한
  const maxSum = difficulty === 'easy' ? 18 : difficulty === 'hard' ? 50 : 35;
  const minOperand = difficulty === 'hard' ? 5 : 1;
  // a 먼저 뽑고, a+b가 상한을 넘지 않게 b 범위 제한
  const a = randInt(minOperand, Math.max(minOperand, maxSum - minOperand));
  const b = randInt(minOperand, Math.max(minOperand, maxSum - a));
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
