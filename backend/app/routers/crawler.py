"""부산항 BPT 크롤러 라우터.

크롤러 호출은 services.crawler.pipeline 을 단일 진입점으로 사용한다.
외부 사이트(BPTC, VesselFinder)는 동기 requests 기반이라 asyncio.to_thread
로 분리 실행해 이벤트 루프를 차단하지 않는다.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import BPTRecordRow
from app.services.crawler.mapper import crawled_df_to_bpt_records
from app.services.crawler.pipeline import collect_berth_info

logger = logging.getLogger(__name__)
router = APIRouter()


# BPTC form 의 v_time 라디오 값
TimePreset = Literal["3days", "week", "month", "term"]


def _validate_term_dates(
    time: TimePreset, start_date: date | None, end_date: date | None
) -> None:
    """time='term' 일 때 start/end 가 필수임을 검사. 사이트 호출 전 단계."""
    if time == "term":
        if start_date is None or end_date is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="time='term' 시 start_date 와 end_date 가 필요합니다 (YYYY-MM-DD).",
            )
        if start_date > end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"start_date({start_date}) 가 end_date({end_date}) 보다 늦습니다.",
            )


@router.get("/preview")
async def preview_crawl(
    time: TimePreset = "3days",
    route: str = "ALL",
    berth: str = "A",
    start_date: date | None = None,
    end_date: date | None = None,
    skip_vsfinder: bool = True,
    limit: int = 20,
) -> dict[str, Any]:
    """크롤링 결과를 DB 저장 없이 JSON 으로 반환 (디버그/미리보기용).

    Args:
        time: 조회기간 — "3days"(4일) / "week" / "month" / "term"(직접입력).
        route: 항로구분 (ALL)
        berth: 선석구분 — A(전체) / S(신선대) / G(감만)
        start_date / end_date: time="term" 일 때 직접입력 시작/종료일 (YYYY-MM-DD).
        skip_vsfinder: True 면 VesselFinder 호출 생략. 빠른 응답용.
        limit: 응답에 포함할 최대 행 수.
    """
    _validate_term_dates(time, start_date, end_date)
    try:
        df = await asyncio.to_thread(
            collect_berth_info,
            time=time,
            route=route,
            berth=berth,
            skip_vsfinder=skip_vsfinder,
            start_date=start_date,
            end_date=end_date,
        )
        return {
            "count": int(len(df)),
            "columns": list(df.columns),
            "rows": df.head(limit).fillna("").to_dict(orient="records"),
            "params": {
                "time": time, "route": route, "berth": berth,
                "skip_vsfinder": skip_vsfinder,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("크롤링 preview 실패")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"크롤링 실패: {type(exc).__name__}",
        )


@router.post("/refresh")
async def refresh_bpt(
    time: TimePreset = "3days",
    route: str = "ALL",
    berth: str = "A",
    start_date: date | None = None,
    end_date: date | None = None,
    reference_time: str | None = None,
    replace: bool = True,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """크롤링 → BPTRecord 변환 → BPTRecordRow 테이블 저장.

    Args:
        time: 조회기간 — "3days"(4일) / "week" / "month" / "term"(직접입력).
        route/berth: BPTC 사이트 조회 파라미터.
        start_date / end_date: time="term" 일 때 직접입력 시작/종료일 (YYYY-MM-DD).
        reference_time: ETA_int=0 으로 잡을 기준 시각(ISO8601). 생략 시 가장 빠른 ETA 자동.
        replace: True 면 기존 BPT 데이터 전체 삭제 후 저장. False 면 append.
    """
    _validate_term_dates(time, start_date, end_date)
    try:
        df = await asyncio.to_thread(
            collect_berth_info,
            time=time, route=route, berth=berth, skip_vsfinder=False,
            start_date=start_date, end_date=end_date,
        )

        ref_dt: datetime | None = None
        if reference_time:
            try:
                ref_dt = datetime.fromisoformat(reference_time)
            except ValueError:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"reference_time ISO8601 파싱 실패: {reference_time}",
                )

        records, stats = crawled_df_to_bpt_records(df, reference_time=ref_dt)

        # DB 반영
        if replace:
            await session.execute(delete(BPTRecordRow))

        rows = [
            BPTRecordRow(
                vessel_id=r.vessel_id,
                length=r.length,
                eta_int=r.eta_int,
                etb_int=r.etb_int,
                etd_int=r.etd_int,
                berth_position=r.berth_position,
                yangha_van=r.yangha_van,
                seonjeok_van=r.seonjeok_van,
                plan_status=r.plan_status,
            )
            for r in records
        ]
        session.add_all(rows)
        await session.commit()

        logger.info(
            "BPT refresh 완료: 크롤 %d, 저장 %d (replace=%s)",
            stats["input"], stats["ok"], replace,
        )
        return {
            "crawled": stats["input"],
            "saved": stats["ok"],
            "skipped": stats["skipped"],
            "skipped_breakdown": {
                "date_parse_failed": stats.get("skipped_date", 0),
                "length_missing": stats.get("skipped_length", 0),
                "bp_missing": stats.get("skipped_bp", 0),
            },
            "etb_filled_from_eta": stats.get("etb_filled_from_eta", 0),
            "replace": replace,
            "reference_time": ref_dt.isoformat() if ref_dt else None,
        }
    except HTTPException:
        raise
    except Exception as exc:
        await session.rollback()
        logger.exception("BPT refresh 실패")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"크롤링 또는 저장 실패: {type(exc).__name__}",
        )
