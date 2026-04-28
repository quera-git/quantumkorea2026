"""결과 조회 라우터.

Job 테이블에서 result_payload를 읽어 OptimizeResult 형식으로 반환.
"""
import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job
from shared.schema import OptimizeResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/{job_id}", response_model=OptimizeResult)
async def get_result(
    job_id: str,
    session: AsyncSession = Depends(get_session),
) -> OptimizeResult:
    """job_id 로 결과 조회.

    상태가 succeeded 면 저장된 result_payload 반환,
    그 외(running/failed/pending)는 schedule 비어있는 상태 객체 반환.
    """
    try:
        job = await session.get(Job, job_id)
        if job is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"job_id 없음: {job_id}",
            )

        if job.status == "succeeded" and job.result_payload:
            payload = json.loads(job.result_payload)
            return OptimizeResult.model_validate(payload)

        # running / failed / pending — 메타만 채워서 반환
        return OptimizeResult(
            job_id=job.id,
            status=job.status,  # type: ignore[arg-type]
            schedule=[],
            objective_value=job.objective_value,
            elapsed_seconds=job.elapsed_seconds,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("결과 조회 실패: %s", job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"결과 조회 중 오류: {exc}",
        )
