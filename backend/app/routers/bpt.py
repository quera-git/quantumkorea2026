"""BPT(Berth Productivity Table) 데이터 라우터.

업로드/조회/삭제 엔드포인트. SQLite(BPTRecordRow 테이블)에 영속화한다.
"""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import BPTRecordRow
from shared.schema import BPTRecord

logger = logging.getLogger(__name__)
router = APIRouter()


def _row_to_schema(row: BPTRecordRow) -> BPTRecord:
    return BPTRecord(
        vessel_id=row.vessel_id,
        length=row.length,
        eta_int=row.eta_int,
        etb_int=row.etb_int,
        etd_int=row.etd_int,
        berth_position=row.berth_position,
        yangha_van=row.yangha_van,
        seonjeok_van=row.seonjeok_van,
    )


@router.post("/", status_code=status.HTTP_201_CREATED)
async def upload_bpt(
    records: list[BPTRecord],
    session: AsyncSession = Depends(get_session),
) -> dict[str, int]:
    """BPT 레코드 일괄 업로드 (기존 데이터에 append)."""
    try:
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
        logger.info("BPT 레코드 %d건 저장", len(rows))
        return {"saved": len(rows)}
    except Exception as exc:
        await session.rollback()
        logger.exception("BPT 업로드 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPT 저장 중 오류: {exc}",
        )


@router.get("/")
async def list_bpt(
    session: AsyncSession = Depends(get_session),
) -> list[BPTRecord]:
    """저장된 BPT 레코드 전체 조회 (uploaded_at 오름차순)."""
    try:
        result = await session.execute(
            select(BPTRecordRow).order_by(BPTRecordRow.uploaded_at, BPTRecordRow.id)
        )
        rows = result.scalars().all()
        return [_row_to_schema(r) for r in rows]
    except Exception as exc:
        logger.exception("BPT 조회 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPT 조회 중 오류: {exc}",
        )


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_bpt(
    session: AsyncSession = Depends(get_session),
) -> None:
    """BPT 데이터 전체 삭제 (테스트/리셋용)."""
    try:
        await session.execute(delete(BPTRecordRow))
        await session.commit()
        logger.info("BPT 레코드 전체 삭제")
    except Exception as exc:
        await session.rollback()
        logger.exception("BPT 삭제 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPT 삭제 중 오류: {exc}",
        )
