"""백엔드 환경 설정.

D-Wave 토큰을 여기서 읽지 않는다 — 토큰은 worker 컨테이너 전용.
"""
import os

WORKER_URL: str = os.getenv("WORKER_URL", "http://worker:9000")
DATABASE_URL: str = os.getenv(
    "DATABASE_URL", "sqlite+aiosqlite:////data/qpo.db"
)
