"""최적화 작업 제출/조회 라우터 (비동기 폴링 패턴).

작업 lifecycle:
  pending → running → (succeeded | failed)

POST /jobs/ 는 BackgroundTasks 로 worker 호출을 비동기 실행하고 즉시 202를
반환한다. 클라이언트는 GET /results/{job_id} 를 폴링한다.

worker 호출은 services.worker_client 를 경유한다 (AGENTS.md §4.3).
"""
import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import SessionLocal, get_session
from app.models import Job
from app.services.worker_client import submit_to_worker
from shared.schema import JobAccepted, OptimizeRequest

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/", response_model=JobAccepted, status_code=status.HTTP_202_ACCEPTED)
async def submit_job(
    request: OptimizeRequest,
    background_tasks: BackgroundTasks,
    session: AsyncSession = Depends(get_session),
) -> JobAccepted:
    """최적화 작업 제출. 즉시 job_id 반환 후 worker 호출은 백그라운드 실행.

    클라이언트는 GET /results/{job_id} 를 폴링하여 진행 상태와 결과를 확인한다.
    """
    if not request.bpt_records:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="bpt_records 가 비어 있습니다.",
        )

    if not request.job_id:
        request.job_id = str(uuid.uuid4())

    now = datetime.utcnow()
    job = Job(
        id=request.job_id,
        status="running",
        solver=request.solver,
        request_payload=request.model_dump_json(),
        created_at=now,
        started_at=now,
    )
    try:
        session.add(job)
        await session.commit()
    except IntegrityError:
        # 동일 job_id 가 이미 존재 — 409 Conflict. 사용자 입력이 SQL 메시지로
        # 반사되지 않도록 짧은 한글 메시지만 노출한다.
        await session.rollback()
        logger.info("중복 job_id 시도: %s", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"job_id 가 이미 존재합니다: {request.job_id}",
        )
    except Exception:
        await session.rollback()
        logger.exception("Job row 저장 실패: %s", request.job_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="작업 등록 중 내부 오류",
        )

    background_tasks.add_task(_run_optimization, request)
    logger.info("작업 %s 백그라운드 실행 큐잉됨", request.job_id)
    return JobAccepted(job_id=request.job_id, status="running")


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
                "started_at": r.started_at.isoformat() if r.started_at else None,
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


async def _run_optimization(request: OptimizeRequest) -> None:
    """백그라운드에서 worker 호출 + DB 업데이트.

    BackgroundTasks 로 호출되므로 응답 반환 후 실행된다. 자체 세션을 열어
    사용한다 (request 세션은 이미 종료됨).
    """
    job_id = request.job_id
    async with SessionLocal() as session:
        try:
            result = await submit_to_worker(request)
            job = await session.get(Job, job_id)
            if job is None:
                logger.error("Job row 사라짐: %s", job_id)
                return
            job.status = result.status
            job.result_payload = result.model_dump_json()
            job.objective_value = result.objective_value
            job.elapsed_seconds = result.elapsed_seconds
            job.completed_at = datetime.utcnow()
            await session.commit()
            logger.info(
                "작업 %s 완료: status=%s elapsed=%.2fs",
                job_id, result.status, result.elapsed_seconds or 0,
            )
        except HTTPException as exc:
            await _mark_job_failed(session, job_id, str(exc.detail))
        except Exception as exc:
            logger.exception("작업 %s 백그라운드 실행 실패", job_id)
            await _mark_job_failed(session, job_id, str(exc))


async def _mark_job_failed(
    session: AsyncSession, job_id: str, error_message: str
) -> None:
    """Job 행을 failed 로 업데이트. 메시지에 토큰이 새지 않도록 길이 제한."""
    try:
        job_row = await session.get(Job, job_id)
        if job_row is not None:
            job_row.status = "failed"
            job_row.error_message = error_message[:500]
            job_row.completed_at = datetime.utcnow()
            await session.commit()
    except Exception:
        await session.rollback()
        logger.exception("Job %s failed 상태 갱신 실패", job_id)
