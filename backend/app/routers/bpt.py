"""BPT(Berth Productivity Table) 데이터 라우터.

업로드/조회 엔드포인트. 추후 SQLite 영속화로 교체 예정.
"""
import logging

from fastapi import APIRouter, HTTPException, status

from shared.schema import BPTRecord

logger = logging.getLogger(__name__)
router = APIRouter()

# 임시 in-memory 저장소 (다음 PR에서 SQLite로 교체)
_storage: list[BPTRecord] = []


@router.post("/", status_code=status.HTTP_201_CREATED)
def upload_bpt(records: list[BPTRecord]) -> dict[str, int]:
    """BPT 레코드 일괄 업로드."""
    try:
        _storage.extend(records)
        logger.info("BPT 레코드 %d건 저장", len(records))
        return {"saved": len(records)}
    except Exception as exc:
        logger.exception("BPT 업로드 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPT 저장 중 오류: {exc}",
        )


@router.get("/")
def list_bpt() -> list[BPTRecord]:
    """저장된 BPT 레코드 전체 조회."""
    try:
        return list(_storage)
    except Exception as exc:
        logger.exception("BPT 조회 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"BPT 조회 중 오류: {exc}",
        )
