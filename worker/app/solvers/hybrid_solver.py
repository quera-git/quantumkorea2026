"""양자-고전 하이브리드 솔버.

Phase 1: D-Wave LeapHybridCQMSampler 가 초기 유효해 탐색 (60초)
Phase 2: Phase 1 결과를 Gurobi MIP Start 로 주입한 뒤 Gurobi 정밀 최적화 (120초)

worker-origin/HybridCQMGurobi_Final.ipynb를 함수로 모듈화한 것이며, 토큰은
환경변수에서 읽는다.
"""
from __future__ import annotations

import time
from typing import Any

import dimod
import gurobipy as gp
import pandas as pd
from dwave.system import LeapHybridCQMSampler
from gurobipy import GRB

from app.config import DWAVE_API_TOKEN
from app.solvers.common import (
    H_PLAN, H_ROLL, LG, M_SPACE, M_TIME, QUAY_CRANES, RG, SERVICE_RATE,
    SPACE_GAP, T, TIME_GAP, compute_cmax, freeze_initial_window,
    prepare_dataframe, ss,
)

MAX_BATCH = 10


def solve(
    df: pd.DataFrame,
    planning_start_time: float = 14.5,
    cqm_time_limit: int = 60,
    gurobi_time_limit: int = 120,
) -> tuple[list[dict[str, Any]], float | None]:
    """CQM(Phase 1) → Gurobi(Phase 2) 하이브리드 롤링 호라이즌."""
    if not DWAVE_API_TOKEN:
        raise RuntimeError("DWAVE_API_TOKEN 미설정 — Hybrid 솔버 사용 불가")

    print("\n[데이터 준비 및 파라미터 초기화]")
    df_gurobi = prepare_dataframe(df)
    all_vessels = df_gurobi.index.tolist()

    s = df_gurobi['Length'].to_dict()
    a = df_gurobi['ETA_int'].to_dict()
    w = {i: 1 for i in all_vessels}
    Containers = df_gurobi['Containers'].to_dict()
    Cmax = {i: compute_cmax(s[i]) for i in all_vessels}

    print(f"\n[기준 시점: {planning_start_time}시] 초기 12시간 스케줄 고정 (Hybrid)")
    fixed_vessels, busy_cranes, opt_results = freeze_initial_window(
        df_gurobi, planning_start_time
    )
    print(f"\n🔒 {len(fixed_vessels)}척 고정 완료.")

    max_eta = df_gurobi['ETA_int'].max()
    current_time = planning_start_time
    total_start_time = time.time()
    iteration = 1
    last_obj: float | None = None

    sampler = LeapHybridCQMSampler(token=DWAVE_API_TOKEN)

    while current_time <= max_eta:
        V_plan = [
            i for i in all_vessels
            if a[i] < current_time + H_PLAN and i not in fixed_vessels
        ]

        if len(V_plan) > MAX_BATCH:
            print(f"⚠️ 대기 폭주({len(V_plan)}척). 선착순 {MAX_BATCH}척만 분할 처리.")
            V_plan = V_plan[:MAX_BATCH]

        if not V_plan:
            current_time += H_ROLL
            continue

        print("\n" + "=" * 80)
        print(f"🔄 [Iteration {iteration}] Time Window: {current_time} ~ {current_time + H_PLAN}")
        print(f"📦 대상 선박 ({len(V_plan)}척): {V_plan}")

        min_t = int(min(a[i] for i in V_plan))
        max_t = int(min(T, current_time + H_PLAN + 24))
        T_batch = range(min_t, max_t)

        active_fixed_vessels = {
            past_i: info for past_i, info in fixed_vessels.items()
            if info['c'] >= min_t - TIME_GAP
        }

        # =============================================================
        # PHASE 1: D-Wave CQM
        # =============================================================
        print("\n[PHASE 1] D-Wave CQM 모델링 및 1차 탐색")
        cqm = dimod.ConstrainedQuadraticModel()

        cqm_u = {i: dimod.Integer(f"u_{i}", lower_bound=0, upper_bound=T) for i in V_plan}
        cqm_v = {i: dimod.Integer(f"v_{i}", lower_bound=0, upper_bound=ss) for i in V_plan}
        cqm_c = {i: dimod.Integer(f"c_{i}", lower_bound=0, upper_bound=T) for i in V_plan}
        cqm_sigma = {(i, j): dimod.Binary(f"sigma_{i}_{j}") for i in V_plan for j in V_plan}
        cqm_delta = {(i, j): dimod.Binary(f"delta_{i}_{j}") for i in V_plan for j in V_plan}
        cqm_gamma = {
            (g, i, t): dimod.Binary(f"gamma_{g}_{i}_{t}")
            for g in range(QUAY_CRANES) for i in V_plan for t in T_batch
        }
        cqm_zeta = {
            (g, i, t): dimod.Binary(f"zeta_{g}_{i}_{t}")
            for g in range(QUAY_CRANES) for i in V_plan for t in T_batch
        }

        cqm.set_objective(sum(w[i] * (cqm_c[i] - a[i]) for i in V_plan))

        for i in V_plan:
            cqm.add_constraint(cqm_u[i] >= a[i])
            cqm.add_constraint(cqm_c[i] <= T)
            cqm.add_constraint(cqm_c[i] - cqm_u[i] >= 1)
            cqm.add_constraint(cqm_v[i] + s[i] <= ss)
            cqm.add_constraint(
                sum(SERVICE_RATE * cqm_zeta[g, i, t]
                    for g in range(QUAY_CRANES) for t in T_batch) >= Containers[i]
            )
            for t in T_batch:
                cqm.add_constraint(
                    sum(cqm_zeta[g, i, t] for g in range(QUAY_CRANES)) <= Cmax[i]
                )

        for idx1, i in enumerate(V_plan):
            for idx2, j in enumerate(V_plan):
                if idx1 < idx2:
                    cqm.add_constraint(cqm_u[j] - cqm_c[i] - M_TIME * cqm_sigma[i, j] >= TIME_GAP - M_TIME)
                    cqm.add_constraint(cqm_u[i] - cqm_c[j] - M_TIME * cqm_sigma[j, i] >= TIME_GAP - M_TIME)
                    cqm.add_constraint(cqm_v[j] - cqm_v[i] - M_SPACE * cqm_delta[i, j] >= SPACE_GAP + s[i] - M_SPACE)
                    cqm.add_constraint(cqm_v[i] - cqm_v[j] - M_SPACE * cqm_delta[j, i] >= SPACE_GAP + s[j] - M_SPACE)
                    cqm.add_constraint(cqm_sigma[i, j] + cqm_sigma[j, i] <= 1)
                    cqm.add_constraint(cqm_delta[i, j] + cqm_delta[j, i] <= 1)
                    cqm.add_constraint(
                        cqm_sigma[i, j] + cqm_sigma[j, i] + cqm_delta[i, j] + cqm_delta[j, i] >= 1
                    )

                    eta_max = max(a[i], a[j])
                    for t in T_batch:
                        if t < eta_max:
                            continue
                        cross_ij = []
                        cross_ji = []
                        for g in range(QUAY_CRANES):
                            for g_ in range(g):
                                cross_ij.append(cqm_zeta[g, i, t] * cqm_zeta[g_, j, t])
                            for g_ in range(g + 1, QUAY_CRANES):
                                cross_ji.append(cqm_zeta[g, i, t] * cqm_zeta[g_, j, t])
                        if cross_ij:
                            cqm.add_constraint(sum(cross_ij) + 225 * cqm_delta[i, j] <= 225)
                        if cross_ji:
                            cqm.add_constraint(sum(cross_ji) + 225 * cqm_delta[j, i] <= 225)

        for g in range(QUAY_CRANES):
            for t in T_batch:
                cqm.add_constraint(sum(cqm_zeta[g, i, t] for i in V_plan) <= 1)
            for i in V_plan:
                import math as _m
                eta_i = _m.floor(a[i])
                for t in T_batch:
                    if t < eta_i:
                        cqm.add_constraint(cqm_zeta[g, i, t] == 0)
                    else:
                        cqm.add_constraint(cqm_u[i] + (T - t) * cqm_zeta[g, i, t] <= T)
                        cqm.add_constraint(cqm_c[i] - (t + 1) * cqm_zeta[g, i, t] >= 0)
                        cqm.add_constraint(cqm_v[i] + (ss - RG[g]) * cqm_zeta[g, i, t] <= ss - (s[i] / 2))
                        cqm.add_constraint(cqm_v[i] - LG[g] * cqm_zeta[g, i, t] >= -(s[i] / 2))
                for t in range(min_t + 1, max_t):
                    cqm.add_constraint(cqm_zeta[g, i, t] - cqm_zeta[g, i, t - 1] - cqm_gamma[g, i, t] <= 0)
                    cqm.add_constraint(cqm_gamma[g, i, t] - cqm_zeta[g, i, t] <= 0)
                    cqm.add_constraint(cqm_gamma[g, i, t] + cqm_zeta[g, i, t - 1] <= 1)

        for (g, t) in busy_cranes:
            if t in T_batch:
                for i in V_plan:
                    cqm.add_constraint(cqm_zeta[g, i, t] == 0)

        for past_i, past_info in active_fixed_vessels.items():
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
                cqm.add_constraint(cqm_c[i] + M_TIME * b_left <= past_u - TIME_GAP + M_TIME)
                cqm.add_constraint(cqm_u[i] - M_TIME * b_right >= past_c + TIME_GAP - M_TIME)
                cqm.add_constraint(cqm_v[i] + M_SPACE * b_below <= past_v - s[i] - SPACE_GAP + M_SPACE)
                cqm.add_constraint(cqm_v[i] - M_SPACE * b_above >= past_v + past_s + SPACE_GAP - M_SPACE)

        for past_i, past_info in active_fixed_vessels.items():
            past_v, past_s = past_info['v'], past_info['s']
            for (g_past, t) in past_info['zeta_list']:
                if t in T_batch:
                    for i in V_plan:
                        if t < a[i]:
                            continue
                        for g in range(QUAY_CRANES):
                            if g < g_past:
                                cqm.add_constraint(cqm_v[i] + M_SPACE * cqm_zeta[g, i, t] <= past_v - s[i] + M_SPACE)
                            elif g > g_past:
                                cqm.add_constraint(cqm_v[i] - M_SPACE * cqm_zeta[g, i, t] >= past_v + past_s - M_SPACE)

        print(f"📡 D-Wave 쿼리 전송 (초기 해 탐색, Time Limit: {cqm_time_limit}s)")
        sampleset = sampler.sample_cqm(cqm, time_limit=cqm_time_limit)
        feasible_samples = sampleset.filter(lambda row: row.is_feasible)

        best_sample = None
        if len(feasible_samples) > 0:
            best_sample = feasible_samples.first.sample
            print(f"✅ D-Wave 해 탐색 완료 (Energy: {feasible_samples.first.energy:.2f})")
        else:
            print("⚠️ D-Wave 유효해 실패. Gurobi가 처음부터 탐색.")

        # =============================================================
        # PHASE 2: Gurobi 정밀 최적화 (MIP Start 적용)
        # =============================================================
        print("\n[PHASE 2] Gurobi 정밀 최적화")
        model = gp.Model(f"BACAP_Hybrid_{iteration}")
        model.setParam('OutputFlag', 1)
        model.setParam('TimeLimit', gurobi_time_limit)
        model.setParam('MIPFocus', 1)

        u_gb = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="u")
        v_gb = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="v")
        c_gb = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="c")
        sigma_gb = model.addVars(V_plan, V_plan, vtype=GRB.BINARY, name="sigma")
        delta_gb = model.addVars(V_plan, V_plan, vtype=GRB.BINARY, name="delta")
        gamma_gb = model.addVars(QUAY_CRANES, V_plan, T_batch, vtype=GRB.BINARY, name="gamma")
        zeta_gb = model.addVars(QUAY_CRANES, V_plan, T_batch, vtype=GRB.BINARY, name="zeta")

        model.setObjective(gp.quicksum(w[i] * (c_gb[i] - a[i]) for i in V_plan), GRB.MINIMIZE)

        for i in V_plan:
            model.addConstr(u_gb[i] >= a[i])
            model.addConstr(c_gb[i] <= T)
            model.addConstr(c_gb[i] >= u_gb[i] + 1)
            model.addConstr(v_gb[i] >= 0)
            model.addConstr(v_gb[i] + s[i] <= ss)
            model.addConstr(
                gp.quicksum(SERVICE_RATE * zeta_gb[g, i, t]
                            for g in range(QUAY_CRANES) for t in T_batch) >= Containers[i]
            )
            for t in T_batch:
                model.addConstr(
                    gp.quicksum(zeta_gb[g, i, t] for g in range(QUAY_CRANES)) <= Cmax[i]
                )

        for idx1, i in enumerate(V_plan):
            for idx2, j in enumerate(V_plan):
                if idx1 < idx2:
                    model.addConstr(u_gb[j] - c_gb[i] + M_TIME * (1 - sigma_gb[i, j]) >= TIME_GAP)
                    model.addConstr(u_gb[i] - c_gb[j] + M_TIME * (1 - sigma_gb[j, i]) >= TIME_GAP)
                    model.addConstr(v_gb[j] - v_gb[i] - s[i] + M_SPACE * (1 - delta_gb[i, j]) >= SPACE_GAP)
                    model.addConstr(v_gb[i] - v_gb[j] - s[j] + M_SPACE * (1 - delta_gb[j, i]) >= SPACE_GAP)
                    model.addConstr(sigma_gb[i, j] + sigma_gb[j, i] <= 1)
                    model.addConstr(delta_gb[i, j] + delta_gb[j, i] <= 1)
                    model.addConstr(
                        sigma_gb[i, j] + sigma_gb[j, i] + delta_gb[i, j] + delta_gb[j, i] >= 1
                    )

                    for t in T_batch:
                        for g in range(QUAY_CRANES):
                            for g_ in range(g):
                                model.addConstr(zeta_gb[g, i, t] + zeta_gb[g_, j, t] <= 2 - delta_gb[i, j])
                            for g_ in range(g + 1, QUAY_CRANES):
                                model.addConstr(zeta_gb[g, i, t] + zeta_gb[g_, j, t] <= 2 - delta_gb[j, i])

        for g in range(QUAY_CRANES):
            for t in T_batch:
                model.addConstr(gp.quicksum(zeta_gb[g, i, t] for i in V_plan) <= 1)
            for i in V_plan:
                for t in T_batch:
                    model.addConstr(u_gb[i] <= t * zeta_gb[g, i, t] + (1 - zeta_gb[g, i, t]) * T)
                    model.addConstr(c_gb[i] >= (t + 1) * zeta_gb[g, i, t])
                    model.addConstr(v_gb[i] + (s[i] / 2) <= RG[g] * zeta_gb[g, i, t] + (1 - zeta_gb[g, i, t]) * ss)
                    model.addConstr(v_gb[i] + (s[i] / 2) >= LG[g] * zeta_gb[g, i, t])
                for t in range(min_t + 1, max_t):
                    model.addConstr(zeta_gb[g, i, t] - zeta_gb[g, i, t - 1] <= gamma_gb[g, i, t])
                    model.addConstr(gamma_gb[g, i, t] <= zeta_gb[g, i, t])
                    model.addConstr(gamma_gb[g, i, t] <= 1 - zeta_gb[g, i, t - 1])

        for (g, t) in busy_cranes:
            if t in T_batch:
                for i in V_plan:
                    model.addConstr(zeta_gb[g, i, t] == 0)

        for past_i, past_info in active_fixed_vessels.items():
            past_u, past_c = past_info['u'], past_info['c']
            past_v, past_s = past_info['v'], past_info['s']
            for i in V_plan:
                b_left = model.addVar(vtype=GRB.BINARY)
                b_right = model.addVar(vtype=GRB.BINARY)
                b_below = model.addVar(vtype=GRB.BINARY)
                b_above = model.addVar(vtype=GRB.BINARY)
                model.addConstr(b_left + b_right + b_below + b_above >= 1)
                model.addConstr(c_gb[i] + TIME_GAP <= past_u + M_TIME * (1 - b_left))
                model.addConstr(u_gb[i] >= past_c + TIME_GAP - M_TIME * (1 - b_right))
                model.addConstr(v_gb[i] + s[i] + SPACE_GAP <= past_v + M_SPACE * (1 - b_below))
                model.addConstr(v_gb[i] >= past_v + past_s + SPACE_GAP - M_SPACE * (1 - b_above))

        for past_i, past_info in active_fixed_vessels.items():
            past_v, past_s = past_info['v'], past_info['s']
            for (g_past, t) in past_info['zeta_list']:
                if t in T_batch:
                    for i in V_plan:
                        for g in range(QUAY_CRANES):
                            if g < g_past:
                                model.addConstr(v_gb[i] + s[i] <= past_v + M_SPACE * (1 - zeta_gb[g, i, t]))
                            elif g > g_past:
                                model.addConstr(v_gb[i] >= past_v + past_s - M_SPACE * (1 - zeta_gb[g, i, t]))

        # MIP Start: D-Wave 해를 Gurobi 변수에 매핑
        if best_sample is not None:
            print("💉 D-Wave 해를 Gurobi MIP Start로 매핑")
            for i in V_plan:
                if f"u_{i}" in best_sample:
                    u_gb[i].Start = best_sample[f"u_{i}"]
                if f"v_{i}" in best_sample:
                    v_gb[i].Start = best_sample[f"v_{i}"]
                if f"c_{i}" in best_sample:
                    c_gb[i].Start = best_sample[f"c_{i}"]
                for j in V_plan:
                    if i != j:
                        if f"sigma_{i}_{j}" in best_sample:
                            sigma_gb[i, j].Start = best_sample[f"sigma_{i}_{j}"]
                        if f"delta_{i}_{j}" in best_sample:
                            delta_gb[i, j].Start = best_sample[f"delta_{i}_{j}"]
                for g in range(QUAY_CRANES):
                    for t in T_batch:
                        if f"zeta_{g}_{i}_{t}" in best_sample:
                            zeta_gb[g, i, t].Start = best_sample[f"zeta_{g}_{i}_{t}"]
                        if f"gamma_{g}_{i}_{t}" in best_sample:
                            gamma_gb[g, i, t].Start = best_sample[f"gamma_{g}_{i}_{t}"]

        model.optimize()

        # =============================================================
        # PHASE 3: Fixing
        # =============================================================
        if model.status in [GRB.OPTIMAL, GRB.TIME_LIMIT] and model.SolCount > 0:
            print(f"✅ Gurobi 정밀 해 탐색 완료 (목적함수: {model.ObjVal:.2f})")
            last_obj = float(model.ObjVal)
            fixed_count = 0
            is_last_batch = (len(fixed_vessels) + len(V_plan) == len(all_vessels))

            for i in V_plan:
                if a[i] < current_time + H_ROLL or is_last_batch:
                    u_val, c_val, v_val = u_gb[i].X, c_gb[i].X, v_gb[i].X
                    zeta_list = [
                        (g, t) for g in range(QUAY_CRANES) for t in T_batch
                        if zeta_gb[g, i, t].X > 0.5
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
                        '비고': '하이브리드(D-Wave+Gurobi)',
                    })
                    fixed_count += 1
            print(f"🔒 {fixed_count}/{len(V_plan)}척 확정.")
        else:
            print(f"⚠️ Iteration {iteration} 실패 (Status: {model.status}). 다음 윈도우로 이월.")

        current_time += H_ROLL
        iteration += 1

    elapsed = time.time() - total_start_time
    print(f"\n🏁 하이브리드 시뮬레이션 종료 (총 {elapsed:.2f}초)")
    return opt_results, last_obj
