"""최적화 작업 제출/조회 라우터.

작업 lifecycle:
  pending → running → (succeeded | failed)

worker 호출은 반드시 services.worker_client를 경유한다 (AGENTS.md §4.3).
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.models import Job
from app.services.worker_client import submit_to_worker
from shared.schema import OptimizeRequest, OptimizeResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=OptimizeResult)
async def submit_job(
    request: OptimizeRequest,
    session: AsyncSession = Depends(get_session),
) -> OptimizeResult:
    """최적화 작업 제출. Job row 생성 → worker 호출 → 결과 저장 후 반환."""
    if not request.job_id:
        request.job_id = str(uuid.uuid4())

    # 1) Job row를 running 상태로 미리 저장
    job = Job(
        id=request.job_id,
        status="running",
        solver=request.solver,
        request_payload=request.model_dump_json(),
        created_at=datetime.utcnow(),
    )
    try:
        session.add(job)
        await session.commit()
    except Exception as exc:
        await session.rollback()
        logger.exception("Job row 저장 실패: %s", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"작업 등록 중 오류: {exc}",
        )

    # 2) worker 호출
    try:
        result = await submit_to_worker(request)
    except HTTPException as exc:
        # worker 호출 실패: Job 상태 갱신 후 재던짐
        await _mark_job_failed(session, request.job_id, str(exc.detail))
        raise
    except Exception as exc:
        await _mark_job_failed(session, request.job_id, str(exc))
        logger.exception("worker 호출 실패: %s", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"작업 처리 중 내부 오류: {exc}",
        )

    # 3) 결과 저장
    try:
        job_row = await session.get(Job, request.job_id)
        if job_row is not None:
            job_row.status = result.status
            job_row.result_payload = result.model_dump_json()
            job_row.objective_value = result.objective_value
            job_row.elapsed_seconds = result.elapsed_seconds
            job_row.completed_at = datetime.utcnow()
            await session.commit()
        logger.info("작업 %s 완료: status=%s", request.job_id, result.status)
        return result
    except Exception as exc:
        await session.rollback()
        logger.exception("결과 저장 실패: %s", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"결과 저장 중 오류: {exc}",
        )


@router.get("/")
async def list_jobs(
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """전체 작업 메타데이터 조회 (최신순)."""
    try:
        result = await session.execute(
            select(Job).order_by(Job.created_at.desc())
        )
        rows = result.scalars().all()
        return [
            {
                "job_id": r.id,
                "status": r.status,
                "solver": r.solver,
                "objective_value": r.objective_value,
                "elapsed_seconds": r.elapsed_seconds,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "completed_at": r.completed_at.isoformat() if r.completed_at else None,
            }
            for r in rows
        ]
    except Exception as exc:
        logger.exception("작업 목록 조회 실패")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"작업 목록 조회 중 오류: {exc}",
        )


async def _mark_job_failed(
    session: AsyncSession, job_id: str, error_message: str
) -> None:
    """Job 행을 failed 상태로 업데이트. 예외는 삼킨다 (이미 다른 예외 처리 중)."""
    try:
        job_row = await session.get(Job, job_id)
        if job_row is not None:
            job_row.status = "failed"
            # 에러 메시지에 토큰이 섞일 수 있는 경로는 worker_client 가 차단함.
            job_row.error_message = error_message[:500]
            job_row.completed_at = datetime.utcnow()
            await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("Job %s failed 상태 갱신 실패", job_id)
