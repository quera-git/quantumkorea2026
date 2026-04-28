"""세 솔버(Gurobi / CQM / Hybrid) 공통 모듈.

worker-origin 노트북 세 개에서 반복되던 글로벌 파라미터, 데이터 전처리,
초기 윈도우 freeze 로직, 평가 함수를 한 곳에 모았다. 알고리즘 본문은 각
solver 모듈에 그대로 남기고, 여기서는 입력 정규화와 보조 자료만 다룬다.
"""
from __future__ import annotations

import math
from typing import Any

import pandas as pd

# =====================================================================
# 글로벌 파라미터 (세 노트북 공통)
# =====================================================================
T: int = 200                    # 시간 horizon (시간 단위)
ss: int = 1500                  # 선석 전체 길이 (m)
TIME_GAP: int = 1               # 선박 간 시간 간격 (시간)
SPACE_GAP: int = 30             # 선박 간 공간 간격 (m)
QUAY_CRANES: int = 15           # 안벽 크레인 수
SERVICE_RATE: int = 25          # 시간당 처리 컨테이너 수

# 안벽 크레인 g가 커버 가능한 좌측/우측 위치
LG: dict[int, int] = {0: 0, 1: 0, 2: 0, 3: 0, 4: 300, 5: 300, 6: 478, 7: 492,
                       8: 562, 9: 687, 10: 720, 11: 721, 12: 800, 13: 973,
                       14: 973, 15: 1048}
RG: dict[int, int] = {0: 323, 1: 324, 2: 352, 3: 653, 4: 654, 5: 686, 6: 890,
                       7: 891, 8: 1031, 9: 1106, 10: 1172, 11: 1256, 12: 1500,
                       13: 1500, 14: 1500, 15: 1500}

# Big-M
M_TIME: int = T + TIME_GAP + 100
M_SPACE: int = ss + SPACE_GAP + 100

# Rolling Horizon 기본값
H_PLAN: int = 24
H_ROLL: int = 12
FREEZE_HOURS: int = 12


def compute_cmax(length: float) -> int:
    """선박 길이별 동시 사용 가능 크레인 수."""
    if length < 150:
        return 2
    if length < 200:
        return 3
    return 4


def prepare_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    """노트북 첫 셀의 데이터 정규화 단계.

    - '양하(Van)' + '선적(Van)' → 'Containers'
    - Length 를 int 로 캐스팅
    - 필수 컬럼 결측치 제거 + ETA_int 정렬
    """
    df = df.copy()
    df['양하(Van)'] = pd.to_numeric(df['양하(Van)'], errors='coerce').fillna(0)
    df['선적(Van)'] = pd.to_numeric(df['선적(Van)'], errors='coerce').fillna(0)
    df['Containers'] = df['양하(Van)'] + df['선적(Van)']
    df = df.astype({'Length': 'int64'})

    df = df.dropna(
        subset=['ETA_int', 'Length', '접안위치(F)', 'ETB_int', 'ETD_int', 'Containers']
    ).copy()
    df = df.sort_values(by='ETA_int')
    return df


def freeze_initial_window(
    df: pd.DataFrame,
    planning_start_time: float,
    freeze_hours: int = FREEZE_HOURS,
) -> tuple[dict[int, dict[str, Any]], set[tuple[int, int]], list[dict[str, Any]]]:
    """기준 시점 + freeze_hours 윈도우에 들어오는 선박을 강제 고정.

    Returns:
        fixed_vessels: {vessel_idx: {u, c, v, s, zeta_list}}
        busy_cranes: {(g, t)} 점유된 크레인-시간 셀
        opt_results: 결과 dict 리스트 (비고 컬럼 포함)
    """
    s = df['Length'].to_dict()
    a = df['ETA_int'].to_dict()
    cmax = {i: compute_cmax(s[i]) for i in df.index}

    freeze_end = planning_start_time + freeze_hours
    candidates = (
        df[df['ETB_int'] < freeze_end].sort_values(by='ETB_int').index.tolist()
    )

    fixed_vessels: dict[int, dict[str, Any]] = {}
    busy_cranes: set[tuple[int, int]] = set()
    opt_results: list[dict[str, Any]] = []

    for i in candidates:
        u_val = df.loc[i, 'ETB_int']
        c_val = df.loc[i, 'ETD_int']
        v_val = df.loc[i, '접안위치(F)']
        s_val = s[i]
        vessel_name = (
            df.loc[i, '모선항차'] if '모선항차' in df.columns else df.loc[i, '선박명']
        )

        is_already_working = (u_val < planning_start_time)
        has_conflict = False
        for fixed_data in fixed_vessels.values():
            time_overlap = not (
                c_val + TIME_GAP <= fixed_data['u']
                or fixed_data['c'] + TIME_GAP <= u_val
            )
            space_overlap = not (
                v_val + s_val + SPACE_GAP <= fixed_data['v']
                or fixed_data['v'] + fixed_data['s'] + SPACE_GAP <= v_val
            )
            if time_overlap and space_overlap:
                has_conflict = True
                break

        if has_conflict and not is_already_working:
            continue

        center = v_val + (s_val / 2)
        capable_cranes = [g for g in range(QUAY_CRANES) if LG[g] <= center <= RG[g]]
        assigned_cranes: list[int] = []
        for g in capable_cranes:
            is_free = True
            for t in range(math.floor(u_val), min(T, math.ceil(c_val) + 1)):
                if (g, t) in busy_cranes:
                    is_free = False
                    break
            if is_free:
                assigned_cranes.append(g)
            if len(assigned_cranes) == cmax[i]:
                break

        if len(assigned_cranes) < cmax[i] and not is_already_working:
            continue

        zeta_list: list[tuple[int, int]] = []
        for g in assigned_cranes:
            for t in range(math.floor(u_val), min(T, math.ceil(c_val) + 1)):
                zeta_list.append((g, t))
                busy_cranes.add((g, t))

        fixed_vessels[i] = {
            'u': u_val, 'c': c_val, 'v': v_val, 's': s_val, 'zeta_list': zeta_list,
        }
        opt_results.append({
            '모선항차': vessel_name,
            'Length': s_val,
            'ETA_int': a[i],
            'ETB_int': round(u_val, 4),
            'ETD_int': round(c_val, 4),
            '접안위치(F)': round(v_val, 4),
            '비고': '작업 중 고정' if is_already_working else '초기 고정',
        })

    return fixed_vessels, busy_cranes, opt_results


def evaluate_schedule(
    df_results: pd.DataFrame,
    max_t: int = 500,
    port_length: int = 1500,
) -> tuple[float, list[str], set[Any]]:
    """최적화 결과의 제약 위반 여부 평가.

    Returns:
        objective_value: 총 체류 시간
        violations: 위반 메시지 리스트
        violating_vessels: 위반 선박 인덱스 집합
    """
    df_eval = df_results.dropna(
        subset=['ETB_int', 'ETD_int', 'Length', '접안위치(F)', 'ETA_int']
    ).copy()
    vesselsp = df_eval.index.tolist()

    s = df_eval['Length'].to_dict()
    a = df_eval['ETA_int'].to_dict()
    u = df_eval['ETB_int'].to_dict()
    c = df_eval['ETD_int'].to_dict()
    v = df_eval['접안위치(F)'].to_dict()

    objective_value = sum((c[i] - a[i]) for i in vesselsp)

    violations: list[str] = []
    violating: set[Any] = set()

    for i in vesselsp:
        viol = False
        if round(u[i], 2) < round(a[i], 2):
            violations.append(f"[{i}] ETA 위반: 접안({u[i]:.2f}) < 요청({a[i]:.2f})")
            viol = True
        if c[i] > max_t:
            violations.append(f"[{i}] T 초과: 출항({c[i]:.2f}) > 최대({max_t})")
            viol = True
        if v[i] < 0 or v[i] + s[i] > port_length:
            violations.append(f"[{i}] 공간 위반: {v[i]:.2f}~{v[i] + s[i]:.2f}")
            viol = True
        if viol:
            violating.add(i)

    for idx1, i in enumerate(vesselsp):
        for idx2, j in enumerate(vesselsp):
            if idx1 >= idx2:
                continue
            time_sep = (round(c[i] + TIME_GAP, 2) <= round(u[j], 2)) or (
                round(c[j] + TIME_GAP, 2) <= round(u[i], 2)
            )
            space_sep = (
                round(v[i] + s[i] + SPACE_GAP, 2) <= round(v[j], 2)
            ) or (round(v[j] + s[j] + SPACE_GAP, 2) <= round(v[i], 2))
            if not (time_sep or space_sep):
                violations.append(f"[{i}]와 [{j}] 간격 위반")
                violating.add(i)
                violating.add(j)

    return objective_value, violations, violating
