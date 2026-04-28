"""Gurobi MIP 솔버 어댑터 (스텁).

추후 기존 최적화 코드를 이 모듈로 통합할 예정. 라이선스 파일은
GRB_LICENSE_FILE 환경변수로 지정된 경로에서 read-only 마운트로 제공된다.
"""
import logging
import os

from app.config import GRB_LICENSE_FILE
from shared.schema import OptimizeRequest, ScheduleEntry

logger = logging.getLogger(__name__)


def solve(request: OptimizeRequest) -> tuple[list[ScheduleEntry], float]:
    """Gurobi MIP 기반 선석 배정 최적화.

    Returns:
        (schedule, objective_value)
    """
    if not os.path.exists(GRB_LICENSE_FILE):
        logger.error("Gurobi 라이선스 파일 없음: %s", GRB_LICENSE_FILE)
        raise RuntimeError("Gurobi 라이선스 파일이 없습니다")

    logger.info(
        "Gurobi 솔버 호출: job_id=%s 레코드 %d건",
        request.job_id, len(request.bpt_records),
    )

    # TODO: 기존 MIP 모델 코드와 통합
    schedule: list[ScheduleEntry] = []
    objective = 0.0
    return schedule, objective
