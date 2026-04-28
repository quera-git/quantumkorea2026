"""Worker 환경 설정.

토큰/라이선스 경로는 환경변수에서 읽는다. 절대 그 값을 로그/응답으로 출력하지 말 것
(AGENTS.md §3). 존재 여부(불리언)만 로깅 허용.
"""
import logging
import os

logger = logging.getLogger(__name__)

DWAVE_API_TOKEN: str = os.getenv("DWAVE_API_TOKEN", "")
GRB_LICENSE_FILE: str = os.getenv("GRB_LICENSE_FILE", "/opt/gurobi/gurobi.lic")

# 토큰 값 자체는 절대 로그에 남기지 않는다. 존재 여부만 점검.
if not DWAVE_API_TOKEN:
    logger.warning("DWAVE_API_TOKEN 미설정 — D-Wave 솔버 사용 불가")
else:
    logger.info("DWAVE_API_TOKEN 로드됨 (길이만 노출 가능: %d자)", len(DWAVE_API_TOKEN))

if not os.path.exists(GRB_LICENSE_FILE):
    logger.warning("Gurobi 라이선스 파일 없음: %s", GRB_LICENSE_FILE)
else:
    logger.info("Gurobi 라이선스 파일 확인: %s", GRB_LICENSE_FILE)
