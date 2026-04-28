"""결과 조회 라우터."""
import logging

from fastapi import APIRouter, HTTPException, status

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{job_id}")
def get_result(job_id: str) -> dict:
    """job_id로 결과 조회.

    TODO: SQLite jobs 테이블에서 조회하도록 교체.
    """
    try:
        logger.info("결과 조회: %s", job_id)
        # 임시 응답 — 다음 PR에서 DB 연동
        return {"job_id": job_id, "status": "pending"}
    except Exception as exc:
        logger.exception("결과 조회 실패: %s", job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"결과 조회 중 오류: {exc}",
        )
