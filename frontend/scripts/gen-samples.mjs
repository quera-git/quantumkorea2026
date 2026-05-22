#!/usr/bin/env node
// 더미 시나리오 풀 생성기.
//
// 3개 시나리오 × 3개 포맷 (payload JSON / raw 한글 JSON / .xlsx) + index.json.
// 결정적(seed 없음 — 데이터 자체가 하드코딩) — 매 실행마다 동일 출력.
//
// 사용:  node frontend/scripts/gen-samples.mjs
// 출력:  frontend/public/samples/*

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, '..', 'public', 'samples');

mkdirSync(OUT_DIR, { recursive: true });

// ----- 도메인 헬퍼 -----

const ROUTES = ['NCK', 'KRX', 'SRS', 'JKK', 'JHHZ'];
const COMPANIES = ['DYS', 'HAS', 'HMM', 'COSCO', 'MSC', 'CMA', 'ONE', 'EMC'];

// plan_cd raw 값 (4종 + 비어있음).
//   L = 적하 프래닝 완료 (분홍)
//   D = 양하 프래닝 완료 (청록)
//   C = 크래인 배정 완료 (베이지)
//   ''/null = BPTC 미게재 (회색)
//   기타 → crane_unassigned 매핑
const PLAN_CDS = ['L', 'D', 'C', '', null];
const PLAN_CD_TO_STATUS = {
  L: 'loading_planned',
  D: 'discharge_planned',
  C: 'crane_assigned',
};

function planCdToStatus(cd) {
  if (cd == null || cd === '') return null;
  return PLAN_CD_TO_STATUS[cd] ?? 'crane_unassigned';
}

function sectionFor(terminal) {
  return terminal === 'SND' ? '신선대' : '감만';
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Date → "YYYY/MM/DD HH:mm" (BPTC raw 포맷). */
function toKrLabel(date) {
  return (
    `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
  );
}

/** Date → ISO 8601 (Z 없는 local — Assignment 의 직렬화 패턴 따라). */
function toLocalIso(date) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T` +
    `${pad2(date.getHours())}:${pad2(date.getMinutes())}:00`
  );
}

/** 시각 오프셋 정수(hour). 기준은 시나리오 t0. */
function hoursBetween(t0, t) {
  return Math.round((t.getTime() - t0.getTime()) / 3_600_000);
}

// ----- 시나리오 정의 -----

/**
 * 한 척 정의. 도메인 일관성 자동 검증:
 *   - terminal=SND → berth 1~5, f/e ∈ [0,1500]
 *   - terminal=GAM → berth 6~9, f/e ∈ [0,1400]
 *   - length = |e - f|
 *   - workHours = (end - start) / 3600s
 */
function vessel(opts) {
  const {
    voyage,
    vessel: vesselName,
    company,
    terminal,
    berth,
    f,
    e,
    startHour, // t0 로부터 hour offset
    durationHours,
    route,
    plan_cd,
    yanghaVan = 0,
    seonjeokVan = 0,
    shiftingVan = 0,
  } = opts;
  return {
    voyage,
    vesselName,
    company,
    terminal,
    berth,
    f,
    e,
    startHour,
    durationHours,
    route,
    plan_cd,
    yanghaVan,
    seonjeokVan,
    shiftingVan,
  };
}

// 시나리오 1: 작음 — SND only, 5척, 12h window
const SCENARIO_SMALL = {
  id: 'sample-small-snd',
  label: '소형 · 신선대 5척 (12시간)',
  description: '신선대 5척, 12시간 window. 업로드 흐름 입문용.',
  t0: new Date(2026, 4, 22, 0, 0, 0), // 2026-05-22 00:00 (월 0-index)
  vessels: [
    vessel({
      voyage: 'JKAH-6',
      vessel: 'KAI HANG 5',
      company: 'DYS',
      terminal: 'SND',
      berth: 1,
      f: 18,
      e: 167.8,
      startHour: 1,
      durationHours: 6,
      route: 'NCK',
      plan_cd: 'L',
      seonjeokVan: 300,
    }),
    vessel({
      voyage: 'SWTD-9',
      vessel: 'SAWASDEE THAILAND',
      company: 'HAS',
      terminal: 'SND',
      berth: 1,
      f: 18.7,
      e: 190.7,
      startHour: 8,
      durationHours: 4,
      route: 'SRS',
      plan_cd: 'D',
      yanghaVan: 206,
      seonjeokVan: 450,
    }),
    vessel({
      voyage: 'JHHZ-8',
      vessel: 'HT HUIZHOU',
      company: 'DYS',
      terminal: 'SND',
      berth: 2,
      f: 320,
      e: 460,
      startHour: 2,
      durationHours: 5,
      route: 'KRX',
      plan_cd: 'C',
      yanghaVan: 200,
      seonjeokVan: 300,
    }),
    vessel({
      voyage: 'KSKJ-5',
      vessel: 'KMTC SUKAJADI',
      company: 'HMM',
      terminal: 'SND',
      berth: 2,
      f: 320,
      e: 470,
      startHour: 9,
      durationHours: 3,
      route: 'JKK',
      plan_cd: '', // null → 미게재
      yanghaVan: 80,
      seonjeokVan: 120,
    }),
    vessel({
      voyage: 'NCKB-3',
      vessel: 'NEW CARIBOU',
      company: 'COSCO',
      terminal: 'SND',
      berth: 3,
      f: 620,
      e: 770,
      startHour: 0,
      durationHours: 7,
      route: 'NCK',
      plan_cd: 'L',
      seonjeokVan: 250,
    }),
  ],
};

// 시나리오 2: 중간 — SND+GAM 혼합, 20척, 24h window
const SCENARIO_MIXED = {
  id: 'sample-mixed-snd-gam',
  label: '중형 · 신선대+감만 20척 (24시간)',
  description: '신선대 12척 + 감만 8척, 24시간. plan_status 4종 골고루.',
  t0: new Date(2026, 4, 22, 0, 0, 0),
  vessels: [
    // SND 12척, berth 1~5 분포
    vessel({ voyage: 'M-001', vessel: 'EVER ALPHA', company: 'EMC', terminal: 'SND', berth: 1, f: 10, e: 220, startHour: 0, durationHours: 8, route: 'NCK', plan_cd: 'L', seonjeokVan: 380 }),
    vessel({ voyage: 'M-002', vessel: 'COSCO BETA', company: 'COSCO', terminal: 'SND', berth: 1, f: 30, e: 230, startHour: 10, durationHours: 6, route: 'KRX', plan_cd: 'D', yanghaVan: 180 }),
    vessel({ voyage: 'M-003', vessel: 'MSC GAMMA', company: 'MSC', terminal: 'SND', berth: 2, f: 320, e: 540, startHour: 1, durationHours: 9, route: 'SRS', plan_cd: 'C', seonjeokVan: 420 }),
    vessel({ voyage: 'M-004', vessel: 'HMM DELTA', company: 'HMM', terminal: 'SND', berth: 2, f: 340, e: 520, startHour: 12, durationHours: 7, route: 'JKK', plan_cd: '', yanghaVan: 95 }),
    vessel({ voyage: 'M-005', vessel: 'CMA EPSILON', company: 'CMA', terminal: 'SND', berth: 3, f: 620, e: 850, startHour: 2, durationHours: 10, route: 'NCK', plan_cd: 'L', yanghaVan: 220, seonjeokVan: 310 }),
    vessel({ voyage: 'M-006', vessel: 'ONE ZETA', company: 'ONE', terminal: 'SND', berth: 3, f: 630, e: 790, startHour: 14, durationHours: 6, route: 'JHHZ', plan_cd: 'D', yanghaVan: 140 }),
    vessel({ voyage: 'M-007', vessel: 'EVER ETA', company: 'EMC', terminal: 'SND', berth: 4, f: 920, e: 1160, startHour: 0, durationHours: 11, route: 'KRX', plan_cd: 'C', seonjeokVan: 510 }),
    vessel({ voyage: 'M-008', vessel: 'COSCO THETA', company: 'COSCO', terminal: 'SND', berth: 4, f: 930, e: 1140, startHour: 13, durationHours: 8, route: 'NCK', plan_cd: 'L', yanghaVan: 300 }),
    vessel({ voyage: 'M-009', vessel: 'MSC IOTA', company: 'MSC', terminal: 'SND', berth: 5, f: 1220, e: 1450, startHour: 1, durationHours: 9, route: 'JKK', plan_cd: '', yanghaVan: 70 }),
    vessel({ voyage: 'M-010', vessel: 'HMM KAPPA', company: 'HMM', terminal: 'SND', berth: 5, f: 1230, e: 1410, startHour: 13, durationHours: 7, route: 'SRS', plan_cd: 'D', seonjeokVan: 280 }),
    vessel({ voyage: 'M-011', vessel: 'CMA LAMBDA', company: 'CMA', terminal: 'SND', berth: 3, f: 610, e: 800, startHour: 22, durationHours: 4, route: 'NCK', plan_cd: 'L', seonjeokVan: 180 }),
    vessel({ voyage: 'M-012', vessel: 'ONE MU', company: 'ONE', terminal: 'SND', berth: 2, f: 320, e: 530, startHour: 20, durationHours: 5, route: 'JHHZ', plan_cd: 'C', yanghaVan: 110 }),
    // GAM 8척, berth 6~9
    vessel({ voyage: 'M-013', vessel: 'KMTC NU', company: 'HMM', terminal: 'GAM', berth: 6, f: 10, e: 220, startHour: 0, durationHours: 9, route: 'KRX', plan_cd: 'L', seonjeokVan: 410 }),
    vessel({ voyage: 'M-014', vessel: 'PAN XI', company: 'DYS', terminal: 'GAM', berth: 6, f: 25, e: 200, startHour: 12, durationHours: 8, route: 'NCK', plan_cd: 'D', yanghaVan: 165 }),
    vessel({ voyage: 'M-015', vessel: 'SUNNY OMICRON', company: 'HAS', terminal: 'GAM', berth: 7, f: 370, e: 600, startHour: 2, durationHours: 10, route: 'SRS', plan_cd: 'C', seonjeokVan: 350 }),
    vessel({ voyage: 'M-016', vessel: 'ATLAS PI', company: 'EMC', terminal: 'GAM', berth: 7, f: 380, e: 580, startHour: 14, durationHours: 7, route: 'JHHZ', plan_cd: '', yanghaVan: 90 }),
    vessel({ voyage: 'M-017', vessel: 'GLOBAL RHO', company: 'COSCO', terminal: 'GAM', berth: 8, f: 720, e: 940, startHour: 1, durationHours: 11, route: 'JKK', plan_cd: 'L', yanghaVan: 250, seonjeokVan: 290 }),
    vessel({ voyage: 'M-018', vessel: 'PIONEER SIGMA', company: 'MSC', terminal: 'GAM', berth: 8, f: 730, e: 920, startHour: 16, durationHours: 6, route: 'NCK', plan_cd: 'D', yanghaVan: 130 }),
    vessel({ voyage: 'M-019', vessel: 'NORTHERN TAU', company: 'ONE', terminal: 'GAM', berth: 9, f: 1070, e: 1300, startHour: 0, durationHours: 8, route: 'KRX', plan_cd: 'C', seonjeokVan: 470 }),
    vessel({ voyage: 'M-020', vessel: 'SOUTHERN UPSILON', company: 'CMA', terminal: 'GAM', berth: 9, f: 1080, e: 1290, startHour: 12, durationHours: 9, route: 'JKK', plan_cd: 'L', yanghaVan: 200 }),
  ],
};

// 시나리오 3: 풀 데이 — 24h+, 40척 dense
const SCENARIO_FULL = (() => {
  const t0 = new Date(2026, 4, 22, 0, 0, 0);
  const vessels = [];
  // 결정적 생성: 각 berth 마다 (시작시각, 길이, plan_cd) 순열 고정.
  const cfg = [
    // [terminal, berth, baseF, baseE, capacity]
    ['SND', 1, 10, 230, 1500],
    ['SND', 2, 320, 540, 1500],
    ['SND', 3, 620, 850, 1500],
    ['SND', 4, 920, 1160, 1500],
    ['SND', 5, 1220, 1450, 1500],
    ['GAM', 6, 10, 220, 1400],
    ['GAM', 7, 370, 600, 1400],
    ['GAM', 8, 720, 940, 1400],
    ['GAM', 9, 1070, 1300, 1400],
  ];
  let idx = 0;
  // 한 berth 당 4~5척 → 총 40척 안팎
  cfg.forEach(([terminal, berth, f, e], cfgIdx) => {
    const count = cfgIdx < 5 ? 5 : 4; // SND 25 + GAM 16 = 41 → 40척 위해 마지막 줄임
    const slotsPerCount = Math.floor(24 / count);
    for (let i = 0; i < count && idx < 40; i += 1, idx += 1) {
      const startHour = i * slotsPerCount;
      const durationHours = slotsPerCount - 1;
      const planCd = PLAN_CDS[idx % PLAN_CDS.length];
      const route = ROUTES[idx % ROUTES.length];
      const company = COMPANIES[idx % COMPANIES.length];
      const voyageCode = `F-${String(idx + 1).padStart(3, '0')}`;
      vessels.push(
        vessel({
          voyage: voyageCode,
          vessel: `VESSEL ${voyageCode}`,
          company,
          terminal,
          berth,
          f,
          e,
          startHour,
          durationHours,
          route,
          plan_cd: planCd,
          yanghaVan: ((idx * 37) % 400),
          seonjeokVan: ((idx * 53) % 500),
        }),
      );
    }
  });
  return {
    id: 'sample-full-day',
    label: '풀데이 · 40척 (24시간 dense)',
    description: '신선대+감만 9선석 24시간 dense. 솔버 스트레스 테스트용.',
    t0,
    vessels,
  };
})();

const SCENARIOS = [SCENARIO_SMALL, SCENARIO_MIXED, SCENARIO_FULL];

// ----- 포맷별 빌더 -----

/** Assignment(풍부 도메인) row. src/data/*.json 와 동형. */
function toAssignmentRow(s, v, i) {
  const start = new Date(s.t0.getTime() + v.startHour * 3_600_000);
  const end = new Date(start.getTime() + v.durationHours * 3_600_000);
  return {
    rowId: `${s.id}-${i}`,
    voyage: v.voyage,
    sectionRaw: sectionFor(v.terminal),
    berth: v.berth,
    vessel: v.vesselName,
    company: v.company,
    start: toLocalIso(start),
    end: toLocalIso(end),
    eta: toLocalIso(start),
    f: v.f,
    e: v.e,
    yanghaVan: v.yanghaVan,
    seonjeokVan: v.seonjeokVan,
    shiftingVan: v.shiftingVan,
    route: v.route,
    length: Math.abs(v.e - v.f),
    workHours: v.durationHours,
    etbInt: hoursBetween(s.t0, start),
    etdInt: hoursBetween(s.t0, end),
    etaInt: hoursBetween(s.t0, start),
    terminal: v.terminal,
    planStatus: planCdToStatus(v.plan_cd),
  };
}

/** CrawlerRawRow — BPTC raw 한글 헤더. */
function toRawRow(s, v) {
  const start = new Date(s.t0.getTime() + v.startHour * 3_600_000);
  const end = new Date(start.getTime() + v.durationHours * 3_600_000);
  return {
    구분: sectionFor(v.terminal),
    선석: String(v.berth),
    모선항차: v.voyage,
    선박명: v.vesselName,
    선사: v.company,
    '입항 예정일시': toKrLabel(start),
    입항일시: toKrLabel(start),
    작업완료일시: toKrLabel(end),
    출항일시: toKrLabel(end),
    양하: v.yanghaVan,
    선적: v.seonjeokVan,
    'S/H': v.shiftingVan,
    항로: v.route,
    bp: (v.f + v.e) / 2,
    f: v.f,
    e: v.e,
    plan_cd: v.plan_cd ?? null,
  };
}

function buildPayload(s) {
  const rows = s.vessels.map((v, i) => toAssignmentRow(s, v, i));
  return {
    scenarioId: s.id,
    label: s.label,
    sourceFile: `${s.id}.xlsx`,
    rowCount: rows.length,
    rows,
  };
}

function buildRawRows(s) {
  return s.vessels.map((v) => toRawRow(s, v));
}

function buildXlsxBuffer(s) {
  const rows = buildRawRows(s);
  const ws = XLSX.utils.json_to_sheet(rows, {
    header: [
      '구분',
      '선석',
      '모선항차',
      '선박명',
      '선사',
      '입항 예정일시',
      '입항일시',
      '작업완료일시',
      '출항일시',
      '양하',
      '선적',
      'S/H',
      '항로',
      'bp',
      'f',
      'e',
      'plan_cd',
    ],
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '선석배정');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ----- 실행 -----

const indexEntries = [];

for (const s of SCENARIOS) {
  const payload = buildPayload(s);
  const raw = buildRawRows(s);
  const xlsxBuf = buildXlsxBuffer(s);

  const payloadPath = join(OUT_DIR, `${s.id}.payload.json`);
  const rawPath = join(OUT_DIR, `${s.id}.raw.json`);
  const xlsxPath = join(OUT_DIR, `${s.id}.xlsx`);

  writeFileSync(payloadPath, JSON.stringify(payload, null, 2));
  writeFileSync(rawPath, JSON.stringify(raw, null, 2));
  writeFileSync(xlsxPath, xlsxBuf);

  indexEntries.push({
    id: s.id,
    label: s.label,
    description: s.description,
    rowCount: s.vessels.length,
    files: [
      { format: 'payload', file: `${s.id}.payload.json`, label: '풍부 ScenarioPayload (JSON)' },
      { format: 'raw', file: `${s.id}.raw.json`, label: '한글 헤더 raw rows (JSON)' },
      { format: 'xlsx', file: `${s.id}.xlsx`, label: '엑셀 (한글 헤더, .xlsx)' },
    ],
  });
  console.log(`✓ ${s.id}  (${s.vessels.length} vessels)`);
}

writeFileSync(
  join(OUT_DIR, 'index.json'),
  JSON.stringify({ scenarios: indexEntries }, null, 2),
);
console.log(`✓ index.json (${indexEntries.length} scenarios)`);
console.log(`\n출력: ${OUT_DIR}`);
