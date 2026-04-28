"""SQLite(async) 연결 관리."""
import logging
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import DATABASE_URL

logger = logging.getLogger(__name__)

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI Depends용 세션 제너레이터."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """모든 테이블을 생성한다 (이미 있으면 스킵, idempotent).

    startup 시 1회 호출. Alembic 도입 전까지 임시 마이그레이션 수단.
    """
    # 순환 import 회피용 지역 import
    from app.models import Base
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("DB 초기화 완료: %s", DATABASE_URL)
