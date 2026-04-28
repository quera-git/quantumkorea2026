"""결과 조회 라우터.

폴링 대상 엔드포인트. running 상태에서도 started_at 을 반환해 클라이언트가
경과 시간을 표시할 수 있게 한다.
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
    """job_id 로 결과/진행 상태 조회.

    - succeeded: 저장된 result_payload 반환
    - running: started_at 포함된 진행 상태 반환 (schedule 비어 있음)
    - failed: error_message 포함된 실패 상태 반환
    - 존재하지 않음: 404
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
            # 저장된 payload 에 started_at 이 없을 수 있어 보강.
            payload.setdefault("started_at",
                               job.started_at.isoformat() if job.started_at else None)
            return OptimizeResult.model_validate(payload)

        # running / failed / pending — 메타만 채워서 반환
        return OptimizeResult(
            job_id=job.id,
            status=job.status,  # type: ignore[arg-type]
            schedule=[],
            objective_value=job.objective_value,
            elapsed_seconds=job.elapsed_seconds,
            started_at=job.started_at,
            error_message=job.error_message,
        )
    except HTTPException:
        raise
    except Exception as exc:
        logger.exception("결과 조회 실패: %s", job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"결과 조회 중 오류: {exc}",
        )
