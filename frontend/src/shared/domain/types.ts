// 풍부 도메인의 Assignment.
// status-allocation-berths/schema.py 의 정규화 결과(STD_ORDER)와 의미적으로 1:1 매칭.
//
// backend 의 BPTRecord (1D) 와는 별개의 모델이며, 솔버 제출 시점에서 어댑터가 풍부 → 1D 로
// 축소한다 (Phase 7 에서 추가 예정).

import { z } from 'zod';

// Terminal 의 type 은 constants.ts 가 SoT — 여기서는 zod runtime enum 만 정의.
export const TerminalEnum = z.enum(['SND', 'GAM']);

/**
 * BPTC 선석배정 그래픽(G) 페이지의 박스 색깔로 표시되는 작업 진행 상태.
 * 원본 사이트 VslMsg() 의 plan_cd 8번째 인자 매핑:
 *   L → loading_planned       (적하 프래닝까지 완료)  분홍
 *   D → discharge_planned     (양하 프래닝까지 완료)  청록
 *   C → crane_assigned        (크래인 배정 완료)      베이지
 *   그 외 → crane_unassigned  (크래인 미배정)          회색
 *   null → BP 그래픽 미게재
 */
export const PlanStatusEnum = z.enum([
  'loading_planned',
  'discharge_planned',
  'crane_assigned',
  'crane_unassigned',
]);
export type PlanStatus = z.infer<typeof PlanStatusEnum>;

/**
 * 한 척의 선박 배정 한 행.
 * - 시간(start/end/eta): ISO datetime 문자열 (xlsx Timestamp 의 직렬화).
 * - 위치(f/e): 선체 앞단(F)/뒷단(E) 의 m 좌표.
 * - berth: 1~9 정수, terminal 과 일관 (SND:1~5, GAM:6~9).
 *
 * etbInt/etdInt/etaInt 는 솔버용 시간 오프셋(시간 단위) — 어댑터가 BPTRecord 로 보낼 때 사용.
 */
export const AssignmentSchema = z.object({
  rowId: z.string(),
  voyage: z.string(),
  vessel: z.string().nullable().default(''),
  company: z.string().nullable().default(''),
  sectionRaw: z.string().nullable().default(''),
  terminal: z.union([TerminalEnum, z.literal('')]),
  berth: z.number().int(),
  route: z.string().nullable().default(''),

  start: z.string().nullable(),
  end: z.string().nullable(),
  eta: z.string().nullable(),

  etbInt: z.number().nullable().default(null),
  etdInt: z.number().nullable().default(null),
  etaInt: z.number().nullable().default(null),

  f: z.number().nullable(),
  e: z.number().nullable(),
  length: z.number().nullable(),

  yanghaVan: z.number().nullable().default(0),
  seonjeokVan: z.number().nullable().default(0),
  shiftingVan: z.number().nullable().default(0),
  workHours: z.number().nullable().default(null),

  /** BPTC 선석배정 그래픽 색깔 → 작업 진행 단계. null = 미게재 / 정적 시나리오. */
  planStatus: PlanStatusEnum.nullable().default(null),
});
export type Assignment = z.infer<typeof AssignmentSchema>;

export const ScenarioPayloadSchema = z.object({
  scenarioId: z.string(),
  label: z.string(),
  sourceFile: z.string(),
  rowCount: z.number(),
  rows: z.array(AssignmentSchema),
});
export type ScenarioPayload = z.infer<typeof ScenarioPayloadSchema>;

export const ScenarioManifestSchema = z.object({
  scenarios: z.array(
    z.object({ id: z.string(), label: z.string(), file: z.string() }),
  ),
});
export type ScenarioManifest = z.infer<typeof ScenarioManifestSchema>;
