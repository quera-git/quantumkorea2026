"""D-Wave CQM(Constrained Quadratic Model) 단독 솔버.

worker-origin/OnlyCQMhard_Final.ipynb의 본문을 함수로 옮겼다.
원본에는 토큰이 하드코딩되어 있었으나, 본 모듈에서는 app.config.DWAVE_API_TOKEN
환경변수를 사용한다 (AGENTS.md §3).
"""
from __future__ import annotations

import math
import time
from typing import Any

import dimod
import pandas as pd
from dwave.system import LeapHybridCQMSampler

from app.config import DWAVE_API_TOKEN
from app.solvers.common import (
    H_PLAN, H_ROLL, LG, M_SPACE, M_TIME, QUAY_CRANES, RG, SERVICE_RATE,
    SPACE_GAP, T, TIME_GAP, compute_cmax, freeze_initial_window,
    prepare_dataframe, ss,
)

# 한 번에 처리할 최대 선박 수 (눈덩이 효과 방지)
MAX_BATCH = 10


def solve(
    df: pd.DataFrame,
    planning_start_time: float = 14.5,
    time_limit: int = 180,
) -> tuple[list[dict[str, Any]], float | None]:
    """D-Wave LeapHybridCQM 단독 롤링 호라이즌 최적화."""
    if not DWAVE_API_TOKEN:
        raise RuntimeError("DWAVE_API_TOKEN 미설정 — CQM 솔버 사용 불가")

    print("\n[데이터 준비 및 파라미터 초기화]")
    df_gurobi = prepare_dataframe(df)
    all_vessels = df_gurobi.index.tolist()

    s = df_gurobi['Length'].to_dict()
    a = df_gurobi['ETA_int'].to_dict()
    w = {i: 1 for i in all_vessels}
    Containers = df_gurobi['Containers'].to_dict()
    Cmax = {i: compute_cmax(s[i]) for i in all_vessels}

    print(f"\n[기준 시점: {planning_start_time}시] 초기 12시간 스케줄 고정 (CQM 하드 제약)")
    fixed_vessels, busy_cranes, opt_results = freeze_initial_window(
        df_gurobi, planning_start_time
    )
    print(f"\n🔒 {len(fixed_vessels)}척 고정 완료.")

    max_eta = df_gurobi['ETA_int'].max()
    current_time = planning_start_time
    total_start_time = time.time()
    iteration = 1
    last_energy: float | None = None

    sampler = LeapHybridCQMSampler(token=DWAVE_API_TOKEN)

    while current_time <= max_eta:
        V_plan = [
            i for i in all_vessels
            if a[i] < current_time + H_PLAN and i not in fixed_vessels
        ]

        if len(V_plan) > MAX_BATCH:
            print(f"⚠️ 대기 폭주({len(V_plan)}척). 선착순 {MAX_BATCH}척만 우선 처리.")
            V_plan = V_plan[:MAX_BATCH]

        if not V_plan:
            current_time += H_ROLL
            continue

        print("\n" + "=" * 60)
        print(f"🔄 [Iteration {iteration}] Time Window: {current_time} ~ {current_time + H_PLAN}")
        print(f"📦 대상 선박 ({len(V_plan)}척): {V_plan}")

        cqm = dimod.ConstrainedQuadraticModel()
        min_t = int(min(a[i] for i in V_plan))
        max_t = int(min(T, current_time + H_PLAN + 24))
        T_batch = range(min_t, max_t)

        u_var = {i: dimod.Integer(f"u_{i}", lower_bound=0, upper_bound=T) for i in V_plan}
        v_var = {i: dimod.Integer(f"v_{i}", lower_bound=0, upper_bound=ss) for i in V_plan}
        c_var = {i: dimod.Integer(f"c_{i}", lower_bound=0, upper_bound=T) for i in V_plan}
        sigma_var = {(i, j): dimod.Binary(f"sigma_{i}_{j}") for i in V_plan for j in V_plan}
        delta_var = {(i, j): dimod.Binary(f"delta_{i}_{j}") for i in V_plan for j in V_plan}
        gamma_vars = {
            (g, i, t): dimod.Binary(f"gamma_{g}_{i}_{t}")
            for g in range(QUAY_CRANES) for i in V_plan for t in T_batch
        }
        zeta_vars = {
            (g, i, t): dimod.Binary(f"zeta_{g}_{i}_{t}")
            for g in range(QUAY_CRANES) for i in V_plan for t in T_batch
        }

        cqm.set_objective(sum(w[i] * (c_var[i] - a[i]) for i in V_plan))

        for i in V_plan:
            cqm.add_constraint(u_var[i] >= a[i])
            cqm.add_constraint(c_var[i] <= T)
            cqm.add_constraint(c_var[i] - u_var[i] >= 1)
            cqm.add_constraint(v_var[i] + s[i] <= ss)
            cqm.add_constraint(
                sum(SERVICE_RATE * zeta_vars[g, i, t]
                    for g in range(QUAY_CRANES) for t in T_batch) >= Containers[i]
            )
            for t in T_batch:
                cqm.add_constraint(
                    sum(zeta_vars[g, i, t] for g in range(QUAY_CRANES)) <= Cmax[i]
                )

        for idx1, i in enumerate(V_plan):
            for idx2, j in enumerate(V_plan):
                if idx1 < idx2:
                    cqm.add_constraint(u_var[j] - c_var[i] - M_TIME * sigma_var[i, j] >= TIME_GAP - M_TIME)
                    cqm.add_constraint(u_var[i] - c_var[j] - M_TIME * sigma_var[j, i] >= TIME_GAP - M_TIME)
                    cqm.add_constraint(v_var[j] - v_var[i] - M_SPACE * delta_var[i, j] >= SPACE_GAP + s[i] - M_SPACE)
                    cqm.add_constraint(v_var[i] - v_var[j] - M_SPACE * delta_var[j, i] >= SPACE_GAP + s[j] - M_SPACE)
                    cqm.add_constraint(sigma_var[i, j] + sigma_var[j, i] <= 1)
                    cqm.add_constraint(delta_var[i, j] + delta_var[j, i] <= 1)
                    cqm.add_constraint(
                        sigma_var[i, j] + sigma_var[j, i] + delta_var[i, j] + delta_var[j, i] >= 1
                    )

                    eta_max = max(a[i], a[j])
                    for t in T_batch:
                        if t < eta_max:
                            continue
                        cross_ij = []
                        cross_ji = []
                        for g in range(QUAY_CRANES):
                            for g_ in range(g):
                                cross_ij.append(zeta_vars[g, i, t] * zeta_vars[g_, j, t])
                            for g_ in range(g + 1, QUAY_CRANES):
                                cross_ji.append(zeta_vars[g, i, t] * zeta_vars[g_, j, t])
                        if cross_ij:
                            cqm.add_constraint(sum(cross_ij) + 225 * delta_var[i, j] <= 225)
                        if cross_ji:
                            cqm.add_constraint(sum(cross_ji) + 225 * delta_var[j, i] <= 225)

        for g in range(QUAY_CRANES):
            for t in T_batch:
                cqm.add_constraint(sum(zeta_vars[g, i, t] for i in V_plan) <= 1)
            for i in V_plan:
                eta_i = math.floor(a[i])
                for t in T_batch:
                    if t < eta_i:
                        cqm.add_constraint(zeta_vars[g, i, t] == 0)
                    else:
                        cqm.add_constraint(u_var[i] + (T - t) * zeta_vars[g, i, t] <= T)
                        cqm.add_constraint(c_var[i] - (t + 1) * zeta_vars[g, i, t] >= 0)
                        cqm.add_constraint(v_var[i] + (ss - RG[g]) * zeta_vars[g, i, t] <= ss - (s[i] / 2))
                        cqm.add_constraint(v_var[i] - LG[g] * zeta_vars[g, i, t] >= -(s[i] / 2))

                for t in range(min_t + 1, max_t):
                    cqm.add_constraint(zeta_vars[g, i, t] - zeta_vars[g, i, t - 1] - gamma_vars[g, i, t] <= 0)
                    cqm.add_constraint(gamma_vars[g, i, t] - zeta_vars[g, i, t] <= 0)
                    cqm.add_constraint(gamma_vars[g, i, t] + zeta_vars[g, i, t - 1] <= 1)

        # 과거 유령선 필터링
        for (g, t) in busy_cranes:
            if t in T_batch:
                for i in V_plan:
                    cqm.add_constraint(zeta_vars[g, i, t] == 0)

        for past_i, past_info in fixed_vessels.items():
            past_u, past_c = past_info['u'], past_info['c']
            past_v, past_s = past_info['v'], past_info['s']
            for i in V_plan:
                if past_c + TIME_GAP <= a[i]:
                    continue
                b_left = dimod.Binary(f"b_left_{i}_{past_i}")
                b_right = dimod.Binary(f"b_right_{i}_{past_i}")
                b_below = dimod.Binary(f"b_below_{i}_{past_i}")
                b_above = dimod.Binary(f"b_above_{i}_{past_i}")

                cqm.add_constraint(b_left + b_right + b_below + b_above >= 1)
                cqm.add_constraint(c_var[i] + M_TIME * b_left <= past_u - TIME_GAP + M_TIME)
                cqm.add_constraint(u_var[i] - M_TIME * b_right >= past_c + TIME_GAP - M_TIME)
                cqm.add_constraint(v_var[i] + M_SPACE * b_below <= past_v - s[i] - SPACE_GAP + M_SPACE)
                cqm.add_constraint(v_var[i] - M_SPACE * b_above >= past_v + past_s + SPACE_GAP - M_SPACE)

        for past_i, past_info in fixed_vessels.items():
            past_v, past_s = past_info['v'], past_info['s']
            for (g_past, t) in past_info['zeta_list']:
                if t in T_batch:
                    for i in V_plan:
                        if t < a[i]:
                            continue
                        for g in range(QUAY_CRANES):
                            if g < g_past:
                                cqm.add_constraint(v_var[i] + M_SPACE * zeta_vars[g, i, t] <= past_v - s[i] + M_SPACE)
                            elif g > g_past:
                                cqm.add_constraint(v_var[i] - M_SPACE * zeta_vars[g, i, t] >= past_v + past_s - M_SPACE)

        print("📡 D-Wave Leap 클라우드로 최적화 쿼리를 전송합니다...")
        sampleset = sampler.sample_cqm(cqm, time_limit=time_limit)
        feasible_samples = sampleset.filter(lambda row: row.is_feasible)

        if len(feasible_samples) > 0:
            best_sample = feasible_samples.first.sample
            energy = float(feasible_samples.first.energy)
            last_energy = energy
            print(f"✅ 최적해 탐색 완료! (에너지: {energy:.2f})")

            is_last_batch = (len(fixed_vessels) + len(V_plan) == len(all_vessels))
            for i in V_plan:
                if a[i] < current_time + H_ROLL or is_last_batch:
                    u_val = best_sample[f"u_{i}"]
                    c_val = best_sample[f"c_{i}"]
                    v_val = best_sample[f"v_{i}"]
                    zeta_list = [
                        (g, t) for g in range(QUAY_CRANES) for t in T_batch
                        if best_sample.get(f"zeta_{g}_{i}_{t}", 0) > 0.5
                    ]
                    for g, t in zeta_list:
                        busy_cranes.add((g, t))

                    fixed_vessels[i] = {
                        'u': u_val, 'c': c_val, 'v': v_val,
                        's': s[i], 'zeta_list': zeta_list,
                    }
                    vessel_name = (
                        df_gurobi.loc[i, '모선항차']
                        if '모선항차' in df_gurobi.columns
                        else df_gurobi.loc[i, '선박명']
                    )
                    opt_results.append({
                        '모선항차': vessel_name,
                        'Length': s[i],
                        'ETA_int': a[i],
                        'ETB_int': round(u_val, 4),
                        'ETD_int': round(c_val, 4),
                        '접안위치(F)': round(v_val, 4),
                        '비고': '양자 최적화 (Hard CQM)',
                    })
        else:
            # 실패해도 break 하지 않고 다음 iteration으로 이월 (원본 핵심 수정 포인트)
            print(f"⚠️ Iteration {iteration} 실패: 유효해 없음. 다음 윈도우로 이월.")

        current_time += H_ROLL
        iteration += 1

    elapsed = time.time() - total_start_time
    print(f"\n🏁 D-Wave (하드 CQM) 시뮬레이션 종료 (총 {elapsed:.2f}초)")
    return opt_results, last_energy
