import { describe, expect, it } from 'vitest';

import {
  UploadParseError,
  detectFormat,
  fileNameToScenarioLabel,
  generateScenarioId,
  parseJsonInput,
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
