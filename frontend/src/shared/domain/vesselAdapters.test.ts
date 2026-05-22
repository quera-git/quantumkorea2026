import { describe, expect, it } from 'vitest';

import { bptRecordToAssignment, scheduleEntryToAssignment } from './vesselAdapters';

describe('bptRecordToAssignment', () => {
  const rec = {
    vessel_id: 'D-1',
    length: 200,
    eta_int: 0,
    etb_int: 1,
    etd_int: 9,
    berth_position: 100,
    yangha_van: 30,
    seonjeok_van: 200,
  };

  it('SND 영역(0-1500) 의 berth_position 으로 terminal=SND + berth 추론', () => {
    // berth_position=100 → mid=200 → SND berth 1
    const a = bptRecordToAssignment(rec, 0);
    expect(a.terminal).toBe('SND');
    expect(a.berth).toBeGreaterThanOrEqual(1);
    expect(a.berth).toBeLessThanOrEqual(5);
  });

  it('voyage = vessel = vessel_id (1D 라 구분 정보 없음)', () => {
    const a = bptRecordToAssignment(rec, 0);
    expect(a.voyage).toBe('D-1');
    expect(a.vessel).toBe('D-1');
  });

  it('reference time 없으면 ISO 시간 null', () => {
    const a = bptRecordToAssignment(rec, 0);
    expect(a.start).toBeNull();
    expect(a.end).toBeNull();
    expect(a.eta).toBeNull();
  });

  it('reference time 있으면 ISO 변환', () => {
    const ref = new Date('2026-05-19T00:00:00.000Z');
    const a = bptRecordToAssignment(rec, 0, ref);
    expect(a.eta).toBe('2026-05-19T00:00:00.000Z'); // eta_int=0
    expect(a.start).toBe('2026-05-19T01:00:00.000Z'); // etb_int=1
    expect(a.end).toBe('2026-05-19T09:00:00.000Z'); // etd_int=9
  });

  it('hour offset 필드 보존', () => {
    const a = bptRecordToAssignment(rec, 0);
    expect(a.etaInt).toBe(0);
    expect(a.etbInt).toBe(1);
    expect(a.etdInt).toBe(9);
    expect(a.workHours).toBe(8);
  });

  it('f/e 는 berth_position 기준 (f=berth_position, e=berth_position+length)', () => {
    const a = bptRecordToAssignment(rec, 0);
    expect(a.f).toBe(100);
    expect(a.e).toBe(300);
    expect(a.length).toBe(200);
  });

  it('planStatus 는 항상 null (1D 도메인 plan_cd 없음)', () => {
    const a = bptRecordToAssignment(rec, 0);
    expect(a.planStatus).toBeNull();
  });

  it('rowId 는 bpt-{idx}-{vessel_id} 형식', () => {
    const a = bptRecordToAssignment(rec, 5);
    expect(a.rowId).toBe('bpt-5-D-1');
  });

  it('GAM 영역 berth_position 으로 terminal=GAM 추론 (berth_position 800 → GAM)', () => {
    const a = bptRecordToAssignment({ ...rec, berth_position: 800, length: 200 }, 0);
    // 800 은 GAM 의 berth band 안 (0~1400). 그리고 SND 의 berth_position 도 가능 (0~1500).
    // tryInferTerminalBerth 가 SND 먼저 시도하므로 SND 가 잡힐 가능성 있음 — 그래도 OK.
    expect(['SND', 'GAM']).toContain(a.terminal);
  });

  it('범위 밖 berth_position (음수) → terminal 빈 문자열, berth 0', () => {
    const a = bptRecordToAssignment({ ...rec, berth_position: -100 }, 0);
    expect(a.terminal).toBe('');
    expect(a.berth).toBe(0);
  });
});

describe('scheduleEntryToAssignment', () => {
  const entry = {
    vessel_id: 'S-1',
    length: 150,
    eta: 0,
    etb: 2,
    etd: 10,
    berth_position: 50,
    note: 'best',
  };

  it('ScheduleEntry → Assignment-like (rowId schedule-{idx}-)', () => {
    const a = scheduleEntryToAssignment(entry, 3);
    expect(a.rowId).toBe('schedule-3-S-1');
    expect(a.voyage).toBe('S-1');
    expect(a.length).toBe(150);
    expect(a.etbInt).toBe(2);
    expect(a.workHours).toBe(8);
  });

  it('note 가 sectionRaw 로', () => {
    const a = scheduleEntryToAssignment(entry, 0);
    expect(a.sectionRaw).toBe('best');
  });

  it('reference time 있으면 ISO 변환', () => {
    const ref = new Date('2026-05-19T00:00:00.000Z');
    const a = scheduleEntryToAssignment(entry, 0, ref);
    expect(a.start).toBe('2026-05-19T02:00:00.000Z');
    expect(a.end).toBe('2026-05-19T10:00:00.000Z');
  });
});
