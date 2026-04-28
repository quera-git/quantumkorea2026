"""Backend ↔ Worker 간 공유되는 Pydantic 스키마.

이 모듈의 모델은 두 컨테이너(backend, worker) 모두에서 import 된다.
변경 시 frontend의 src/types/schema.ts 도 함께 갱신해야 한다.

worker-origin 노트북이 사용하는 한글 컬럼('모선항차', '접안위치(F)' 등)을
영문 식별자로 매핑해 노출한다 — 한글 컬럼은 worker 내부 DataFrame 변환 시점에서만 쓴다.
"""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


JobStatus = Literal["pending", "running", "succeeded", "failed"]
SolverName = Literal["gurobi", "cqm", "hybrid"]


class BPTRecord(BaseModel):
    """Berth Productivity Table 한 행 — 노트북의 BPT_Result.xlsx 한 행과 동치."""

    vessel_id: str = Field(..., description="모선항차")
    length: int = Field(..., gt=0, description="선박 길이(m)")
    eta_int: float = Field(..., description="ETA_int — 도착 예정 시각(시간)")
    etb_int: float = Field(..., description="ETB_int — 현재 배치 접안 시각")
    etd_int: float = Field(..., description="ETD_int — 현재 배치 출항 시각")
    berth_position: float = Field(..., description="접안위치(F) — 선석 시작 좌표(m)")
    yangha_van: float = Field(0, description="양하(Van)")
    seonjeok_van: float = Field(0, description="선적(Van)")


class ScheduleEntry(BaseModel):
    """최적화 결과 한 행."""

    vessel_id: str
    length: int
    eta: float
    etb: float
    etd: float
    berth_position: float
    note: str = ""


class OptimizeRequest(BaseModel):
    """최적화 요청 (backend → worker)."""

    job_id: str = ""
    bpt_records: list[BPTRecord]
    solver: SolverName = "gurobi"
    planning_start_time: float = Field(
        0, description="시뮬레이션 기준 시점(시간). 노트북 기본값 14.5 또는 80."
    )


class OptimizeResult(BaseModel):
    """최적화 결과 (worker → backend → frontend)."""

    job_id: str
    status: JobStatus
    schedule: list[ScheduleEntry] = []
    objective_value: float | None = None
    elapsed_seconds: float | None = None
