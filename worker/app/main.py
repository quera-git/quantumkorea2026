"""양자 최적화 worker FastAPI 진입점.

D-Wave 토큰과 Gurobi 라이선스를 보유하며, 같은 docker network의 backend 컨테이너로부터만
호출 가능하다. 외부 호스트 노출 금지 (AGENTS.md §3).
"""
import logging

from fastapi import FastAPI

from app.routers import optimize

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(
    title="Quantum Port Optimizer - Worker",
    version="0.1.0",
)

app.include_router(optimize.router, tags=["optimize"])


@app.get("/health")
def health() -> dict[str, str]:
    """헬스체크 (토큰 존재 여부는 노출하지 않음)."""
    return {"status": "ok"}
