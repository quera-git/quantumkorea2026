"""최적화 작업 제출 라우터.

worker 호출은 반드시 services.worker_client를 경유해야 한다 (AGENTS.md §4.3).
"""
import logging
import uuid

from fastapi import APIRouter, HTTPException, status

from app.services.worker_client import submit_to_worker
from shared.schema import OptimizeRequest, OptimizeResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=OptimizeResult)
async def submit_job(request: OptimizeRequest) -> OptimizeResult:
    """최적화 작업을 worker에 위임하고 결과를 동기 반환."""
    if not request.job_id:
        request.job_id = str(uuid.uuid4())

    try:
        result = await submit_to_worker(request)
        logger.info("작업 %s 완료: status=%s", request.job_id, result.status)
        return result
    except HTTPException:
        # worker_client에서 이미 의미 있는 status로 변환되어 올라옴
        raise
    except Exception as exc:
        logger.exception("작업 %s 처리 실패", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"작업 처리 중 내부 오류: {exc}",
        )
