import { describe, expect, it } from 'vitest';

import type { CrawlerRawRow } from '@/shared/api/crawler.api';

import { convertCrawledRow, convertCrawledRows } from './liveConverter';

function row(over: Partial<CrawlerRawRow> = {}): CrawlerRawRow {
  return {
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
    ...over,
  };
}

describe('convertCrawledRow', () => {
  it('정상 행 → 풍부 Assignment', () => {
    const a = convertCrawledRow(row({}), 0);
    expect(a).not.toBeNull();
    expect(a?.voyage).toBe('JKAH-6');
    expect(a?.vessel).toBe('KAI HANG 5');
    expect(a?.terminal).toBe('SND');
    expect(a?.berth).toBe(1);
    expect(a?.route).toBe('NCK');
    expect(a?.f).toBe(18);
    expect(a?.e).toBe(167);
    expect(a?.length).toBe(149);
    expect(a?.yanghaVan).toBe(30);
    expect(a?.seonjeokVan).toBe(300);
    // 시간은 ISO 변환됨.
    expect(a?.start).toMatch(/^2026-05-19T/);
    expect(a?.end).toMatch(/^2026-05-19T/);
  });

  it('구분 감만 → GAM', () => {
    const a = convertCrawledRow(row({ 구분: '감만', 선석: '7' }), 0);
    expect(a?.terminal).toBe('GAM');
    expect(a?.berth).toBe(7);
  });

  it('구분 누락 + berth 로 terminal 역추론 (SND berth 3 → SND)', () => {
    const a = convertCrawledRow(row({ 구분: '', 선석: '3' }), 0);
    expect(a?.terminal).toBe('SND');
  });

  it('voyage 누락 → null (스킵 대상)', () => {
    expect(convertCrawledRow(row({ 모선항차: '' }), 0)).toBeNull();
  });

  it('두 시간 컬럼 모두 잘못 → start/end null 이지만 행 자체는 통과', () => {
    const a = convertCrawledRow(
      row({ 입항일시: 'invalid', '입항 예정일시': '', 작업완료일시: '', 출항일시: 'X' }),
      0,
    );
    expect(a).not.toBeNull();
    expect(a?.start).toBeNull();
    expect(a?.end).toBeNull();
  });

  it('rowId 형식이 "live-{idx}-{voyage}"', () => {
    const a = convertCrawledRow(row({ 모선항차: 'JHHZ-8' }), 5);
    expect(a?.rowId).toBe('live-5-JHHZ-8');
  });

  it('숫자형 컬럼이 string 인 경우도 파싱 (양하 등)', () => {
    const a = convertCrawledRow(row({ 양하: '1,200', 선적: '450' }), 0);
    expect(a?.yanghaVan).toBe(1200);
    expect(a?.seonjeokVan).toBe(450);
  });
});

describe('convertCrawledRows', () => {
  it('정상 + 누락 섞이면 dropped 카운트', () => {
    const rows = [
      row({}),
      row({ 모선항차: '' }), // dropped
      row({ 모선항차: 'JHHZ-8' }),
    ];
    const { assignments, dropped } = convertCrawledRows(rows);
    expect(assignments).toHaveLength(2);
    expect(dropped).toBe(1);
  });
});
