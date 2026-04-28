"""FastAPI 백엔드 진입점.

BPT 데이터 수신/저장, 결과 조회, worker로의 작업 위임을 담당한다.
양자 토큰을 절대 보유하지 않는다 (AGENTS.md §3).
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

from app.db import init_db
from app.routers import bpt, jobs, results


@asynccontextmanager
async def lifespan(app: FastAPI):
    """startup/shutdown 훅."""
    await init_db()
    yield


app = FastAPI(
    title="Quantum Port Optimizer - Backend",
    version="0.1.0",
    lifespan=lifespan,
)

# 운영 환경에서는 frontend 도메인으로 제한할 것.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(bpt.router, prefix="/bpt", tags=["bpt"])
app.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
app.include_router(results.router, prefix="/results", tags=["results"])


@app.get("/health")
def health() -> dict[str, str]:
    """헬스체크."""
    return {"status": "ok"}
