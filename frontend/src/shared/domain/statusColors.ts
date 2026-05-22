// BPTC 선석배정 그래픽 박스 색깔 → PlanStatus 색 토큰.
// Streamlit 원본 (status-allocation-berths/streamlit_drag_timeline/frontend/Timeline.tsx) 의
// STATUS_COLORS 와 1:1 매칭. 운영자 눈에 익은 색을 보존.
//
// 한글 라벨/사이트 색 매핑:
//   loading_planned       "적하 프래닝까지 완료"  분홍
//   discharge_planned     "양하 프래닝까지 완료"  청록
//   crane_assigned        "크래인 배정 완료"      베이지(노랑)
//   crane_unassigned      "크래인 미배정"          회색
//   null (정적 시나리오)  —                       기본색 (voyage hash)

import type { PlanStatus } from './types';

export type { PlanStatus };

export interface PlanStatusVisual {
  /** 한글 라벨 — 사이트 노출 문구 그대로. */
  label: string;
  /** 다크/라이트 공통 fill (반투명 — 막대 색). */
  fill: string;
  /** 막대 테두리 색 (더 진한 톤). */
  stroke: string;
  /** Legend 배지의 단색 (불투명 — chip 안 색칠). */
  swatch: string;
}

export const PLAN_STATUS_VISUAL: Record<PlanStatus, PlanStatusVisual> = {
  loading_planned: {
    label: '적하 프래닝 완료',
    fill: 'rgba(236, 130, 176, 0.82)',
    stroke: 'rgba(192, 88, 138, 1)',
    swatch: '#ec82b0',
  },
  discharge_planned: {
    label: '양하 프래닝 완료',
    fill: 'rgba(115, 158, 245, 0.82)',
    stroke: 'rgba(67, 110, 200, 1)',
    swatch: '#739ef5',
  },
  crane_assigned: {
    label: '크래인 배정 완료',
    fill: 'rgba(248, 202, 109, 0.86)',
    stroke: 'rgba(196, 144, 51, 1)',
    swatch: '#f8ca6d',
  },
  crane_unassigned: {
    label: '크래인 미배정',
    fill: 'rgba(180, 180, 186, 0.80)',
    stroke: 'rgba(120, 120, 128, 1)',
    swatch: '#b4b4ba',
  },
};

/** planStatus 미지정(BP 그래픽 미게재 / 정적 시나리오)에 쓰는 폴백 색. */
export const PLAN_STATUS_FALLBACK: PlanStatusVisual = {
  label: '미지정',
  fill: 'rgba(148, 163, 184, 0.42)',
  stroke: 'rgba(100, 116, 139, 0.9)',
  swatch: '#94a3b8',
};

/** PlanStatus 순서 — Legend / 분포 통계 노출 순서. */
export const PLAN_STATUS_ORDER: PlanStatus[] = [
  'loading_planned',
  'discharge_planned',
  'crane_assigned',
  'crane_unassigned',
];

export function planStatusVisual(s: PlanStatus | null | undefined): PlanStatusVisual {
  if (!s) return PLAN_STATUS_FALLBACK;
  return PLAN_STATUS_VISUAL[s];
}
