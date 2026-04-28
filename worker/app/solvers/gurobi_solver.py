"""Gurobi MIP 기반 BACAP(선석 배정 + 크레인 할당) 롤링 호라이즌 솔버.

worker-origin/OnlyGurobi_Final.ipynb의 본문을 함수로 옮긴 것이며,
변수 이름과 알고리즘 골격은 원본을 그대로 유지한다. 시각화/엑셀 IO는
worker 책임이 아니므로 제거되었다.
"""
from __future__ import annotations

import time
from typing import Any

import gurobipy as gp
import pandas as pd
from gurobipy import GRB

from app.solvers.common import (
    H_PLAN, H_ROLL, LG, M_SPACE, M_TIME, QUAY_CRANES, RG, SERVICE_RATE,
    SPACE_GAP, T, TIME_GAP, compute_cmax, freeze_initial_window,
    prepare_dataframe, ss,
)


def solve(
    df: pd.DataFrame,
    planning_start_time: float = 80,
    time_limit: int = 300,
    mip_gap: float = 0.05,
) -> tuple[list[dict[str, Any]], float | None]:
    """Gurobi 단독 롤링 호라이즌 최적화.

    Args:
        df: 'BPT_Result.xlsx' 형식의 원본 DataFrame
        planning_start_time: 시뮬레이션 기준 시점(시간)
        time_limit: 각 iteration당 Gurobi TimeLimit
        mip_gap: Gurobi MIPGap

    Returns:
        (opt_results, total_objective)
        opt_results: 모선항차/Length/ETA_int/ETB_int/ETD_int/접안위치(F)/비고
        total_objective: 마지막 iteration의 목적함수 값 (없으면 None)
    """
    print("\n[데이터 준비 및 파라미터 초기화]")

    df_gurobi = prepare_dataframe(df)
    all_vessels = df_gurobi.index.tolist()

    s = df_gurobi['Length'].to_dict()
    a = df_gurobi['ETA_int'].to_dict()
    w = {i: 1 for i in all_vessels}
    Containers = df_gurobi['Containers'].to_dict()
    Cmax = {i: compute_cmax(s[i]) for i in all_vessels}

    # =================================================================
    # 초기 윈도우 freeze
    # =================================================================
    print(f"\n[기준 시점: {planning_start_time}시] 초기 12시간 스케줄 고정 (Gurobi)")
    fixed_vessels, busy_cranes, opt_results = freeze_initial_window(
        df_gurobi, planning_start_time
    )
    print(f"\n🔒 {len(fixed_vessels)}척 고정 완료.")

    # =================================================================
    # Rolling Horizon
    # =================================================================
    max_eta = df_gurobi['ETA_int'].max()
    current_time = planning_start_time
    total_start_time = time.time()
    iteration = 1
    last_obj: float | None = None

    while current_time <= max_eta:
        V_plan = [
            i for i in all_vessels
            if a[i] < current_time + H_PLAN and i not in fixed_vessels
        ]
        if not V_plan:
            current_time += H_ROLL
            continue

        print("\n" + "=" * 60)
        print(f"🔄 [Iteration {iteration}] Time Window: {current_time} ~ {current_time + H_PLAN}")
        print(f"📦 대상 선박 ({len(V_plan)}척): {V_plan}")

        model = gp.Model(f"BACAP_Rolling_{iteration}")
        model.setParam('OutputFlag', 1)
        model.setParam('TimeLimit', time_limit)
        model.setParam('MIPFocus', 1)
        model.setParam('MIPGap', mip_gap)

        u_var = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="u")
        v_var = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="v")
        c_var = model.addVars(V_plan, vtype=GRB.CONTINUOUS, lb=0, name="c")

        sigma_var = model.addVars(V_plan, V_plan, vtype=GRB.BINARY, name="sigma")
        delta_var = model.addVars(V_plan, V_plan, vtype=GRB.BINARY, name="delta")

        min_t = int(min(a[i] for i in V_plan))
        max_t = int(min(T, current_time + H_PLAN + 48))
        T_batch = range(min_t, max_t)

        gamma_vars = model.addVars(QUAY_CRANES, V_plan, T_batch, vtype=GRB.BINARY, name="gamma")
        zeta_vars = model.addVars(QUAY_CRANES, V_plan, T_batch, vtype=GRB.BINARY, name="zeta")

        model.setObjective(
            gp.quicksum(w[i] * (c_var[i] - a[i]) for i in V_plan), GRB.MINIMIZE
        )

        # --- V_plan 내부 제약 ---
        for i in V_plan:
            model.addConstr(u_var[i] >= a[i])
            model.addConstr(c_var[i] <= T)
            model.addConstr(c_var[i] >= u_var[i] + 1)
            model.addConstr(v_var[i] >= 0)
            model.addConstr(v_var[i] + s[i] <= ss)

            model.addConstr(
                gp.quicksum(SERVICE_RATE * zeta_vars[g, i, t]
                            for g in range(QUAY_CRANES) for t in T_batch)
                >= Containers[i]
            )
            for t in T_batch:
                model.addConstr(
                    gp.quicksum(zeta_vars[g, i, t] for g in range(QUAY_CRANES)) <= Cmax[i]
                )

        for idx1, i in enumerate(V_plan):
            for idx2, j in enumerate(V_plan):
                if idx1 < idx2:
                    model.addConstr(u_var[j] - c_var[i] + M_TIME * (1 - sigma_var[i, j]) >= TIME_GAP)
                    model.addConstr(u_var[i] - c_var[j] + M_TIME * (1 - sigma_var[j, i]) >= TIME_GAP)

                    model.addConstr(v_var[j] - v_var[i] - s[i] + M_SPACE * (1 - delta_var[i, j]) >= SPACE_GAP)
                    model.addConstr(v_var[i] - v_var[j] - s[j] + M_SPACE * (1 - delta_var[j, i]) >= SPACE_GAP)

                    model.addConstr(sigma_var[i, j] + sigma_var[j, i] <= 1)
                    model.addConstr(delta_var[i, j] + delta_var[j, i] <= 1)
                    model.addConstr(
                        sigma_var[i, j] + sigma_var[j, i] + delta_var[i, j] + delta_var[j, i] >= 1
                    )

                    # 크레인 교차 방지 양방향 적용
                    for t in T_batch:
                        for g in range(QUAY_CRANES):
                            for g_ in range(g):
                                model.addConstr(zeta_vars[g, i, t] + zeta_vars[g_, j, t] <= 2 - delta_var[i, j])
                            for g_ in range(g + 1, QUAY_CRANES):
                                model.addConstr(zeta_vars[g, i, t] + zeta_vars[g_, j, t] <= 2 - delta_var[j, i])

        for g in range(QUAY_CRANES):
            for t in T_batch:
                model.addConstr(gp.quicksum(zeta_vars[g, i, t] for i in V_plan) <= 1)

            for i in V_plan:
                for t in T_batch:
                    model.addConstr(u_var[i] <= t * zeta_vars[g, i, t] + (1 - zeta_vars[g, i, t]) * T)
                    model.addConstr(c_var[i] >= (t + 1) * zeta_vars[g, i, t])

                    model.addConstr(v_var[i] + s[i] <= RG[g] * zeta_vars[g, i, t] + (1 - zeta_vars[g, i, t]) * ss)
                    model.addConstr(v_var[i] >= LG[g] * zeta_vars[g, i, t])

                for t in range(min_t + 1, max_t):
                    model.addConstr(zeta_vars[g, i, t] - zeta_vars[g, i, t - 1] <= gamma_vars[g, i, t])
                    model.addConstr(gamma_vars[g, i, t] <= zeta_vars[g, i, t])
                    model.addConstr(gamma_vars[g, i, t] <= 1 - zeta_vars[g, i, t - 1])

        # --- 과거 확정 선박과의 상호작용 ---
        for (g, t) in busy_cranes:
            if t in T_batch:
                for i in V_plan:
                    model.addConstr(zeta_vars[g, i, t] == 0)

        for past_i, past_info in fixed_vessels.items():
            past_u, past_c = past_info['u'], past_info['c']
            past_v, past_s = past_info['v'], past_info['s']
            for i in V_plan:
                b_left = model.addVar(vtype=GRB.BINARY)
                b_right = model.addVar(vtype=GRB.BINARY)
                b_below = model.addVar(vtype=GRB.BINARY)
                b_above = model.addVar(vtype=GRB.BINARY)

                model.addConstr(b_left + b_right + b_below + b_above >= 1)
                model.addConstr(c_var[i] + TIME_GAP <= past_u + M_TIME * (1 - b_left))
                model.addConstr(u_var[i] >= past_c + TIME_GAP - M_TIME * (1 - b_right))
                model.addConstr(v_var[i] + s[i] + SPACE_GAP <= past_v + M_SPACE * (1 - b_below))
                model.addConstr(v_var[i] >= past_v + past_s + SPACE_GAP - M_SPACE * (1 - b_above))

        for past_i, past_info in fixed_vessels.items():
            past_v = past_info['v']
            past_s = past_info['s']
            for (g_past, t) in past_info['zeta_list']:
                if t in T_batch:
                    for i in V_plan:
                        for g in range(QUAY_CRANES):
                            if g < g_past:
                                model.addConstr(v_var[i] + s[i] <= past_v + M_SPACE * (1 - zeta_vars[g, i, t]))
                            elif g > g_past:
                                model.addConstr(v_var[i] >= past_v + past_s - M_SPACE * (1 - zeta_vars[g, i, t]))

        # --- 최적화 수행 ---
        model.optimize()

        # --- Fixing Phase ---
        if model.status in [GRB.OPTIMAL, GRB.TIME_LIMIT] and model.SolCount > 0:
            print(f"✅ 유효해 탐색 완료! (목적함수: {model.ObjVal:.2f})")
            last_obj = float(model.ObjVal)

            fixed_count = 0
            for i in V_plan:
                if a[i] < current_time + H_ROLL or (current_time + H_ROLL > max_eta):
                    zeta_list: list[tuple[int, int]] = []
                    for g in range(QUAY_CRANES):
                        for t in T_batch:
                            if zeta_vars[g, i, t].X > 0.5:
                                zeta_list.append((g, t))
                                busy_cranes.add((g, t))

                    fixed_vessels[i] = {
                        'u': u_var[i].X, 'c': c_var[i].X, 'v': v_var[i].X,
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
                        'ETB_int': round(u_var[i].X, 4),
                        'ETD_int': round(c_var[i].X, 4),
                        '접안위치(F)': round(v_var[i].X, 4),
                        '비고': 'Gurobi 최적화',
                    })
                    fixed_count += 1
            print(f"🔒 {fixed_count}/{len(V_plan)} 척 확정.")
        else:
            print(f"❌ Iteration {iteration} 실패 (Status: {model.status}). 종료.")
            break

        current_time += H_ROLL
        iteration += 1

    elapsed = time.time() - total_start_time
    print(f"\n🏁 Gurobi 시뮬레이션 종료 (총 {elapsed:.2f}초)")
    return opt_results, last_obj
