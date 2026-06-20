// 다크/라이트 팔레트 — 동일한 키 구조. useColors()가 현재 모드에 맞는 걸 반환.
export type Palette = {
  bg: string;
  card: string;
  cardAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textFaint: string;
  blue: string;
  red: string;
  green: string;
  amber: string;
  amberBg: string;
  redBg: string;
  track: string;
};

export const darkColors: Palette = {
  bg: '#0f1115',
  card: '#1a1d24',
  cardAlt: '#222633',
  border: '#2b303b',
  text: '#f3f5f8',
  textMuted: '#9aa0ab',
  textFaint: '#6b7280',
  blue: '#3a7afe',
  red: '#e0352b',
  green: '#2ecc40',
  amber: '#f0a830',
  amberBg: '#3a2e16',
  redBg: '#3a1a1a',
  track: '#2b303b',
};

export const lightColors: Palette = {
  bg: '#f4f5f7',
  card: '#ffffff',
  cardAlt: '#eceef1',
  border: '#dfe2e7',
  text: '#15181f',
  textMuted: '#5e646e',
  textFaint: '#9aa0ab',
  blue: '#2f6bff',
  red: '#d12c2c',
  green: '#1faa3a',
  amber: '#b8770a',
  amberBg: '#fdeccf',
  redBg: '#fde0e0',
  track: '#e2e5ea',
};

// 기본(다크) — 항상 다크인 화면(게이트/가짜통화)이 그대로 쓰던 import 호환용
export const colors = darkColors;

export const radius = { sm: 10, md: 14, lg: 18 };
