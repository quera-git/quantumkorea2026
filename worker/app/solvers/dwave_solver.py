"""D-Wave 솔버 어댑터 (스텁).

추후 기존 양자 최적화 코드를 이 모듈로 통합할 예정. 통합 시에도
- DWAVE_API_TOKEN을 로그/응답에 출력하지 말 것
- 외부 호출 함수는 try/except + logging 갖출 것
의 규칙을 따른다 (AGENTS.md §3, §4.5).
"""
import logging

from app.config import DWAVE_API_TOKEN
from shared.schema import OptimizeRequest, ScheduleEntry

logger = logging.getLogger(__name__)


def solve(request: OptimizeRequest) -> tuple[list[ScheduleEntry], float]:
    """D-Wave를 이용한 선석 배정 최적화.

    Returns:
        (schedule, objective_value)
    """
    if not DWAVE_API_TOKEN:
        logger.error("DWAVE_API_TOKEN 미설정 상태로 D-Wave 솔버 호출됨")
        # 토큰 값 자체는 메시지에 포함하지 않음
        raise RuntimeError("D-Wave 토큰이 설정되지 않았습니다")

    logger.info(
        "D-Wave 솔버 호출: job_id=%s 레코드 %d건",
        request.job_id, len(request.bpt_records),
    )

    # TODO: 기존 양자 최적화 코드와 통합
    schedule: list[ScheduleEntry] = []
    objective = 0.0
    return schedule, objective
