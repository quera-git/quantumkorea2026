"""최적화 요청 라우터.

backend로부터 OptimizeRequest를 받아 선택된 솔버를 실행하고 결과를 반환한다.
예외 메시지에 토큰/라이선스 정보가 섞이지 않도록 주의한다.
"""
import logging
import time

from fastapi import APIRouter, HTTPException, status

from app.solvers import dwave_solver, gurobi_solver
from shared.schema import OptimizeRequest, OptimizeResult

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/optimize", response_model=OptimizeResult)
def optimize(request: OptimizeRequest) -> OptimizeResult:
    """선택된 솔버로 최적화 수행."""
    started = time.perf_counter()
    try:
        if request.solver == "dwave":
            schedule, objective = dwave_solver.solve(request)
        elif request.solver == "gurobi":
            schedule, objective = gurobi_solver.solve(request)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"미지원 솔버: {request.solver}",
            )

        elapsed = time.perf_counter() - started
        logger.info(
            "최적화 완료: job_id=%s solver=%s elapsed=%.2fs",
            request.job_id, request.solver, elapsed,
        )
        return OptimizeResult(
            job_id=request.job_id,
            status="succeeded",
            schedule=schedule,
            objective_value=objective,
            elapsed_seconds=elapsed,
        )
    except HTTPException:
        raise
    except Exception:
        # 토큰/라이선스 정보가 응답에 새지 않도록 detail은 일반 메시지로만.
        logger.exception("최적화 실패: job_id=%s solver=%s", request.job_id, request.solver)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="최적화 처리 중 내부 오류 발생",
        )
