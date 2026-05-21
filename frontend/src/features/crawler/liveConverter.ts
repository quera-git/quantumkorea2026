// 백엔드 /crawler/preview 의 raw 한글 컬럼 행 → 우리 풍부 Assignment 변환.
//
// 백엔드 raw 컬럼:
//   구분 (신선대|감만)  선석 (1-9)  모선항차  선박명  접안  선사
//   입항 예정일시  입항일시  작업완료일시  출항일시  반입 마감일시
//   양하  선적  S/H  전배  항로  검역  bp  f  e
//
// frontend Assignment 로 매핑 — null 허용 필드는 최대한 보존.

import type { CrawlerRawRow } from '@/shared/api/crawler.api';
import { inferTerminalFromBerth } from '@/shared/domain';
import type { Assignment, PlanStatus } from '@/shared/domain/types';

/** "2026/05/19 04:00" → ISO 8601 (local). 실패 시 null. */
function parseKrDate(s: string | undefined): string | null {
  if (!s) return null;
  // "YYYY/MM/DD HH:MM" 또는 "YYYY-MM-DD HH:MM" 등 관대하게.
  const m = /(\d{4})[/-](\d{1,2})[/-](\d{1,2})[ T](\d{1,2}):(\d{2})/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  // 로컬 시간으로 해석. (서버가 KST 가정이지만 표시는 로컬 그대로 일관.)
  const dt = new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function toNumberOrNull(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function toIntOrZero(v: unknown): number {
  const n = toNumberOrNull(v);
  return n == null ? 0 : Math.trunc(n);
}

function sectionToTerminal(section: string | undefined): Assignment['terminal'] {
  const s = (section ?? '').trim();
  if (s === '신선대') return 'SND';
  if (s === '감만') return 'GAM';
  return '';
}

/**
 * BPTC 선석배정 그래픽 plan_cd → PlanStatus.
 * backend services/crawler/mapper.py 의 _PLAN_CD_TO_STATUS 와 1:1.
 *   L → loading_planned
 *   D → discharge_planned
 *   C → crane_assigned
 *   그 외 비어있지 않은 값 → crane_unassigned
 *   null/undefined/빈문자 → null (그래픽 미게재)
 */
function planCdToStatus(planCd: string | null | undefined): PlanStatus | null {
  if (planCd == null) return null;
  const s = planCd.trim();
  if (!s) return null;
  if (s === 'L') return 'loading_planned';
  if (s === 'D') return 'discharge_planned';
  if (s === 'C') return 'crane_assigned';
  return 'crane_unassigned';
}

/** 한 row 변환. 누락이 많으면 null 반환 (필터에서 제거). */
export function convertCrawledRow(raw: CrawlerRawRow, idx: number): Assignment | null {
  const voyage = (raw.모선항차 ?? '').trim();
  if (!voyage) return null;

  const sectionRaw = (raw.구분 ?? '').trim();
  const terminal = sectionToTerminal(sectionRaw);

  const berthRaw = raw.선석;
  const berth = typeof berthRaw === 'number' ? Math.trunc(berthRaw) : parseInt(String(berthRaw ?? ''), 10);

  const f = toNumberOrNull(raw.f);
  const e = toNumberOrNull(raw.e);
  const length = f != null && e != null ? Math.abs(e - f) : null;

  const start = parseKrDate(raw.입항일시) ?? parseKrDate(raw['입항 예정일시']);
  const end = parseKrDate(raw.작업완료일시) ?? parseKrDate(raw.출항일시);
  const eta = parseKrDate(raw['입항 예정일시']) ?? start;

  return {
    rowId: `live-${idx}-${voyage}`,
    voyage,
    vessel: (raw.선박명 ?? '').trim(),
    company: (raw.선사 ?? '').trim(),
    sectionRaw,
    // terminal 이 빈 문자열인데 berth 가 1-9 면 berth 로 역추론.
    terminal: terminal || (Number.isFinite(berth) ? inferTerminalFromBerth(berth) : ''),
    berth: Number.isFinite(berth) ? berth : 0,
    route: (raw.항로 ?? '').trim(),
    start,
    end,
    eta,
    etbInt: null,
    etdInt: null,
    etaInt: null,
    f,
    e,
    length,
    yanghaVan: toIntOrZero(raw.양하),
    seonjeokVan: toIntOrZero(raw.선적),
    shiftingVan: toIntOrZero(raw['S/H']),
    workHours:
      start && end
        ? Math.round(((Date.parse(end) - Date.parse(start)) / 3_600_000) * 10) / 10
        : null,
    planStatus: planCdToStatus(raw.plan_cd),
  };
}

/** raw rows 배열을 변환. 누락된 행은 자동 스킵 + 통계 반환. */
export function convertCrawledRows(rows: CrawlerRawRow[]): {
  assignments: Assignment[];
  dropped: number;
} {
  const out: Assignment[] = [];
  let dropped = 0;
  rows.forEach((r, i) => {
    const a = convertCrawledRow(r, i);
    if (a) out.push(a);
    else dropped += 1;
  });
  return { assignments: out, dropped };
}
