"""부산항 BPT 크롤링 파이프라인.

원본: /Users/hjkim/KimHaejoong/008.부산항/crawling/main.py
변경점: print → logging, Excel 저장/CLI 제거, DataFrame 반환만.
"""
from __future__ import annotations

import logging
from datetime import date

import pandas as pd

from app.services.crawler.bpt import add_bp_to_dataframe, get_berth_status
from app.services.crawler.vsfinder import enrich_with_length_beam

logger = logging.getLogger(__name__)


def collect_berth_info(
    time: str = "3days",
    route: str = "ALL",
    berth: str = "A",
    skip_vsfinder: bool = False,
    start_date: date | None = None,
    end_date: date | None = None,
) -> pd.DataFrame:
    """신선대감만터미널 선석배정 + 선박 크기 + BP 정보를 통합 수집.

    Args:
        time: 조회기간 — "3days" / "week" / "month" / "term".
        route: 항로구분 (기본 "ALL")
        berth: 선석구분 — A(전체) / S(신선대) / G(감만)
        skip_vsfinder: True 면 VesselFinder 호출 생략. 빠른 테스트용.
        start_date / end_date: time="term" 일 때 사용할 직접입력 시작/종료일.

    Returns:
        DataFrame. 실패 또는 빈 응답 시 빈 DataFrame.
    """
    logger.info(
        "부산항 BPT 크롤링 시작: time=%s berth=%s%s",
        time, berth,
        f" range={start_date}~{end_date}" if time == "term" else "",
    )

    df = get_berth_status(
        time=time, route=route, berth=berth,
        start_date=start_date, end_date=end_date,
    )
    if df.empty:
        logger.warning("선석배정 조회 결과 없음")
        return df

    if not skip_vsfinder:
        df = enrich_with_length_beam(df, ship_name_column="선박명")

    df = add_bp_to_dataframe(df)

    logger.info("부산항 BPT 크롤링 완료: %d건", len(df))
    return df
