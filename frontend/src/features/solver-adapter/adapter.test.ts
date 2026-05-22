import { describe, expect, it } from 'vitest';

import type { Assignment } from '@/shared/domain/types';
import type { ScheduleEntry } from '@/shared/types/schema';

import {
  adapterCheck,
  assignmentToBPTRecord,
  buildOptimizeRequest,
  deriveReferenceTime,
  stitchResult,
} from './adapter';

const HOUR_MS = 3_600_000;

function row(over: Partial<Assignment>): Assignment {
  return {
    rowId: 'r',
    voyage: 'V',
    vessel: 'Vessel',
    company: 'C',
    sectionRaw: '',
    terminal: 'SND',
    berth: 1,
    route: 'NCK',
    start: '2026-03-13T00:00:00.000Z',
    end: '2026-03-13T08:00:00.000Z',
    eta: '2026-03-13T00:00:00.000Z',
    etbInt: 0,
    etdInt: 8,
    etaInt: 0,
    f: 0,
    e: 200,
    length: 200,
    yanghaVan: 10,
    seonjeokVan: 20,
    shiftingVan: 0,
    workHours: 8,
    planStatus: null,
    ...over,
  };
}

describe('adapterCheck', () => {
  it('정상 행 → ok', () => {
    const r = adapterCheck([row({})]);
    expect(r.ok).toBe(true);
    expect(r.blocking).toEqual([]);
  });

  it('비어 있으면 blocking', () => {
    const r = adapterCheck([]);
    expect(r.ok).toBe(false);
    expect(r.blocking[0]).toContain('비어');
  });

  it('voyage 없으면 blocking', () => {
    const r = adapterCheck([row({ voyage: '' })]);
    expect(r.ok).toBe(false);
    expect(r.blocking.some((m) => m.includes('vessel_id'))).toBe(true);
  });

  it('start/end 없으면 blocking', () => {
    const r = adapterCheck([row({ start: null, end: null })]);
    expect(r.ok).toBe(false);
  });

  it('f/e 같으면 length=0 → blocking', () => {
    const r = adapterCheck([row({ f: 100, e: 100 })]);
    expect(r.ok).toBe(false);
    expect(r.blocking.some((m) => m.includes('선체 길이 0'))).toBe(true);
  });

  it('terminal 미지정 → blocking', () => {
    const r = adapterCheck([row({ terminal: '' as 'SND' })]);
    expect(r.ok).toBe(false);
  });

  it('짧은 선체 (< 30m) → warning, blocking 아님', () => {
    const r = adapterCheck([row({ f: 0, e: 20 })]);
    expect(r.ok).toBe(true);
    expect(r.warnings.some((m) => m.includes('짧은'))).toBe(true);
  });
});

describe('deriveReferenceTime', () => {
  it('(start, etbInt) 짝에서 mode 추출', () => {
    // ref = 2026-03-13T00:00 KST 라 가정. etbInt=10 인 행은 start = ref + 10h.
    const ref = new Date('2026-03-13T00:00:00.000Z').getTime();
    const r1 = row({ rowId: 'a', start: new Date(ref + 10 * HOUR_MS).toISOString(), etbInt: 10 });
    const r2 = row({ rowId: 'b', start: new Date(ref + 24 * HOUR_MS).toISOString(), etbInt: 24 });
    const out = deriveReferenceTime([r1, r2]);
    expect(out.getTime()).toBe(ref);
  });

  it('etbInt 없는 행만 있으면 가장 이른 start 를 reference 로', () => {
    const earliest = '2026-03-15T05:00:00.000Z';
    const out = deriveReferenceTime([
      row({ rowId: 'a', start: earliest, etbInt: null }),
      row({ rowId: 'b', start: '2026-03-16T01:00:00.000Z', etbInt: null }),
    ]);
    expect(out.toISOString()).toBe(earliest);
  });

  it('한 row 만 노이즈여도 mode 가 살아남음', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z').getTime();
    const noisy = new Date(ref + 7 * HOUR_MS + 12 * 60_000); // 7:12
    const r1 = row({ rowId: 'a', start: new Date(ref + 10 * HOUR_MS).toISOString(), etbInt: 10 });
    const r2 = row({ rowId: 'b', start: new Date(ref + 24 * HOUR_MS).toISOString(), etbInt: 24 });
    const r3 = row({ rowId: 'c', start: noisy.toISOString(), etbInt: 8 });
    const out = deriveReferenceTime([r1, r2, r3]);
    expect(out.getTime()).toBe(ref);
  });
});

describe('assignmentToBPTRecord', () => {
  it('기본 필드 매핑 (length=e-f, berth_position=min(f,e))', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const a = row({ f: 30, e: 230, etbInt: 0, etdInt: 8, etaInt: 0 });
    const b = assignmentToBPTRecord(a, ref);
    expect(b.vessel_id).toBe('V');
    expect(b.length).toBe(200);
    expect(b.berth_position).toBe(30);
    expect(b.etb_int).toBe(0);
    expect(b.etd_int).toBe(8);
    expect(b.yangha_van).toBe(10);
    expect(b.seonjeok_van).toBe(20);
  });

  it('e<f 인 경우 length 절댓값, berth_position 은 작은 쪽', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const a = row({ f: 200, e: 50 });
    const b = assignmentToBPTRecord(a, ref);
    expect(b.length).toBe(150);
    expect(b.berth_position).toBe(50);
  });

  it('time → hour 변환 (reference 가 다른 시각)', () => {
    const ref = new Date('2026-03-12T00:00:00.000Z');
    // start 가 ref + 24h
    const a = row({
      start: new Date(ref.getTime() + 24 * HOUR_MS).toISOString(),
      end: new Date(ref.getTime() + 32 * HOUR_MS).toISOString(),
      eta: new Date(ref.getTime() + 23 * HOUR_MS).toISOString(),
    });
    const b = assignmentToBPTRecord(a, ref);
    expect(b.etb_int).toBe(24);
    expect(b.etd_int).toBe(32);
    expect(b.eta_int).toBe(23);
  });
});

describe('buildOptimizeRequest', () => {
  it('OptimizeRequest 빌드 + planning_start_time = floor(min etb)', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const rows = [
      row({
        rowId: 'a',
        start: new Date(ref.getTime() + 10 * HOUR_MS).toISOString(),
        end: new Date(ref.getTime() + 20 * HOUR_MS).toISOString(),
        etbInt: 10,
      }),
      row({
        rowId: 'b',
        voyage: 'V2',
        start: new Date(ref.getTime() + 5 * HOUR_MS).toISOString(),
        end: new Date(ref.getTime() + 15 * HOUR_MS).toISOString(),
        etbInt: 5,
      }),
    ];
    const built = buildOptimizeRequest(rows, 'cqm');
    expect(built.request.solver).toBe('cqm');
    expect(built.request.bpt_records).toHaveLength(2);
    expect(built.planningStartTime).toBe(5);
    expect(built.reference.toISOString()).toBe(ref.toISOString());
  });
});

describe('stitchResult', () => {
  it('schedule + originals → 풍부 도메인 복원 (terminal/berth/vessel/route)', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const originals = [
      row({ rowId: 'a', voyage: 'V1', terminal: 'SND', berth: 1, vessel: 'A', route: 'NCK', f: 0, e: 200 }),
      row({ rowId: 'b', voyage: 'V2', terminal: 'GAM', berth: 8, vessel: 'B', route: 'SRS', f: 0, e: 180 }),
    ];
    const schedule: ScheduleEntry[] = [
      { vessel_id: 'V1', length: 200, eta: 0, etb: 0, etd: 8, berth_position: 60, note: '' },
      { vessel_id: 'V2', length: 180, eta: 1, etb: 1, etd: 12, berth_position: 360, note: '' },
    ];
    const { rows, unmatched } = stitchResult(schedule, originals, ref);
    expect(unmatched).toEqual([]);
    expect(rows).toHaveLength(2);

    const r1 = rows.find((r) => r.voyage === 'V1')!;
    expect(r1.terminal).toBe('SND'); // 원본 terminal 유지
    expect(r1.vessel).toBe('A'); // 원본 vessel 유지
    expect(r1.route).toBe('NCK'); // 원본 route 유지
    expect(r1.f).toBe(60); // 새 berth_position
    expect(r1.e).toBe(260);
    expect(r1.start).toBe(ref.toISOString());
    expect(r1.end).toBe(new Date(ref.getTime() + 8 * HOUR_MS).toISOString());

    const r2 = rows.find((r) => r.voyage === 'V2')!;
    expect(r2.terminal).toBe('GAM');
    expect(r2.f).toBe(360);
    expect(r2.e).toBe(540);
  });

  it('매칭 안 된 vessel_id 는 unmatched 로 분리', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const originals = [row({ rowId: 'a', voyage: 'V1' })];
    const schedule: ScheduleEntry[] = [
      { vessel_id: 'V1', length: 200, eta: 0, etb: 0, etd: 8, berth_position: 0, note: '' },
      { vessel_id: 'GHOST', length: 100, eta: 0, etb: 0, etd: 4, berth_position: 0, note: '' },
    ];
    const { rows, unmatched } = stitchResult(schedule, originals, ref);
    expect(rows).toHaveLength(1);
    expect(unmatched).toEqual(['GHOST']);
  });

  it('berth 는 새 mid 위치로 inferBerthFromY 로 재추론 (SND y=400 → berth 2)', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const originals = [row({ rowId: 'a', voyage: 'V1', terminal: 'SND', berth: 1, f: 0, e: 200 })];
    // 새 berth_position 300 + length 200 → mid 400. SND step=300 → idx 1 → berth 2.
    const schedule: ScheduleEntry[] = [
      { vessel_id: 'V1', length: 200, eta: 0, etb: 0, etd: 8, berth_position: 300, note: '' },
    ];
    const { rows } = stitchResult(schedule, originals, ref);
    expect(rows[0]?.berth).toBe(2);
  });
});

describe('round-trip: assignment → BPTRecord → ScheduleEntry → stitch', () => {
  it('동일 위치 그대로 들어왔다 나가면 시간/위치 보존', () => {
    const ref = new Date('2026-03-13T00:00:00.000Z');
    const orig = row({
      rowId: 'a',
      voyage: 'V1',
      terminal: 'SND',
      berth: 1,
      f: 30,
      e: 230,
      start: new Date(ref.getTime() + 5 * HOUR_MS).toISOString(),
      end: new Date(ref.getTime() + 13 * HOUR_MS).toISOString(),
      eta: new Date(ref.getTime() + 5 * HOUR_MS).toISOString(),
      etbInt: 5,
      etdInt: 13,
      etaInt: 5,
    });
    const bpt = assignmentToBPTRecord(orig, ref);

    // 가상의 솔버: 입력 그대로 반환.
    const schedule: ScheduleEntry[] = [
      {
        vessel_id: bpt.vessel_id,
        length: bpt.length,
        eta: bpt.eta_int,
        etb: bpt.etb_int,
        etd: bpt.etd_int,
        berth_position: bpt.berth_position,
        note: '',
      },
    ];
    const { rows } = stitchResult(schedule, [orig], ref);
    const r = rows[0]!;
    expect(r.start).toBe(orig.start);
    expect(r.end).toBe(orig.end);
    expect(r.f).toBe(30);
    expect(r.e).toBe(230);
    expect(r.terminal).toBe('SND');
  });
});
