# dummy-data

테스트/공유용 더미 BPT 시나리오. 코드와 분리된 정적 파일이며 빌드에 포함되지 않는다.

각 시나리오는 같은 데이터를 **JSON 두 포맷 + xlsx 한 포맷** 으로 떨궈둔다.

| 시나리오 | 척수 | 터미널 | plan_status 강조 |
|---------|------|--------|------------------|
| `dummy_snd_small_10` | 10 | SND only | 골고루 |
| `dummy_gam_small_8` | 8 | GAM only | 골고루 |
| `dummy_mixed_25` | 25 | SND+GAM | 골고루 |
| `dummy_busy_60` | 60 | SND+GAM | 혼잡, 미게재 없음 |
| `dummy_crane_shortage_30` | 30 | SND+GAM | crane_unassigned 비율 ↑ |

## 컬럼 명세

### JSON (`*.json`)

`src/data/before_0313_*.json` 와 동일 구조.

```jsonc
{
  "scenarioId": "...",
  "label": "...",
  "sourceFile": "...",
  "rowCount": N,
  "rows": [
    {
      "rowId": "...",
      "voyage": "JKAH-6",
      "sectionRaw": "신선대",       // 또는 "감만"
      "berth": 1,                   // SND:1~5, GAM:6~9
      "vessel": "KAI HANG 5",
      "company": "DYS",
      "start": "2026-05-24T16:00:00",
      "end": "2026-05-25T17:00:00",
      "eta": "2026-05-24T16:00:00",
      "f": 686.0,                   // 접안위치(F)
      "e": 801.5,                   // 접안위치(E)
      "yanghaVan": 400,
      "seonjeokVan": 300,
      "shiftingVan": 0,
      "route": "JP1",
      "length": 115.5,
      "workHours": 25,
      "etbInt": 40,                 // t0 기준 hour offset
      "etdInt": 65,
      "etaInt": 40,
      "terminal": "SND",            // "SND" | "GAM"
      "planStatus": "crane_assigned"
    }
  ]
}
```

`planStatus` 값:
- `"loading_planned"` — 적하 프래닝까지 완료 (BPTC 분홍)
- `"discharge_planned"` — 양하 프래닝까지 완료 (BPTC 청록)
- `"crane_assigned"` — 크래인배정 완료 (BPTC 베이지)
- `"crane_unassigned"` — 크래인미 배정 (BPTC 회색)
- `null` — BP 그래픽 미게재

### XLSX (`*.xlsx`)

`영상/Before_Snapshot_Sinseondae_*.xlsx` 와 동일한 한글 헤더 20개:

```
모선항차 / 구분 / 선석 / 선박명 / 선사
ETB / ETD / ETA / 접안위치(F) / 접안위치(E)
양하(Van) / 선적(Van) / Shifting(Van) / 항로 / Length
작업시간(ETD-ETB) / ETB_int / ETD_int / ETA_int / (양하+선적)/20
```

xlsx 에는 `planStatus` / `terminal` 미포함 — 영상 원본 엑셀이 그 컬럼을 안 가졌기 때문. 이 두 필드가 필요하면 JSON 쪽을 사용.

## 재생성

`scripts/gen-samples.mjs` (frontend phase11) 와는 별도. 본 디렉토리는 수동 스냅샷이며, 변경이 필요하면 `/tmp/gen_dummy.py` 같은 generator 재실행으로 덮어쓴다 (결정적 — 동일 출력).
