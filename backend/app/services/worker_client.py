"""Worker(양자 솔버) HTTP 클라이언트.

backend ↔ worker 간 모든 통신은 반드시 이 모듈을 경유해야 한다 (AGENTS.md §4.3).
타임아웃/에러 변환 정책의 단일 진입점.
"""
import logging

import httpx
from fastapi import HTTPException, status

from app.config import WORKER_URL
from shared.schema import OptimizeRequest, OptimizeResult

logger = logging.getLogger(__name__)

# 양자 솔버는 수십 초~수 분 소요될 수 있어 read 타임아웃을 길게 설정
_TIMEOUT = httpx.Timeout(connect=5.0, read=300.0, write=30.0, pool=5.0)


async def submit_to_worker(request: OptimizeRequest) -> OptimizeResult:
    """Worker에 최적화 요청을 전송하고 결과를 반환.

    Raises:
        HTTPException: worker 응답/연결 오류 시 502 또는 503으로 변환.
    """
    try:
        async with httpx.AsyncClient(base_url=WORKER_URL, timeout=_TIMEOUT) as client:
            response = await client.post(
                "/optimize",
                json=request.model_dump(mode="json"),
            )
            response.raise_for_status()
            return OptimizeResult.model_validate(response.json())
    except httpx.HTTPStatusError as exc:
        logger.error(
            "worker 응답 오류: status=%s url=%s",
            exc.response.status_code,
            exc.request.url,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"worker 응답 오류 {exc.response.status_code}",
        )
    except httpx.RequestError as exc:
        # 토큰이 메시지에 섞이지 않도록 exc 자체는 로그에만 남기고 응답엔 안전한 메시지만
        logger.exception("worker 통신 실패")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"worker 연결 실패: {type(exc).__name__}",
        )
