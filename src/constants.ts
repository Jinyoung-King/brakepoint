import type { DrinkType } from './storage';

// 앱 전역에서 쓰는 고정 목록/라벨. 여러 화면에 중복 정의되던 걸 한곳으로.
export const DRINK_TYPES: DrinkType[] = ['소주', '맥주', '와인', '양주', '청하'];

// 요일 약칭 (0=일 ~ 6=토)
export const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
