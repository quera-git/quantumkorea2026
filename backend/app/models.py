"""SQLAlchemy ORM 모델."""
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Job(Base):
    """최적화 작업 영속화 테이블.

    request_payload/result_payload 는 OptimizeRequest/OptimizeResult 의
    JSON 직렬화 결과를 그대로 저장한다 (작업당 1행).
    """

    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)
    solver: Mapped[str] = mapped_column(String)
    request_payload: Mapped[str] = mapped_column(Text)
    result_payload: Mapped[str | None] = mapped_column(Text, nullable=True)
    objective_value: Mapped[float | None] = mapped_column(Float, nullable=True)
    elapsed_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class BPTRecordRow(Base):
    """BPT 업로드 영속화 테이블 (한 행 = 한 BPTRecord)."""

    __tablename__ = "bpt_records"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vessel_id: Mapped[str] = mapped_column(String, index=True)
    length: Mapped[int] = mapped_column(Integer)
    eta_int: Mapped[float] = mapped_column(Float)
    etb_int: Mapped[float] = mapped_column(Float)
    etd_int: Mapped[float] = mapped_column(Float)
    berth_position: Mapped[float] = mapped_column(Float)
    yangha_van: Mapped[float] = mapped_column(Float, default=0.0)
    seonjeok_van: Mapped[float] = mapped_column(Float, default=0.0)
    # BPTC 선석배정 그래픽의 plan_cd 매핑 — shared.schema.PlanStatus enum 값.
    # 그래픽에 게시 안 된 선박은 None.
    plan_status: Mapped[str | None] = mapped_column(String, nullable=True)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
