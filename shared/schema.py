"""Backend ↔ Worker 간 공유되는 Pydantic 스키마.

이 모듈의 모델은 두 컨테이너(backend, worker) 모두에서 import 된다.
변경 시 frontend의 src/types/schema.ts 도 함께 갱신해야 한다.
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


JobStatus = Literal["pending", "running", "succeeded", "failed"]
SolverName = Literal["dwave", "gurobi"]


class BPTRecord(BaseModel):
    """Berth Productivity Table 한 행 (입력 데이터 단위)."""

    vessel_id: str = Field(..., description="선박 식별자")
    arrival_time: datetime = Field(..., description="도착 시각(ISO8601)")
    berth_length: float = Field(..., gt=0, description="필요한 선석 길이(m)")
    processing_time: float = Field(..., gt=0, description="본선처리 시간(시간 단위)")


class ScheduleEntry(BaseModel):
    """배정된 선석 일정 한 행."""

    vessel_id: str
    berth_id: str
    start_time: datetime
    end_time: datetime


class OptimizeRequest(BaseModel):
    """최적화 요청 (backend → worker)."""

    job_id: str = ""
    bpt_records: list[BPTRecord]
    solver: SolverName = "gurobi"


class OptimizeResult(BaseModel):
    """최적화 결과 (worker → backend → frontend)."""

    job_id: str
    status: JobStatus
    schedule: list[ScheduleEntry] = []
    objective_value: float | None = None
    elapsed_seconds: float | None = None
