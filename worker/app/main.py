"""양자 최적화 worker FastAPI 진입점.

D-Wave 토큰과 Gurobi 라이선스를 보유하며, 같은 docker network의 backend 컨테이너로부터만
호출 가능하다. 외부 호스트 노출 금지 (AGENTS.md §3).
"""
import logging

# config.py 의 startup 로그가 묻히지 않도록 라우터 import 전에 logging 초기화.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from fastapi import FastAPI

from app.routers import optimize

app = FastAPI(
    title="Quantum Port Optimizer - Worker",
    version="0.1.0",
)

app.include_router(optimize.router, tags=["optimize"])


@app.get("/health")
def health() -> dict[str, str]:
    """헬스체크 (토큰 존재 여부는 노출하지 않음)."""
    return {"status": "ok"}
