// 사용자가 업로드한 파일(JSON/엑셀) → ScenarioPayload 로 변환.
//
// 입력 형식 3가지를 자동 감지:
//   (a) ScenarioPayload JSON  ({scenarioId, label, rows: [Assignment...]})
//                              — 이미 매핑된 풍부 도메인. src/data/*.json 와 동일.
//   (b) CrawlerRawRow[] JSON  ([{모선항차, 선석, 모선항차, ...}, ...])
//                              — BPTC raw 한글 헤더 배열. liveConverter 로 변환.
//   (c) 엑셀 (.xlsx)          — SheetJS 로 sheet → row 배열 → (b) 와 동일 경로.
//                              현재 xlsx 패키지 미설치 → loadXlsxParser() throw.
//                              사용자가 `npm install xlsx` 후 활성화.
//
// 검증 실패는 즉시 throw (caller 가 toast 로 표시). 도메인 검증
// (validateAssignments) 는 caller 가 별도로 — 여기선 "구조 검증" 까지만.

import { z } from 'zod';

import { convertCrawledRows } from '@/features/crawler/liveConverter';
import { CrawlerRawRowSchema, type CrawlerRawRow } from '@/shared/api/crawler.api';
import {
  ScenarioPayloadSchema,
  type Assignment,
  type ScenarioPayload,
} from '@/shared/domain/types';

export type DetectedFormat = 'scenario-payload' | 'raw-rows';

/** 업로드 가능한 최대 파일 크기 (10MB). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

/** localStorage 한 슬롯에 들어갈 안전 한도 (시나리오 1개당). */
export const MAX_SCENARIO_BYTES = 1 * 1024 * 1024; // 1MB

export class UploadParseError extends Error {
  readonly cause?: unknown;
  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = 'UploadParseError';
    this.cause = cause;
  }
}

/**
 * 최상위 JSON value 가 어느 형식인지 판단.
 *  - 객체 + `rows` 배열 + `scenarioId` 또는 `label` → ScenarioPayload
 *  - 배열 → CrawlerRawRow[]
 *  - 그 외 → throw
 */
export function detectFormat(value: unknown): DetectedFormat {
  if (Array.isArray(value)) return 'raw-rows';
  if (
    value !== null &&
    typeof value === 'object' &&
    Array.isArray((value as { rows?: unknown }).rows)
  ) {
    return 'scenario-payload';
  }
  throw new UploadParseError(
    'JSON 형식을 인식할 수 없습니다. 최상위가 ScenarioPayload 객체이거나 한글 컬럼 행 배열이어야 합니다.',
  );
}

/** ScenarioPayload zod 파싱. 실패 시 첫 issue 메시지로 throw. */
function parseScenarioPayload(value: unknown): ScenarioPayload {
  const result = ScenarioPayloadSchema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new UploadParseError(
      `ScenarioPayload 검증 실패: ${issue?.path.join('.')} — ${issue?.message ?? 'unknown'}`,
      result.error,
    );
  }
  return result.data;
}

const RawRowArraySchema = z.array(CrawlerRawRowSchema);

/** CrawlerRawRow[] → ScenarioPayload (liveConverter 의 convertCrawledRows 재사용). */
export function rawRowsToScenarioPayload(
  rows: CrawlerRawRow[],
  meta: { id: string; label: string; sourceFile: string },
): { payload: ScenarioPayload; droppedCount: number } {
  const { assignments, dropped } = convertCrawledRows(rows);
  const payload: ScenarioPayload = {
    scenarioId: meta.id,
    label: meta.label,
    sourceFile: meta.sourceFile,
    rowCount: assignments.length,
    rows: assignments,
  };
  return { payload, droppedCount: dropped };
}

/**
 * JSON 텍스트(혹은 객체) → ScenarioPayload.
 * @param meta scenarioId/label/sourceFile — raw-rows 분기에서 사용 (payload 가 직접 안 가짐).
 */
export function parseJsonInput(
  text: string,
  meta: { id: string; label: string; sourceFile: string },
): { payload: ScenarioPayload; droppedCount: number; format: DetectedFormat } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new UploadParseError(`JSON 파싱 실패: ${(e as Error).message}`, e);
  }
  const format = detectFormat(raw);

  if (format === 'scenario-payload') {
    const payload = parseScenarioPayload(raw);
    // scenarioId/label 은 사용자 입력으로 override (충돌 방지).
    const merged: ScenarioPayload = {
      ...payload,
      scenarioId: meta.id,
      label: meta.label,
      sourceFile: meta.sourceFile,
      rowCount: payload.rows.length,
    };
    return { payload: merged, droppedCount: 0, format };
  }

  // raw-rows
  const rowsResult = RawRowArraySchema.safeParse(raw);
  if (!rowsResult.success) {
    const issue = rowsResult.error.issues[0];
    throw new UploadParseError(
      `CrawlerRawRow 배열 검증 실패: ${issue?.path.join('.')} — ${issue?.message ?? 'unknown'}`,
      rowsResult.error,
    );
  }
  const { payload, droppedCount } = rawRowsToScenarioPayload(rowsResult.data, meta);
  if (payload.rows.length === 0) {
    throw new UploadParseError(
      `변환 결과 0행 — 모든 행이 필수 컬럼(모선항차) 누락. 컬럼 헤더를 확인하세요.`,
    );
  }
  return { payload, droppedCount, format };
}

/**
 * 엑셀(.xlsx) → CrawlerRawRow[] → ScenarioPayload.
 *
 * SheetJS(`xlsx`) 는 supply-chain 정책으로 미설치 상태. `npm install xlsx` 후
 * 아래 동적 import 가 동작한다. 그 전엔 호출 시 즉시 throw — UploadButton 이
 * 사용자에게 안내 토스트를 보여준다.
 */
export async function parseXlsxInput(
  buffer: ArrayBuffer,
  meta: { id: string; label: string; sourceFile: string },
): Promise<{ payload: ScenarioPayload; droppedCount: number }> {
  // 변수 이름으로 import → vite/rollup 의 static analysis 우회.
  // xlsx 패키지가 없어도 build/test 가 통과한다. install 후 런타임에 동적 import.
  // @vite-ignore 주석도 함께 (이중 안전장치).
  const modName = 'xlsx';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let XLSX: any;
  try {
    XLSX = await import(/* @vite-ignore */ modName);
  } catch (e) {
    throw new UploadParseError(
      '엑셀 업로드를 사용하려면 `xlsx` 패키지 설치가 필요합니다. ' +
        '터미널에서 `cd frontend && npm install xlsx` 실행 후 다시 시도하세요.',
      e,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workbook: any;
  try {
    workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  } catch (e) {
    throw new UploadParseError(`엑셀 파싱 실패: ${(e as Error).message}`, e);
  }

  const firstSheetName: string | undefined = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new UploadParseError('엑셀에 시트가 없습니다.');
  }
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) {
    throw new UploadParseError(`시트 "${firstSheetName}" 를 읽을 수 없습니다.`);
  }

  // 첫 행 = 헤더. 그 외 = data. defval='' 로 빈 셀도 빈 문자열 보존.
  const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: false,
  });

  // Date 객체 → ISO string (sheet_to_json 이 cellDates 면 Date 반환).
  const normalized = raw.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        // "YYYY/MM/DD HH:mm" — liveConverter 의 parseKrDate 가 이 패턴 인식.
        const y = v.getFullYear();
        const mo = String(v.getMonth() + 1).padStart(2, '0');
        const d = String(v.getDate()).padStart(2, '0');
        const h = String(v.getHours()).padStart(2, '0');
        const mi = String(v.getMinutes()).padStart(2, '0');
        out[k] = `${y}/${mo}/${d} ${h}:${mi}`;
      } else {
        out[k] = v;
      }
    }
    return out;
  });

  // CrawlerRawRow 가 모두 optional + passthrough 라 zod 검증은 거의 통과 — 그래도 한 번.
  const result = RawRowArraySchema.safeParse(normalized);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new UploadParseError(
      `엑셀 행 검증 실패: ${issue?.path.join('.')} — ${issue?.message ?? 'unknown'}`,
      result.error,
    );
  }
  const { payload, droppedCount } = rawRowsToScenarioPayload(result.data, meta);
  if (payload.rows.length === 0) {
    throw new UploadParseError(
      '엑셀 변환 결과 0행 — `모선항차` 컬럼이 없거나 비어 있습니다. 헤더를 확인하세요.',
    );
  }
  return { payload, droppedCount };
}

/** 파일명에서 확장자 제거 → 기본 시나리오 이름. */
export function fileNameToScenarioLabel(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '').trim() || 'untitled';
}

/** 시나리오 id 생성 — kebab-case 형식 + timestamp 로 unique. */
export function generateScenarioId(label: string): string {
  const stamp = Date.now().toString(36);
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug ? `upload-${slug}-${stamp}` : `upload-${stamp}`;
}

/** 파싱된 ScenarioPayload 의 통계 (미리보기용). */
export function summarizePayload(payload: Assignment[] | ScenarioPayload): {
  total: number;
  snd: number;
  gam: number;
  unknown: number;
} {
  const rows = Array.isArray(payload) ? payload : payload.rows;
  let snd = 0;
  let gam = 0;
  let unknown = 0;
  for (const r of rows) {
    if (r.terminal === 'SND') snd += 1;
    else if (r.terminal === 'GAM') gam += 1;
    else unknown += 1;
  }
  return { total: rows.length, snd, gam, unknown };
}
