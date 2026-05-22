// Streamlit 원본 (status-allocation-berths) xlsx 형식 → BPTC raw 한글 헤더 형식 어댑터.
//
// Streamlit 원본 헤더 set (예시):
//   모선항차 / 구분 / 선석 / 선박명 / 선사
//   ETB / ETD / ETA (Excel serial number — 1900 epoch)
//   접안위치(F) / 접안위치(E)
//   양하(Van) / 선적(Van) / Shifting(Van)
//   항로 / Length / 작업시간(ETD-ETB) / ETB_int / ETD_int / ETA_int
//   (양하+선적)/20 / 안벽크레인 1 / 안벽크레인 2 / Unnamed: 22~
//
// BPTC raw 와 mutually exclusive — 두 형식이 같은 컬럼명을 쓰지 않음.
// 자동 감지 (detectXlsxFormat) 후 일치하는 path 로 변환.

import type { CrawlerRawRow } from '@/shared/api/crawler.api';

export type XlsxFormat = 'bpt-raw' | 'streamlit-xlsx' | 'unknown';

export interface FormatDetection {
  format: XlsxFormat;
  /** 판정 근거 — 어느 마커가 발견됐는지 (debug/UI 표시용). */
  reason: string;
  /** unknown 일 때 사용자에게 보여줄 발견된 컬럼 list. */
  observedHeaders?: string[];
}

/** BPTC raw 형식임을 결정짓는 마커 — 두 한글 풀네임 컬럼 중 하나라도 있으면. */
const BPT_RAW_MARKERS = ['입항일시', '작업완료일시'] as const;

/** Streamlit 원본 형식임을 결정짓는 마커 — 둘 다 한글 풀네임에는 없는 패턴. */
const STREAMLIT_MARKERS = ['ETB', '접안위치(F)'] as const;

/**
 * 헤더 set 으로 xlsx 형식 판정.
 * - 두 마커 set 이 mutually exclusive — 정상 파일이면 한쪽만 hit.
 * - 둘 다 hit 하면 우연/실수로 섞인 파일 → unknown.
 * - 둘 다 miss 면 지원 안 하는 헤더 → unknown.
 */
export function detectXlsxFormat(headers: string[]): FormatDetection {
  const set = new Set(headers);
  const bptHit = BPT_RAW_MARKERS.filter((m) => set.has(m));
  const streamlitHit = STREAMLIT_MARKERS.filter((m) => set.has(m));

  if (bptHit.length > 0 && streamlitHit.length > 0) {
    return {
      format: 'unknown',
      reason: `두 형식 마커가 동시 발견: BPTC=[${bptHit.join(', ')}], Streamlit=[${streamlitHit.join(', ')}]`,
      observedHeaders: headers,
    };
  }
  if (bptHit.length > 0) {
    return { format: 'bpt-raw', reason: `BPTC raw 마커 발견: ${bptHit.join(', ')}` };
  }
  if (streamlitHit.length > 0) {
    return {
      format: 'streamlit-xlsx',
      reason: `Streamlit 원본 마커 발견: ${streamlitHit.join(', ')}`,
    };
  }
  return {
    format: 'unknown',
    reason: 'BPTC raw / Streamlit 원본 어느 형식의 마커도 발견되지 않음',
    observedHeaders: headers,
  };
}

/**
 * Excel serial number → JS Date (LOCAL TZ 기준).
 *
 * Excel 의 epoch 는 1900-01-00 (실제론 1899-12-30 — 1900 leap bug 보정).
 * Excel 자체는 timezone 개념이 없어 작성한 PC 의 LOCAL 시각으로 저장 — KST 환경에서
 * 만든 파일이면 ETB=46098.04 가 "KST 자정 + 1시간" 의 의도.
 *
 * 따라서 (serial - 25569) * 86400_000 으로 UTC ms 를 만들면 KST 환경에서 9시간
 * 어긋남. base Date 를 LOCAL midnight (1899-12-30) 으로 잡고 days/fraction 을 더해야
 * Streamlit 원본의 ETB 값이 의도한 LOCAL 시각과 일치.
 */
export function excelSerialToDate(serial: number): Date {
  const days = Math.floor(serial);
  const fraction = serial - days;
  // 1899-12-30 LOCAL midnight
  const base = new Date(1899, 11, 30);
  base.setDate(base.getDate() + days);
  base.setTime(base.getTime() + Math.round(fraction * 86400_000));
  // SheetJS drift / fraction 정밀도 보정 — 분 단위 round.
  return new Date(Math.round(base.getTime() / 60_000) * 60_000);
}

/**
 * "YYYY/MM/DD HH:mm" — liveConverter.parseKrDate 가 인식하는 KR 라벨.
 * SheetJS 의 Date↔Excel serial 변환은 ms 단위 drift 가 있어 "15:00" 이 "14:59:59.999"
 * 로 들어오기도 함 — 분 단위 round 로 보정.
 */
function dateToKrLabel(date: Date): string {
  const rounded = new Date(Math.round(date.getTime() / 60_000) * 60_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${rounded.getFullYear()}/${pad(rounded.getMonth() + 1)}/${pad(rounded.getDate())} ` +
    `${pad(rounded.getHours())}:${pad(rounded.getMinutes())}`
  );
}

/** Excel serial 또는 raw 값을 안전하게 → KR 라벨. 변환 실패 시 빈 문자열. */
function serialToKrLabel(v: unknown): string {
  if (v == null || v === '') return '';
  if (v instanceof Date) {
    if (Number.isNaN(v.getTime())) return '';
    return dateToKrLabel(v);
  }
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  return dateToKrLabel(excelSerialToDate(n));
}

function asNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function asString(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Streamlit 원본 row → CrawlerRawRow (BPTC raw 형식).
 * 누락된 필드는 빈값/null. 후속 liveConverter 가 알아서 처리.
 */
export function streamlitRowToBptRaw(row: Record<string, unknown>): CrawlerRawRow {
  const f = asNumberOrNull(row['접안위치(F)']);
  const e = asNumberOrNull(row['접안위치(E)']);
  // bp 는 Streamlit 원본에 없음 — f/e 중점으로 추정.
  const bp = f != null && e != null ? (f + e) / 2 : null;

  return {
    구분: asString(row['구분']),
    선석: asString(row['선석']),
    모선항차: asString(row['모선항차']),
    선박명: asString(row['선박명']),
    선사: asString(row['선사']),
    '입항 예정일시': serialToKrLabel(row['ETA']),
    입항일시: serialToKrLabel(row['ETB']),
    작업완료일시: serialToKrLabel(row['ETD']),
    출항일시: serialToKrLabel(row['ETD']),
    양하: asNumberOrNull(row['양하(Van)']) ?? 0,
    선적: asNumberOrNull(row['선적(Van)']) ?? 0,
    'S/H': asNumberOrNull(row['Shifting(Van)'] ?? row['Shifting\n(Van)']) ?? 0,
    항로: asString(row['항로']),
    bp,
    f,
    e,
    plan_cd: null,
  };
}

/** Streamlit 원본 rows 배열 → BPTC raw 배열. */
export function streamlitRowsToBptRaw(rows: Record<string, unknown>[]): CrawlerRawRow[] {
  return rows.map(streamlitRowToBptRaw);
}
