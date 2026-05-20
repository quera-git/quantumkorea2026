"""크롤러 DataFrame → BPTRecord 매핑.

BPTC 사이트가 반환하는 한글 컬럼과 VesselFinder 결과를 우리 schema 의
영문 필드로 변환한다. ETA/ETB/ETD 는 "YYYY/MM/DD HH:MM" 문자열에서
reference_time 기준 시간 오프셋(시)으로 변환된다.

ETB(입항일시) 는 실제 접안 후에만 채워지는 사이트 특성상, 미래 예정
선박은 비어 있다. 이 경우 ETB=ETA 로 대체해 솔버에게 "ETA 시점 접안
가정"으로 넘긴다 (솔버가 실제 ETB 를 결정).

length / bp / ETA / ETD 가 비어 있는 행은 스킵된다.
"""
from __future__ import annotations

import logging
from datetime import datetime

import pandas as pd

from shared.schema import BPTRecord, PlanStatus

logger = logging.getLogger(__name__)

# BPTC 선석배정 그래픽 페이지 VslMsg(...) 의 plan_cd → BPTRecord.plan_status 매핑.
# 사이트 JS 안의 한국어 라벨과 1:1 대응.
_PLAN_CD_TO_STATUS: dict[str, PlanStatus] = {
    "L": "loading_planned",      # 적하 프래닝까지 완료
    "D": "discharge_planned",    # 양하 프래닝까지 완료
    "C": "crane_assigned",       # 크래인배정 완료
}


def _to_plan_status(plan_cd: str | None) -> PlanStatus | None:
    """plan_cd 문자열 → PlanStatus enum 값.

    None 이면 BP 그래픽에 해당 선박이 없는 것 (선석배정 미게시) → None 반환.
    빈 문자열이나 알 수 없는 코드는 사이트 JS 의 else 분기와 동일하게
    crane_unassigned 로 본다.
    """
    if plan_cd is None:
        return None
    return _PLAN_CD_TO_STATUS.get(plan_cd, "crane_unassigned")

_DATE_FORMAT = "%Y/%m/%d %H:%M"
_REQUIRED_COLUMNS = {
    "모선항차", "Length(m)", "bp",
    "입항 예정일시", "입항일시", "출항일시",
}


def _parse_dt(s: str) -> datetime | None:
    """'2026/05/13 02:00' 같은 BPTC 날짜 문자열을 datetime 으로 파싱."""
    if not s or pd.isna(s):
        return None
    try:
        return datetime.strptime(str(s).strip(), _DATE_FORMAT)
    except ValueError:
        return None


def _hours_between(a: datetime, b: datetime) -> float:
    """a 기준 b 의 시간 오프셋(시)."""
    return (b - a).total_seconds() / 3600.0


def crawled_df_to_bpt_records(
    df: pd.DataFrame,
    reference_time: datetime | None = None,
) -> tuple[list[BPTRecord], dict[str, int]]:
    """크롤러 결과 DataFrame 을 BPTRecord 리스트로 변환.

    Args:
        df: collect_berth_info() 결과
        reference_time: ETA_int=0 으로 잡을 기준 시각.
                        None 이면 ETA 중 가장 빠른 값을 기준으로 한다.

    Returns:
        (records, stats)
        stats: {"input": 입력 행 수, "ok": 변환 성공, "skipped": 필수 필드 누락}
    """
    stats = {
        "input": int(len(df)),
        "ok": 0,
        "skipped": 0,
        "skipped_date": 0,
        "skipped_length": 0,
        "skipped_bp": 0,
        "etb_filled_from_eta": 0,  # ETB 비어 ETA 로 대체된 행 수 (미래 예정 선박)
    }

    if df.empty:
        return [], stats

    missing = _REQUIRED_COLUMNS - set(df.columns)
    if missing:
        logger.warning("크롤러 결과에 필수 컬럼 누락: %s", missing)
        return [], stats

    # 1차 파싱: reference_time 결정용 ETA 수집
    parsed_rows = []
    for _, row in df.iterrows():
        eta = _parse_dt(row["입항 예정일시"])
        etb = _parse_dt(row["입항일시"])
        etd = _parse_dt(row["출항일시"])
        length = row.get("Length(m)")
        bp = row.get("bp")

        # ETA/ETD 는 필수, ETB 는 미래 예정 선박에서 비어있는 게 정상
        if eta is None or etd is None:
            stats["skipped_date"] += 1
            stats["skipped"] += 1
            continue
        if etb is None:
            etb = eta
            stats["etb_filled_from_eta"] += 1
        if length is None or pd.isna(length) or float(length) <= 0:
            stats["skipped_length"] += 1
            stats["skipped"] += 1
            continue
        if bp is None or pd.isna(bp) or float(bp) <= 0:
            stats["skipped_bp"] += 1
            stats["skipped"] += 1
            continue

        parsed_rows.append({
            "vessel_id": str(row["모선항차"]),
            "length": int(round(float(length))),
            "eta": eta,
            "etb": etb,
            "etd": etd,
            "bp": float(bp),
            "yangha": pd.to_numeric(row.get("양하", 0), errors="coerce"),
            "seonjeok": pd.to_numeric(row.get("선적", 0), errors="coerce"),
            "plan_status": _to_plan_status(row.get("plan_cd")),
        })

    if not parsed_rows:
        return [], stats

    if reference_time is None:
        reference_time = min(r["eta"] for r in parsed_rows)
        logger.info("reference_time 자동 산출: %s", reference_time.isoformat())

    records: list[BPTRecord] = []
    for r in parsed_rows:
        records.append(BPTRecord(
            vessel_id=r["vessel_id"],
            length=r["length"],
            eta_int=_hours_between(reference_time, r["eta"]),
            etb_int=_hours_between(reference_time, r["etb"]),
            etd_int=_hours_between(reference_time, r["etd"]),
            berth_position=r["bp"],
            yangha_van=float(r["yangha"]) if not pd.isna(r["yangha"]) else 0.0,
            seonjeok_van=float(r["seonjeok"]) if not pd.isna(r["seonjeok"]) else 0.0,
            plan_status=r["plan_status"],
        ))

    stats["ok"] = len(records)
    return records, stats
