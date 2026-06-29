#!/usr/bin/env node
// Figure/ 의 솔버 출력 (Optimized_*) 을 입력 시나리오의 풍부 메타와 머지해서
// 우리 frontend 가 인식하는 ScenarioPayload JSON 으로 변환.
//
// 3 시나리오 × 4 솔버 = 최대 12 결과 + 입력 3개 + 운영자 2개:
//
//   시나리오 #1 (BPT_Result, 62척, 일반 운영)
//     · CQM    = Optimized_BPT_Result_CQM180_verfinal1
//     · Hybrid = Optimized_BPT_Result_Hybrid_verfinal1
//     · Gurobi = Optimized_BPT_Result_Gurobi300_verFinal1
//     · 운영자 = BPT_Result 자체 (= 운영자가 짠 실 운영 데이터)
//
//   시나리오 #2 (Before 0313 14:30, 58척, 낮시간 혼잡)
//     · CQM    = Optimized_Before_CQM180_verfinal2
//     · Hybrid = Optimized_Before_Hybrid_verfinal2
//     · Gurobi = Optimized_Before_Gurobi300_verFinal2
//     · 운영자 = After 0313 16:10
//
//   시나리오 #3 (Before 0316 08:00, 58척, 크레인 부족)
//     · CQM    = Optimized_Before_CQM180_verfinal3
//     · Hybrid = Optimized_Before_Hybrid_verfinal3
//     · Gurobi = Optimized_Before_Gurobi300_verFinal3
//     · 운영자 = After 0316 10:06
//
// 변환 핵심:
//   - base (입력) 의 모선항차 + 선박명 으로 솔버 결과와 매칭
//   - base 의 풍부 메타 (구분/선박명/선사/항로 등) 유지
//   - 솔버 결과의 시간 (ETB_int/ETD_int/ETA_int) + 위치 (접안위치(F)/Length) 로 갱신
//   - berth: 새 접안위치 기준 재추론 (선석 일관성 검증 통과)
//   - 절대 시각: REF + hour offset

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..', '..', '..');
const SAB = join(REPO_ROOT, 'status-allocation-berths');
const OUT_DIR = join(HERE, '..', 'public', 'demo');
mkdirSync(OUT_DIR, { recursive: true });

// ETB_int=0 의 절대 시각. 시나리오 모든 ref 동일 — 시각 비교 용이.
const REF = new Date(2026, 2, 13, 0, 0, 0); // 2026-03-13 00:00 KST

// ---------- 유틸 ----------

function readXlsxRows(file) {
  const buf = readFileSync(file);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(ws, { defval: '', raw: true });
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function isoFromHours(hOffset) {
  const ms = REF.getTime() + hOffset * 3_600_000;
  const d = new Date(ms);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
  );
}

function asNum(v, def = 0) {
  if (v == null || v === '') return def;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : def;
}

function asStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

function excelSerialToDate(serial) {
  const days = Math.floor(serial);
  const fraction = serial - days;
  const base = new Date(1899, 11, 30);
  base.setDate(base.getDate() + days);
  base.setTime(base.getTime() + Math.round(fraction * 86400_000));
  return new Date(Math.round(base.getTime() / 60_000) * 60_000);
}

function isoFromExcel(serial) {
  const d = excelSerialToDate(serial);
  return (
    `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T` +
    `${pad2(d.getHours())}:${pad2(d.getMinutes())}:00`
  );
}

function inferTerminalFromBerth(berth) {
  if (berth >= 1 && berth <= 5) return 'SND';
  if (berth >= 6 && berth <= 9) return 'GAM';
  return 'SND';
}

/**
 * 접안위치 중점으로 berth 재추론.
 *   SND: 0~1500m, step 300, berth 1~5
 *   GAM: 0~1400m, step 350, berth 6~9
 * 솔버가 SND→GAM (또는 반대) 로 옮긴 경우는 없다고 가정 (1D 모델).
 */
function inferBerthFromCenter(terminal, center) {
  if (terminal === 'SND') {
    const idx = Math.floor(center / 300);
    return Math.min(5, Math.max(1, idx + 1));
  }
  // GAM
  const idx = Math.floor(center / 350);
  return Math.min(9, Math.max(6, idx + 6));
}

/** Figure 솔버 결과 row 의 voyage 추출 — Gurobi 는 `선박명` 컬럼 사용. */
function optVoyage(row) {
  return asStr(row['모선항차'] || row['선박명']);
}

/** Streamlit 원본 row 의 shiftingVan (다양한 컬럼명). */
function shiftingVan(row) {
  return asNum(
    row['Shifting(Van)'] ?? row['Shifting\n(Van)'] ?? row['Shifting\r\n(Van)'],
  );
}

/** base row + opt row 머지 → Assignment. berth 재추론 포함. */
function mergeBaseAndOpt(baseRow, optRow, idx, slotId) {
  const f = asNum(optRow['접안위치(F)']);
  const length = asNum(optRow['Length'], asNum(baseRow['Length']));
  const e = f + length;
  const center = (f + e) / 2;

  const etbH = asNum(optRow['ETB_int']);
  const etdH = asNum(optRow['ETD_int']);
  const etaH = asNum(optRow['ETA_int']);

  // 원래 base 의 berth/terminal — 검증 통과 위해 재추론.
  const origBerth = asNum(baseRow['선석']);
  const origTerminal = inferTerminalFromBerth(origBerth);
  // SND vs GAM 의 경계 (1500m) — 솔버가 cross-terminal 이동 안 한다고 가정해 원래 terminal 유지.
  const terminal = origTerminal;
  const berth = inferBerthFromCenter(terminal, center);

  return {
    rowId: `${slotId}-${idx}-${asStr(baseRow['모선항차'])}`,
    voyage: asStr(baseRow['모선항차']),
    vessel: asStr(baseRow['선박명']),
    company: asStr(baseRow['선사']),
    sectionRaw: asStr(baseRow['구분']),
    terminal,
    berth,
    route: asStr(baseRow['항로']),
    start: isoFromHours(etbH),
    end: isoFromHours(etdH),
    eta: isoFromHours(etaH),
    etbInt: etbH,
    etdInt: etdH,
    etaInt: etaH,
    f,
    e,
    length,
    yanghaVan: asNum(baseRow['양하(Van)']),
    seonjeokVan: asNum(baseRow['선적(Van)']),
    shiftingVan: shiftingVan(baseRow),
    workHours: Math.max(0, etdH - etbH),
    planStatus: null,
  };
}

/** 입력 base xlsx (Streamlit 원본) → Assignment[]. ETB Excel serial 사용. */
function baseRowToAssignment(row, idx, slotId) {
  const f = asNum(row['접안위치(F)']);
  const e = asNum(row['접안위치(E)'], f + asNum(row['Length']));
  const length = asNum(row['Length'], e - f);

  const etbSerial = asNum(row['ETB']);
  const etdSerial = asNum(row['ETD']);
  const etaSerial = asNum(row['ETA'], etbSerial);

  const berth = asNum(row['선석']);
  const terminal = inferTerminalFromBerth(berth);

  return {
    rowId: `${slotId}-${idx}-${asStr(row['모선항차'])}`,
    voyage: asStr(row['모선항차']),
    vessel: asStr(row['선박명']),
    company: asStr(row['선사']),
    sectionRaw: asStr(row['구분']),
    terminal,
    berth,
    route: asStr(row['항로']),
    start: etbSerial > 0 ? isoFromExcel(etbSerial) : null,
    end: etdSerial > 0 ? isoFromExcel(etdSerial) : null,
    eta: etaSerial > 0 ? isoFromExcel(etaSerial) : null,
    etbInt: asNum(row['ETB_int']),
    etdInt: asNum(row['ETD_int']),
    etaInt: asNum(row['ETA_int']),
    f,
    e,
    length,
    yanghaVan: asNum(row['양하(Van)']),
    seonjeokVan: asNum(row['선적(Van)']),
    shiftingVan: shiftingVan(row),
    workHours: asNum(row['작업시간(ETD-ETB)']),
    planStatus: null,
  };
}

function writePayload(filename, scenarioId, label, rows) {
  const payload = {
    scenarioId,
    label,
    sourceFile: filename,
    rowCount: rows.length,
    rows,
  };
  writeFileSync(join(OUT_DIR, filename), JSON.stringify(payload, null, 2));
}

// ---------- 시나리오 정의 ----------

const SCENARIOS = [
  {
    id: 1,
    label: '시나리오 #1 (일반 운영)',
    baseFile: join(SAB, 'BPT_Result.xlsx'),
    solvers: {
      cqm: 'Figure/Optimized_BPT_Result_CQM180_verfinal1.xlsx',
      hybrid: 'Figure/Optimized_BPT_Result_Hybrid_verfinal1.xlsx',
      gurobi: 'Figure/Optimized_BPT_Result_Gurobi300_verFinal1.xlsx',
    },
    // 시나리오 #1 의 운영자 결과 = BPT_Result 자체 (실 운영 데이터).
    operatorIsBase: true,
  },
  {
    id: 2,
    label: '시나리오 #2 (낮시간 혼잡)',
    baseFile: join(SAB, '선박관련/Before_Snapshot_Sinseondae_20260313_143000.xlsx'),
    solvers: {
      cqm: 'Figure/Optimized_Before_CQM180_verfinal2.xlsx',
      hybrid: 'Figure/Optimized_Before_Hybrid_verfinal2.xlsx',
      gurobi: 'Figure/Optimized_Before_Gurobi300_verFinal2.xlsx',
    },
    operatorFile: join(SAB, '선박관련/After_Snapshot_Sinseondae_20260313_161000.xlsx'),
  },
  {
    id: 3,
    label: '시나리오 #3 (크레인 부족)',
    baseFile: join(SAB, '선박관련/Before_Snapshot_Sinseondae_20260316_080000.xlsx'),
    solvers: {
      cqm: 'Figure/Optimized_Before_CQM180_verfinal3.xlsx',
      hybrid: 'Figure/Optimized_Before_Hybrid_verfinal3.xlsx',
      gurobi: 'Figure/Optimized_Before_Gurobi300_verFinal3.xlsx',
    },
    operatorFile: join(SAB, '선박관련/After_Snapshot_Sinseondae_20260316_100600.xlsx'),
  },
];

// ---------- Run ----------

for (const sc of SCENARIOS) {
  const baseRows = readXlsxRows(sc.baseFile);
  console.log(`\n[시나리오 #${sc.id}] base: ${baseRows.length} rows`);

  // 입력 시나리오 자체도 변환해서 저장 (auto-register 가 입력으로 사용).
  const inputAssignments = baseRows.map((r, i) => baseRowToAssignment(r, i, `input-${sc.id}`));
  writePayload(
    `scenario-${sc.id}-input.payload.json`,
    `scenario-${sc.id}-input`,
    `${sc.label} — 입력 (${baseRows.length}척)`,
    inputAssignments,
  );
  console.log(`  ✓ input: ${inputAssignments.length} rows`);

  // 솔버 결과 3개 (CQM / Hybrid / Gurobi)
  for (const [solverName, relPath] of Object.entries(sc.solvers)) {
    const optRows = readXlsxRows(join(SAB, relPath));
    const byKey = new Map();
    optRows.forEach((r) => {
      const v = optVoyage(r);
      if (v) byKey.set(v, r);
    });

    let matched = 0;
    const assignments = [];
    baseRows.forEach((b, i) => {
      const voyage = asStr(b['모선항차']);
      const vessel = asStr(b['선박명']);
      const o = byKey.get(voyage) ?? byKey.get(vessel);
      if (!o) return;
      assignments.push(mergeBaseAndOpt(b, o, i, `s${sc.id}-${solverName}`));
      matched += 1;
    });

    writePayload(
      `scenario-${sc.id}-${solverName}.payload.json`,
      `scenario-${sc.id}-${solverName}`,
      `${sc.label} — ${solverName.toUpperCase()} 결과`,
      assignments,
    );
    console.log(`  ✓ ${solverName}: ${matched} matched / ${baseRows.length - matched} unmatched`);
  }

  // 운영자 결과
  let operatorRows;
  if (sc.operatorIsBase) {
    // 시나리오 #1: 운영자 결과 = BPT_Result 자체.
    operatorRows = inputAssignments.map((a) => ({ ...a, rowId: `s${sc.id}-operator-${a.voyage}` }));
  } else {
    // 시나리오 #2/#3: After_Snapshot (Streamlit 원본 형식).
    const afterRows = readXlsxRows(sc.operatorFile);
    operatorRows = afterRows.map((r, i) => baseRowToAssignment(r, i, `s${sc.id}-operator`));
  }
  writePayload(
    `scenario-${sc.id}-operator.payload.json`,
    `scenario-${sc.id}-operator`,
    `${sc.label} — 운영자 결과`,
    operatorRows,
  );
  console.log(`  ✓ operator: ${operatorRows.length} rows${sc.operatorIsBase ? ' (= input)' : ''}`);
}

console.log(`\n완료 — ${OUT_DIR}`);
