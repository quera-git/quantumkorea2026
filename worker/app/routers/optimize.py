"""최적화 요청 라우터.

backend로부터 OptimizeRequest를 받아 선택된 솔버를 실행하고 결과를 반환한다.
예외 메시지에 토큰/라이선스 정보가 섞이지 않도록 주의한다 (AGENTS.md §3).
"""
import logging
import time

import pandas as pd
from fastapi import APIRouter, HTTPException, status

from app.solvers import cqm_solver, gurobi_solver, hybrid_solver
from shared.schema import (
    BPTRecord, OptimizeRequest, OptimizeResult, ScheduleEntry,
)

logger = logging.getLogger(__name__)
router = APIRouter()


# 영문 BPTRecord 필드명 → 노트북이 기대하는 한글 컬럼명
_BPT_TO_KOREAN = {
    'vessel_id': '모선항차',
    'length': 'Length',
    'eta_int': 'ETA_int',
    'etb_int': 'ETB_int',
    'etd_int': 'ETD_int',
    'berth_position': '접안위치(F)',
    'yangha_van': '양하(Van)',
    'seonjeok_van': '선적(Van)',
}


def _records_to_dataframe(records: list[BPTRecord]) -> pd.DataFrame:
    """BPTRecord 리스트를 노트북 호환 한글 컬럼 DataFrame으로 변환."""
    rows = [r.model_dump() for r in records]
    df = pd.DataFrame(rows)
    df = df.rename(columns=_BPT_TO_KOREAN)
    return df


def _result_dicts_to_schedule(result_rows: list[dict]) -> list[ScheduleEntry]:
    """노트북 결과 dict 리스트를 ScheduleEntry 리스트로 변환."""
    schedule: list[ScheduleEntry] = []
    for row in result_rows:
        schedule.append(ScheduleEntry(
            vessel_id=str(row['모선항차']),
            length=int(row['Length']),
            eta=float(row['ETA_int']),
            etb=float(row['ETB_int']),
            etd=float(row['ETD_int']),
            berth_position=float(row['접안위치(F)']),
            note=row.get('비고', ''),
        ))
    return schedule


@router.post("/optimize", response_model=OptimizeResult)
def optimize(request: OptimizeRequest) -> OptimizeResult:
    """선택된 솔버로 최적화 수행."""
    started = time.perf_counter()
    try:
        df = _records_to_dataframe(request.bpt_records)

        if request.solver == "gurobi":
            opt_results, objective = gurobi_solver.solve(
                df, planning_start_time=request.planning_start_time
            )
        elif request.solver == "cqm":
            opt_results, objective = cqm_solver.solve(
                df, planning_start_time=request.planning_start_time
            )
        elif request.solver == "hybrid":
            opt_results, objective = hybrid_solver.solve(
                df, planning_start_time=request.planning_start_time
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"미지원 솔버: {request.solver}",
            )

        schedule = _result_dicts_to_schedule(opt_results)
        elapsed = time.perf_counter() - started
        logger.info(
            "최적화 완료: job_id=%s solver=%s elapsed=%.2fs schedule_count=%d",
            request.job_id, request.solver, elapsed, len(schedule),
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
        # 예외 detail에 토큰/스택이 노출되지 않도록 일반 메시지로 변환.
        logger.exception(
            "최적화 실패: job_id=%s solver=%s", request.job_id, request.solver
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="최적화 처리 중 내부 오류 발생",
        )
