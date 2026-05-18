"""부산항 BPT 크롤러 라우터.

크롤러 호출은 services.crawler.pipeline 을 단일 진입점으로 사용한다.
외부 사이트(BPTC, VesselFinder)는 동기 requests 기반이라 asyncio.to_thread
로 분리 실행해 이벤트 루프를 차단하지 않는다.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import BPTRecordRow
from app.services.crawler.mapper import crawled_df_to_bpt_records
from app.services.crawler.pipeline import collect_berth_info

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/preview")
async def preview_crawl(
    time: str = "3days",
    route: str = "ALL",
    berth: str = "A",
    skip_vsfinder: bool = True,
    limit: int = 20,
) -> dict[str, Any]:
    """크롤링 결과를 DB 저장 없이 JSON 으로 반환 (디버그/미리보기용).

    Args:
        time: 조회 기간 (3days 등)
        route: 항로구분 (ALL)
        berth: 터미널 — 신선대(A) / 감만(B)
        skip_vsfinder: True 면 VesselFinder 호출 생략. 빠른 응답용.
        limit: 응답에 포함할 최대 행 수.
    """
    try:
        df = await asyncio.to_thread(
            collect_berth_info,
            time=time,
            route=route,
            berth=berth,
            skip_vsfinder=skip_vsfinder,
        )
        return {
            "count": int(len(df)),
            "columns": list(df.columns),
            "rows": df.head(limit).fillna("").to_dict(orient="records"),
            "params": {
                "time": time, "route": route, "berth": berth,
                "skip_vsfinder": skip_vsfinder,
            },
        }
    except Exception as exc:
        logger.exception("크롤링 preview 실패")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"크롤링 실패: {type(exc).__name__}",
        )


@router.post("/refresh")
async def refresh_bpt(
    time: str = "3days",
    route: str = "ALL",
    berth: str = "A",
    reference_time: str | None = None,
    replace: bool = True,
    session: AsyncSession = Depends(get_session),
) -> dict[str, Any]:
    """크롤링 → BPTRecord 변환 → BPTRecordRow 테이블 저장.

    Args:
        time/route/berth: BPTC 사이트 조회 파라미터
        reference_time: ETA_int=0 으로 잡을 기준 시각(ISO8601). 생략 시 가장 빠른 ETA 자동.
        replace: True 면 기존 BPT 데이터 전체 삭제 후 저장. False 면 append.
    """
    try:
        df = await asyncio.to_thread(
            collect_berth_info,
            time=time, route=route, berth=berth, skip_vsfinder=False,
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
