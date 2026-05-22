import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';

import {
  UploadParseError,
  detectFormat,
  fileNameToScenarioLabel,
  generateScenarioId,
  parseJsonInput,
  parseXlsxInput,
  rawRowsToScenarioPayload,
  summarizePayload,
} from './parsers';

describe('detectFormat', () => {
  it('배열 → raw-rows', () => {
    expect(detectFormat([])).toBe('raw-rows');
    expect(detectFormat([{ 모선항차: 'A' }])).toBe('raw-rows');
  });

  it('{rows: [...]} 객체 → scenario-payload', () => {
    expect(detectFormat({ scenarioId: 'x', rows: [] })).toBe('scenario-payload');
    expect(detectFormat({ label: 'y', rows: [{}] })).toBe('scenario-payload');
  });

  it('인식 안 되는 형식 → throw', () => {
    expect(() => detectFormat(null)).toThrow(UploadParseError);
    expect(() => detectFormat('hello')).toThrow(UploadParseError);
    expect(() => detectFormat({ foo: 'bar' })).toThrow(UploadParseError);
  });
});

describe('parseJsonInput — scenario-payload', () => {
  const meta = { id: 'upload-test', label: '테스트', sourceFile: 'test.json' };

  it('유효한 ScenarioPayload JSON → 그대로 (id/label override)', () => {
    const json = JSON.stringify({
      scenarioId: 'original-id',
      label: 'original-label',
      sourceFile: 'orig.xlsx',
      rowCount: 1,
      rows: [
        {
          rowId: 'r-0',
          voyage: 'A',
          terminal: 'SND',
          berth: 1,
          start: '2026-05-19T00:00:00',
          end: '2026-05-19T08:00:00',
          eta: null,
          f: 0,
          e: 200,
          length: 200,
        },
      ],
    });
    const { payload, format } = parseJsonInput(json, meta);
    expect(format).toBe('scenario-payload');
    expect(payload.scenarioId).toBe('upload-test');
    expect(payload.label).toBe('테스트');
    expect(payload.sourceFile).toBe('test.json');
    expect(payload.rowCount).toBe(1);
    expect(payload.rows[0]?.voyage).toBe('A');
  });

  it('JSON parse 실패 → UploadParseError', () => {
    expect(() => parseJsonInput('{not json}', meta)).toThrow(UploadParseError);
  });

  it('rows 누락 (객체지만 rows 없음) → detectFormat 에서 throw', () => {
    expect(() => parseJsonInput('{"scenarioId":"x"}', meta)).toThrow(/형식을 인식/);
  });
});

describe('parseJsonInput — raw-rows', () => {
  const meta = { id: 'upload-raw', label: 'raw 테스트', sourceFile: 'raw.json' };

  it('CrawlerRawRow 배열 → ScenarioPayload (liveConverter 통과)', () => {
    const json = JSON.stringify([
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'JKAH-6',
        선박명: 'KAI HANG 5',
        선사: 'DYS',
        '입항 예정일시': '2026/05/19 12:00',
        입항일시: '2026/05/19 12:00',
        작업완료일시: '2026/05/19 18:00',
        출항일시: '2026/05/19 18:00',
        양하: '30',
        선적: '300',
        'S/H': '0',
        항로: 'NCK',
        bp: 100,
        f: 18,
        e: 167,
      },
    ]);
    const { payload, droppedCount, format } = parseJsonInput(json, meta);
    expect(format).toBe('raw-rows');
    expect(droppedCount).toBe(0);
    expect(payload.rows).toHaveLength(1);
    expect(payload.rows[0]?.voyage).toBe('JKAH-6');
    expect(payload.rows[0]?.terminal).toBe('SND');
  });

  it('모선항차 누락 행은 dropped 처리', () => {
    const json = JSON.stringify([
      { 모선항차: 'A', 구분: '신선대', 선석: '1', f: 0, e: 100 },
      { 모선항차: '', 구분: '신선대', 선석: '2', f: 0, e: 100 },
      { 모선항차: 'B', 구분: '감만', 선석: '7', f: 0, e: 100 },
    ]);
    const { payload, droppedCount } = parseJsonInput(json, meta);
    expect(payload.rows).toHaveLength(2);
    expect(droppedCount).toBe(1);
  });

  it('전부 dropped → 변환 결과 0 → throw', () => {
    const json = JSON.stringify([{ 모선항차: '' }, { 모선항차: '' }]);
    expect(() => parseJsonInput(json, meta)).toThrow(/0행/);
  });
});

describe('rawRowsToScenarioPayload', () => {
  it('직접 호출 시 meta 가 payload 에 반영', () => {
    const { payload } = rawRowsToScenarioPayload(
      [
        {
          모선항차: 'X',
          구분: '신선대',
          선석: '3',
          입항일시: '2026/05/19 00:00',
          작업완료일시: '2026/05/19 06:00',
          f: 0,
          e: 100,
        },
      ],
      { id: 'foo', label: 'bar', sourceFile: 'baz.json' },
    );
    expect(payload.scenarioId).toBe('foo');
    expect(payload.label).toBe('bar');
    expect(payload.sourceFile).toBe('baz.json');
    expect(payload.rowCount).toBe(1);
  });
});

describe('summarizePayload', () => {
  it('SND/GAM/unknown 카운트', () => {
    const stats = summarizePayload([
      // @ts-expect-error -- 테스트용 부분 객체
      { terminal: 'SND' },
      // @ts-expect-error
      { terminal: 'SND' },
      // @ts-expect-error
      { terminal: 'GAM' },
      // @ts-expect-error
      { terminal: '' },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.snd).toBe(2);
    expect(stats.gam).toBe(1);
    expect(stats.unknown).toBe(1);
  });
});

describe('fileNameToScenarioLabel', () => {
  it('확장자 제거', () => {
    expect(fileNameToScenarioLabel('foo.xlsx')).toBe('foo');
    expect(fileNameToScenarioLabel('bar.json')).toBe('bar');
    expect(fileNameToScenarioLabel('baz.something.xlsx')).toBe('baz.something');
  });

  it('빈 이름 → untitled', () => {
    expect(fileNameToScenarioLabel('.json')).toBe('untitled');
  });
});

describe('generateScenarioId', () => {
  it('upload-{slug}-{stamp} 형식 + 한글 보존', () => {
    const id = generateScenarioId('테스트 시나리오 0313');
    expect(id).toMatch(/^upload-테스트-시나리오-0313-[a-z0-9]+$/);
  });

  it('빈 슬러그 → upload-{stamp}', () => {
    const id = generateScenarioId('!!!');
    expect(id).toMatch(/^upload-[a-z0-9]+$/);
  });
});

/** 테스트용 xlsx buffer 생성 — vitest 가 node/jsdom 어디서 돌든 ArrayBuffer 반환. */
function buildXlsx(
  rows: Array<Record<string, unknown>>,
  opts: { header?: string[]; sheetName?: string } = {},
): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows, opts.header ? { header: opts.header } : {});
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName ?? '선석배정');
  // XLSX.write 의 반환 타입은 env 마다 미묘하게 다름 (Uint8Array / Buffer / number[]) —
  // new Uint8Array() 로 한 번 더 wrapping 해서 통일.
  const raw = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayLike<number>;
  return new Uint8Array(raw).buffer;
}

const META = { id: 'upload-test', label: 'test', sourceFile: 'test.xlsx' };

describe('parseXlsxInput — happy path', () => {
  it('한글 헤더 + 정상행 → ScenarioPayload + planStatus 매핑', async () => {
    const rows = [
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'JKAH-6',
        선박명: 'KAI HANG 5',
        선사: 'DYS',
        '입항 예정일시': '2026/05/22 01:00',
        입항일시: '2026/05/22 01:00',
        작업완료일시: '2026/05/22 07:00',
        출항일시: '2026/05/22 07:00',
        양하: 0,
        선적: 300,
        'S/H': 0,
        항로: 'NCK',
        bp: 92.9,
        f: 18,
        e: 167.8,
        plan_cd: 'L',
      },
      {
        구분: '감만',
        선석: '7',
        모선항차: 'GAM-1',
        선박명: 'GAM VESSEL',
        선사: 'HMM',
        '입항 예정일시': '2026/05/22 02:00',
        입항일시: '2026/05/22 02:00',
        작업완료일시: '2026/05/22 09:00',
        출항일시: '2026/05/22 09:00',
        양하: 100,
        선적: 200,
        'S/H': 0,
        항로: 'KRX',
        bp: 470,
        f: 380,
        e: 560,
        plan_cd: 'D',
      },
    ];
    const buf = buildXlsx(rows);
    const { payload, droppedCount } = await parseXlsxInput(buf, META);

    expect(droppedCount).toBe(0);
    expect(payload.rows).toHaveLength(2);
    expect(payload.scenarioId).toBe(META.id);
    expect(payload.label).toBe(META.label);
    expect(payload.sourceFile).toBe(META.sourceFile);
    expect(payload.rowCount).toBe(2);

    const [snd, gam] = payload.rows;
    expect(snd?.terminal).toBe('SND');
    expect(snd?.berth).toBe(1);
    expect(snd?.voyage).toBe('JKAH-6');
    expect(snd?.planStatus).toBe('loading_planned');
    // TZ 비의존 검증: parseKrDate 가 local 시각으로 만든 후 ISO 화 → 같은 epoch 비교.
    expect(Date.parse(snd!.start!)).toBe(new Date(2026, 4, 22, 1, 0).getTime());
    expect(Date.parse(snd!.end!)).toBe(new Date(2026, 4, 22, 7, 0).getTime());

    expect(gam?.terminal).toBe('GAM');
    expect(gam?.berth).toBe(7);
    expect(gam?.planStatus).toBe('discharge_planned');
  });

  it('string 셀 "YYYY/MM/DD HH:mm" → parseKrDate 통과', async () => {
    // BPTC raw 형식은 시간을 string cell 로 저장 (live API 응답 모방). cellDates 무관.
    const buf = buildXlsx([
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'D-TEST',
        선박명: 'TS',
        선사: 'DYS',
        '입항 예정일시': '2026/05/22 03:30',
        입항일시: '2026/05/22 03:30',
        작업완료일시: '2026/05/22 08:00',
        출항일시: '2026/05/22 08:00',
        양하: 0,
        선적: 100,
        'S/H': 0,
        항로: 'NCK',
        bp: 100,
        f: 18,
        e: 168,
        plan_cd: 'C',
      },
    ]);

    const { payload } = await parseXlsxInput(buf, META);
    expect(payload.rows).toHaveLength(1);
    expect(Date.parse(payload.rows[0]!.start!)).toBe(new Date(2026, 4, 22, 3, 30).getTime());
    expect(Date.parse(payload.rows[0]!.end!)).toBe(new Date(2026, 4, 22, 8, 0).getTime());
    expect(payload.rows[0]?.planStatus).toBe('crane_assigned');
  });

  it('일부 행 모선항차 빈값 → droppedCount 통계', async () => {
    const buf = buildXlsx([
      {
        구분: '신선대', 선석: '1', 모선항차: 'A-1', 선박명: 'V1', 선사: 'DYS',
        '입항 예정일시': '2026/05/22 01:00', 입항일시: '2026/05/22 01:00',
        작업완료일시: '2026/05/22 07:00', 출항일시: '2026/05/22 07:00',
        양하: 0, 선적: 100, 'S/H': 0, 항로: 'NCK', bp: 100, f: 18, e: 168,
      },
      { 구분: '신선대', 선석: '1', 모선항차: '', f: 0, e: 0 }, // dropped
      {
        구분: '신선대', 선석: '2', 모선항차: 'A-2', 선박명: 'V2', 선사: 'DYS',
        '입항 예정일시': '2026/05/22 02:00', 입항일시: '2026/05/22 02:00',
        작업완료일시: '2026/05/22 08:00', 출항일시: '2026/05/22 08:00',
        양하: 0, 선적: 200, 'S/H': 0, 항로: 'KRX', bp: 400, f: 320, e: 540,
      },
    ]);
    const { payload, droppedCount } = await parseXlsxInput(buf, META);
    expect(payload.rows).toHaveLength(2);
    expect(droppedCount).toBe(1);
  });
});

describe('parseXlsxInput — 에러 경로', () => {
  // 빈 워크북(시트 0개) 분기는 XLSX.write 자체가 "Workbook is empty" 로 거부해 fixture
  // 구성이 까다로움 — 그래서 parseXlsxInput 의 _다른_ 에러 경로(0행 throw, 손상 buffer)로
  // 검증 커버리지를 확보한다.

  it('BPTC/Streamlit 마커가 모두 없는 헤더 → 형식 미감지 throw', async () => {
    const buf = buildXlsx([
      { 구분: '신선대', 선석: '1', 선박명: 'V', f: 18, e: 168 },
      { 구분: '신선대', 선석: '2', 선박명: 'W', f: 320, e: 500 },
    ]);
    await expect(parseXlsxInput(buf, META)).rejects.toBeInstanceOf(UploadParseError);
    await expect(parseXlsxInput(buf, META)).rejects.toThrow(/헤더를 인식할 수 없습니다/);
  });

  it('헤더에 BPT + Streamlit 마커 동시 발견 → 충돌 throw', async () => {
    const buf = buildXlsx([
      {
        구분: '신선대',
        선석: '1',
        모선항차: 'X',
        입항일시: '2026/05/22 01:00',
        작업완료일시: '2026/05/22 07:00',
        ETB: 46098,
        f: 18,
        e: 168,
      },
    ]);
    await expect(parseXlsxInput(buf, META)).rejects.toThrow(/두 형식 마커/);
  });

  it('Streamlit 원본 헤더 → 정상 ScenarioPayload + xlsxFormat="streamlit-xlsx"', async () => {
    const buf = buildXlsx([
      {
        모선항차: 'S-1',
        구분: '신선대',
        선석: 1,
        선박명: 'SV1',
        선사: 'DYS',
        ETB: 46098.04166666666,
        ETD: 46098.66666666666,
        ETA: 46098.04166666666,
        '접안위치(F)': 18,
        '접안위치(E)': 168,
        '양하(Van)': 0,
        '선적(Van)': 300,
        'Shifting(Van)': 0,
        항로: 'NCK',
      },
    ]);
    const result = await parseXlsxInput(buf, META);
    expect(result.xlsxFormat).toBe('streamlit-xlsx');
    expect(result.payload.rows).toHaveLength(1);
    const r = result.payload.rows[0];
    expect(r?.terminal).toBe('SND');
    expect(r?.berth).toBe(1);
    expect(r?.voyage).toBe('S-1');
    expect(r?.f).toBe(18);
    expect(r?.e).toBe(168);
    expect(r?.start).toMatch(/^2026/);
  });

  it('손상된 buffer → 엑셀 파싱 실패', async () => {
    const buf = new ArrayBuffer(16); // 의미 없는 zeros — xlsx 가 못 읽음
    await expect(parseXlsxInput(buf, META)).rejects.toBeInstanceOf(UploadParseError);
  });
});
