// 사용자가 업로드한 파일(JSON/엑셀) → ScenarioPayload 로 변환.
//
// 입력 형식 3가지를 자동 감지:
//   (a) ScenarioPayload JSON  ({scenarioId, label, rows: [Assignment...]})
//                              — 이미 매핑된 풍부 도메인 (Assignment 배열).
//   (b) CrawlerRawRow[] JSON  ([{모선항차, 선석, 모선항차, ...}, ...])
//                              — BPTC raw 한글 헤더 배열. liveConverter 로 변환.
//   (c) 엑셀 (.xlsx)          — SheetJS 로 sheet → row 배열 → (b) 와 동일 경로.
//                              xlsx 패키지는 dynamic import — 별 chunk 로 분리되어
//                              parseXlsxInput 호출 시점에만 fetch 된다.
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

import { detectXlsxFormat, streamlitRowsToBptRaw, type XlsxFormat } from './streamlitXlsx';

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
 * SheetJS(`xlsx`) 는 dependency 로 포함되며 vite 가 별 chunk 로 lazy 분리한다 —
 * 이 함수가 처음 호출될 때만 ~700KB 청크가 fetch 된다 (main bundle 영향 X).
 *
 * 헤더 set 자동 감지 (detectXlsxFormat):
 *   - bpt-raw       (구분/입항일시/...)  → 그대로
 *   - streamlit-xlsx (ETB/접안위치(F)/...) → streamlitRowsToBptRaw 로 정규화
 *   - unknown       → throw (사용자에게 두 형식 가이드)
 */
export async function parseXlsxInput(
  buffer: ArrayBuffer,
  meta: { id: string; label: string; sourceFile: string },
): Promise<{ payload: ScenarioPayload; droppedCount: number; xlsxFormat: XlsxFormat }> {
  // 동적 import — vite 가 별 chunk 로 분리. parse 시점에 처음 다운로드.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let XLSX: any;
  try {
    XLSX = await import('xlsx');
  } catch (e) {
    throw new UploadParseError(
      '엑셀 파서 모듈 로드 실패. 페이지를 새로고침해보세요.',
      e,
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let workbook: any;
  try {
    // cellDates: false — date 형식 cell 도 raw Excel serial number 로 유지.
    // SheetJS 의 cellDates:true 가 1900 leap-bug 처리에서 약 -52초 drift 를 만들어
    // 분 round 로도 보정 불가. raw serial → excelSerialToDate (분 단위 round) 가
    // 정확. BPTC raw 의 입항일시 컬럼은 string cell 이라 cellDates 옵션과 무관.
    workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
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

  // 첫 행 = 헤더. 그 외 = data.
  // defval='' — 빈 셀도 빈 문자열 보존.
  // raw=true — date 셀(read 시 cellDates:true 로 Date 객체)을 그대로 유지해야
  //   아래 Date→KR 정규화 분기가 동작. raw=false 면 SSF 가 미리 포맷팅해서
  //   parseKrDate 패턴을 깨버림.
  const sheetRows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, {
    defval: '',
    raw: true,
  });

  // 헤더 감지 — mutually exclusive 마커 (입항일시/작업완료일시 vs ETB/접안위치(F)).
  const headers = sheetRows.length > 0 ? Object.keys(sheetRows[0] ?? {}) : [];
  const detection = detectXlsxFormat(headers);
  if (detection.format === 'unknown') {
    throw new UploadParseError(
      [
        `엑셀 헤더를 인식할 수 없습니다 — ${detection.reason}`,
        '',
        '지원 형식:',
        '  A) BPTC raw 한글 헤더 — 구분 / 입항일시 / 작업완료일시 / f / e / 모선항차',
        '  B) Streamlit 원본 — 구분 / ETB / ETD / 접안위치(F) / 접안위치(E) / 모선항차',
        '',
        detection.observedHeaders
          ? `발견된 컬럼: ${detection.observedHeaders.slice(0, 20).join(', ')}` +
            (detection.observedHeaders.length > 20 ? ` … (+${detection.observedHeaders.length - 20})` : '')
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
    );
  }

  // Streamlit 형식이면 컬럼 rename + Excel serial → KR 라벨 변환을 거쳐 BPTC raw 로 정규화.
  // bpt-raw 면 그대로 다음 단계로.
  const bptRawRows: Record<string, unknown>[] =
    detection.format === 'streamlit-xlsx' ? streamlitRowsToBptRaw(sheetRows) : sheetRows;

  // Date 객체 → "YYYY/MM/DD HH:mm" 정규화 (BPTC raw path 의 cellDates Date 객체용).
  // SheetJS 의 Date ↔ Excel serial 변환은 ms 단위 drift 가 있어 "HH:30" 이 "HH:29:59"
  // 로 들어오기도 함 — 분 단위로 round 후 KR 라벨 만들어 parseKrDate 가 정확히 매칭되게.
  const normalized = bptRawRows.map((row) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(row)) {
      if (v instanceof Date) {
        const rounded = new Date(Math.round(v.getTime() / 60_000) * 60_000);
        const y = rounded.getFullYear();
        const mo = String(rounded.getMonth() + 1).padStart(2, '0');
        const d = String(rounded.getDate()).padStart(2, '0');
        const h = String(rounded.getHours()).padStart(2, '0');
        const mi = String(rounded.getMinutes()).padStart(2, '0');
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
  return { payload, droppedCount, xlsxFormat: detection.format };
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
