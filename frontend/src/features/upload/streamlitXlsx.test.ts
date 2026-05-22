import { describe, expect, it } from 'vitest';

import {
  detectXlsxFormat,
  excelSerialToDate,
  streamlitRowToBptRaw,
} from './streamlitXlsx';

describe('detectXlsxFormat', () => {
  it('BPTC raw 마커 발견 → bpt-raw', () => {
    const r = detectXlsxFormat(['구분', '선석', '모선항차', '입항일시', '작업완료일시']);
    expect(r.format).toBe('bpt-raw');
    expect(r.reason).toContain('입항일시');
  });

  it('Streamlit 마커 발견 → streamlit-xlsx', () => {
    const r = detectXlsxFormat(['모선항차', '구분', '선석', 'ETB', 'ETD', '접안위치(F)']);
    expect(r.format).toBe('streamlit-xlsx');
    expect(r.reason).toContain('ETB');
  });

  it('두 형식 마커 동시 발견 → unknown (cross-confusion 차단)', () => {
    const r = detectXlsxFormat(['입항일시', 'ETB']);
    expect(r.format).toBe('unknown');
    expect(r.reason).toContain('두 형식 마커');
    expect(r.observedHeaders).toEqual(['입항일시', 'ETB']);
  });

  it('둘 다 없음 → unknown', () => {
    const r = detectXlsxFormat(['foo', 'bar', '모선항차']);
    expect(r.format).toBe('unknown');
    expect(r.reason).toContain('마커도 발견되지 않음');
  });

  it('접안위치(F) 단독 → streamlit-xlsx (ETB 없어도 OK)', () => {
    const r = detectXlsxFormat(['모선항차', '접안위치(F)']);
    expect(r.format).toBe('streamlit-xlsx');
  });
});

describe('excelSerialToDate', () => {
  it('정수 serial → LOCAL midnight (00:00)', () => {
    const d = excelSerialToDate(46098);
    expect(d.getMinutes()).toBe(0);
    expect(d.getHours()).toBe(0);
    expect(d.getFullYear()).toBe(2026);
  });

  it('serial + 1/24 = +1시간 (LOCAL hour 01:00)', () => {
    const d = excelSerialToDate(46098 + 1 / 24);
    expect(d.getMinutes()).toBe(0);
    expect(d.getHours()).toBe(1);
  });

  it('serial + 0.5 = LOCAL noon (12:00)', () => {
    const d = excelSerialToDate(46098 + 0.5);
    expect(d.getHours()).toBe(12);
    expect(d.getMinutes()).toBe(0);
  });
});

describe('streamlitRowToBptRaw', () => {
  it('전형적인 Streamlit row → CrawlerRawRow 형태', () => {
    const row = {
      모선항차: 'JKAH-6',
      구분: '신선대',
      선석: 1,
      선박명: 'KAI HANG 5',
      선사: 'DYS',
      ETB: 46098.04166666666,
      ETD: 46098.66666666666,
      ETA: 46098.04166666666,
      '접안위치(F)': 18,
      '접안위치(E)': 167.8,
      '양하(Van)': 0,
      '선적(Van)': 300,
      'Shifting\n(Van)': 0,
      항로: 'NCK',
      // 잔재 컬럼 — 무시되어야 함
      'Unnamed: 22': '',
      '안벽크레인 1': '동작범위',
      ETB_int: 97,
    };
    const out = streamlitRowToBptRaw(row);
    expect(out.구분).toBe('신선대');
    expect(out.선석).toBe('1');
    expect(out.모선항차).toBe('JKAH-6');
    expect(out.f).toBe(18);
    expect(out.e).toBe(167.8);
    expect(out.bp).toBeCloseTo((18 + 167.8) / 2, 3);
    expect(out.항로).toBe('NCK');
    expect(out.양하).toBe(0);
    expect(out.선적).toBe(300);
    expect(out['S/H']).toBe(0);
    expect(out.plan_cd).toBeNull();
    // 시간은 "YYYY/MM/DD HH:mm" 한글 라벨 (liveConverter 가 파싱 가능한 형식)
    expect(out.입항일시).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
    expect(out.작업완료일시).toMatch(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  });

  it('ETB 빈값 → 입항일시 빈 문자열', () => {
    const out = streamlitRowToBptRaw({
      모선항차: 'X',
      구분: '신선대',
      선석: 2,
      ETB: '',
      ETD: '',
      '접안위치(F)': 320,
      '접안위치(E)': 460,
    });
    expect(out.입항일시).toBe('');
    expect(out.작업완료일시).toBe('');
    // f/e 는 그대로 보존
    expect(out.f).toBe(320);
    expect(out.e).toBe(460);
  });

  it('f/e 모두 null → bp 도 null', () => {
    const out = streamlitRowToBptRaw({ 모선항차: 'X', 구분: '신선대', 선석: 3 });
    expect(out.f).toBeNull();
    expect(out.e).toBeNull();
    expect(out.bp).toBeNull();
  });
});
