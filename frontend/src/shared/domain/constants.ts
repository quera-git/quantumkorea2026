// status-allocation-berths/schema.py 의 도메인 상수를 TS 로 1:1 포팅.
// 값을 자의적으로 바꾸지 말 것 — 원본이 SoT. 변경 필요 시 schema.py 함께 수정 후 둘 다 갱신.

export type Terminal = 'SND' | 'GAM';

/** 신선대 선석 번호 (1~5). */
export const SND_BERTHS = [1, 2, 3, 4, 5] as const;

/** 감만 선석 번호 (6~9). */
export const GAM_BERTHS = [6, 7, 8, 9] as const;

/** 세로(선석 내 m) 스냅 단위. */
export const Y_GRID_M = 30;

/** 동시간대 선박 간 최소 이격(m). */
export const MIN_CLEARANCE_M = 30;

/**
 * 가로(시간) 스냅 단위(분).
 * 주의: schema.py 에는 `TIME_GRID_MIN=10` 상수가 있지만 실제 snap_time_5min 함수가
 * `round(minutes/5)*5` 로 5분에 스냅한다 — 함수 동작이 권위 있는 값이라 5분을 채택.
 */
export const TIME_GRID_MIN = 5;

interface TerminalLayout {
  /** 터미널 세로 길이(m). */
  yMax: number;
  /** 선석 한 칸의 세로 폭(m). */
  step: number;
  /**
   * 선석 번호. 시각화 상단→하단 순서로 정렬되어 있음.
   * SND: 1,2,3,4,5 (위→아래)
   * GAM: 9,8,7,6 (위→아래) — origin.py 라벨 순서와 동일.
   */
  berths: readonly number[];
}

export const TERMINAL_LAYOUT: Record<Terminal, TerminalLayout> = {
  SND: { yMax: 1500, step: 300, berths: [1, 2, 3, 4, 5] },
  GAM: { yMax: 1400, step: 350, berths: [9, 8, 7, 6] },
};

/** schema.py 의 KOR_MAP 매핑. xlsx 한글 헤더 → 표준 영문 키. */
export const KOR_TO_STD_FIELD: Readonly<Record<string, string>> = {
  '입항 예정일시': 'start',
  입항예정일시: 'start',
  ETB: 'start',
  출항일시: 'end',
  '출항 일시': 'end',
  ETD: 'end',
  모선항차: 'voyage',
  선박명: 'vessel',
  구분: 'sectionRaw',
  선석: 'berth',
  bp: 'bp',
  f: 'f',
  e: 'e',
  '접안위치(F)': 'f',
  '접안위치(E)': 'e',
  접안: 'berthing',
  검역: 'quarantine',
  도선: 'pilot',
};

/** 시나리오 라벨. status-allocation-berths/ui/sidebar.py 의 SCENARIO_LABELS. */
export const SCENARIO_LABELS = {
  1: '0313 00시 ver',
  2: '0313 14시 with weekly ver',
  3: '0316 08시 with 4days plan ver',
} as const;
