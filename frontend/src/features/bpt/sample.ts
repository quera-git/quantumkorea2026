import type { BPTRecord } from '@/shared/types/schema';

// 데모용 샘플 BPT — 노트북 freeze 윈도우(12시간) 내 3척.
// 빠른 라운드트립 검증/시연 용도이며 실 데이터가 아니다.
export const DEMO_BPT_RECORDS: BPTRecord[] = [
  {
    vessel_id: 'D-1',
    length: 140,
    eta_int: 0,
    etb_int: 0,
    etd_int: 8,
    berth_position: 100,
    yangha_van: 30,
    seonjeok_van: 30,
  },
  {
    vessel_id: 'D-2',
    length: 160,
    eta_int: 1,
    etb_int: 1,
    etd_int: 10,
    berth_position: 300,
    yangha_van: 40,
    seonjeok_van: 40,
  },
  {
    vessel_id: 'D-3',
    length: 180,
    eta_int: 3,
    etb_int: 3,
    etd_int: 11,
    berth_position: 600,
    yangha_van: 50,
    seonjeok_van: 50,
  },
];
