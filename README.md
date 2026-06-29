# Quantum Port Optimizer

부산항 신항 컨테이너 터미널의 선석 배정·크레인 할당 (BACAP) 문제를 **양자(D‑Wave CQM) + 고전(Gurobi MIP) 하이브리드** 로 푸는 의사결정 지원 시스템.

**Quantum Korea 2026 부스 데모** (2026‑07‑02 ~ 07‑04) 용 React 프론트엔드 + 3‑티어 백엔드.

> 데모 라이브 URL — Vercel (`quera-git/quantumkorea2026` 의 main 브랜치 자동 배포, frontend-only)

---

## 1. 빠른 둘러보기 (데모 모드)

`VITE_DEMO_MODE=1` 로 빌드된 정적 사이트만으로 모든 시나리오·솔버 결과를 확인할 수 있다. 백엔드 / D‑Wave 토큰 / Gurobi 라이선스 **없이** 동작.

### 데모에서 보여지는 것

3 시나리오 × 5 결과 = **15 케이스** 가 첫 로드 시 자동 등록된다.

| 시나리오 | 입력 | 특징 | 척 수 |
|---------|------|-----|------|
| #1 | BPT_Result | 일반 운영 (BPTC 운영자 결과 없음) | 62 |
| #2 | Before 0313 14:30 | 낮시간 혼잡 | 58 |
| #3 | Before 0316 08:00 | 크레인 부족 | 58 |

각 시나리오마다 4 솔버: **CQM(양자) / Hybrid / Gurobi / 운영자(실측)**

### 데모 워크플로

1. **시나리오** 탭 — 입력 데이터 (Gantt) 확인. 칩 클릭으로 시나리오 전환.
2. **4‑way 비교** 탭 — 한 시나리오의 4 솔버 결과를 2×2 그리드로 동시 비교.
   - 각 셀: `총 체류시간 / 계산시간 / 위반 건수` + Gantt (위반 = 빨강, 정상 = 초록)
   - 운영자 데이터 없음 → `"BPTC 측 실제 데이터가 없습니다"`
   - 솔버 실패 (#1 Gurobi) → `"풀이 실패"`
   - 📌 핀 버튼 — 해당 결과를 **시나리오 pill 에 추가** → 편집/검증 탭에서 만질 수 있음.
3. **편집** 탭 — pill 로 선택한 결과의 행 수정 / 추가 / 삭제. 재검증.
4. **검증** 탭 — 12 종 제약 (Clearance / Crane / Window / Tide / 등) 위반 목록.

---

## 2. 시스템 아키텍처

```
┌──────────┐  HTTP   ┌──────────┐  HTTP   ┌──────────┐
│ frontend │ ──────▶ │ backend  │ ──────▶ │  worker  │
│ React/TS │ :8080   │ FastAPI  │ :8000   │ FastAPI  │
│ Vite     │         │ SQLite   │         │ D-Wave + │
│          │         │ BPTC 크롤│         │  Gurobi  │
└──────────┘         └──────────┘         └──────────┘
                                               △
                                          토큰/라이선스만
                                          이 컨테이너에 주입
```

| 컨테이너 | 토큰 | 호스트 노출 |
|---|---|---|
| `frontend` | ❌ | :8080 |
| `backend` | ❌ | :8000 |
| `worker` | ✅ D‑Wave + Gurobi | ❌ (내부 전용) |

`worker` 는 같은 docker network 내 `backend` 만 호출 가능. 자세한 규칙은 [`AGENTS.md`](./AGENTS.md).

---

## 3. 로컬 풀스택 셋업 (양자 풀이 실측)

### 3.1. D‑Wave Leap 토큰
https://cloud.dwavesys.com/leap → API 토큰 복사.

### 3.2. `.env` 작성
```bash
cp .env.example .env
# DWAVE_API_TOKEN=... 채움
```

### 3.3. Gurobi 라이선스
학술 WLS / named‑user 라이선스를 `secrets/gurobi.lic` 에 둔다.
```bash
cp ~/Downloads/gurobi.lic secrets/gurobi.lic
```
`.env`, `secrets/*.lic` 모두 **gitignored**.

### 3.4. 기동
```bash
docker compose up --build
```
- Frontend: http://localhost:8080
- Backend Swagger: http://localhost:8000/docs

### 3.5. 데모 모드로 로컬 실행 (백엔드 없이)
```bash
cd frontend
echo "VITE_DEMO_MODE=1" > .env.local
npm install
npm run dev
# http://localhost:5173
```

---

## 4. Vercel 배포 — **남은 설정 1가지**

저장소 `quera-git/quantumkorea2026` 의 `main` 브랜치 push 마다 자동 배포되도록 이미 연결돼 있다. 신규 Vercel 프로젝트 생성 시 또는 환경변수 누락 시 다음을 확인:

### Project Settings → Build & Development

| 항목 | 값 |
|---|---|
| **Framework Preset** | `Vite` |
| **Root Directory** | `frontend` |
| **Build Command** | `npm run build` (기본값) |
| **Output Directory** | `dist` (기본값) |
| **Install Command** | `npm install` (기본값) |

### Project Settings → Environment Variables ⚠️ (이게 남은 그거)

| Name | Value | Environments |
|---|---|---|
| `VITE_DEMO_MODE` | `1` | Production + Preview + Development |

이거 안 깔아두면 빌드는 되지만 BPTC 라이브 패널·BPT 직접 워크플로 NAV 가 보이고 (백엔드 없으니) 모두 fail. 반드시 `1` 로 설정.

설정 후 **Redeploy** (가장 최근 빌드 옆 ⋯ → Redeploy) 한 번 눌러주면 환경변수가 반영된다.

> 토큰류 (`DWAVE_API_TOKEN`, `gurobi.lic`) 는 Vercel 에 **절대 넣지 않는다**. 데모 모드는 사전 계산된 결과 (`frontend/public/demo/*.payload.json`) 만 사용.

---

## 5. 개발

각 서비스 디렉토리에서 로컬 실행도 가능 (도커 밖에서는 `shared/` 를 PYTHONPATH 에 추가).

```bash
# backend
cd backend && uv venv && uv pip install -e . && \
  PYTHONPATH=.. uvicorn app.main:app --reload --port 8000

# worker
cd worker && uv venv && uv pip install -e . && \
  PYTHONPATH=.. uvicorn app.main:app --reload --port 9000

# frontend
cd frontend && npm install && npm run dev
```

### 데모용 시나리오 재생성

`frontend/Figure/Optimized_*.xlsx` 가 갱신되면:
```bash
cd frontend && node scripts/convert-figure-results.mjs
# → frontend/public/demo/scenario-*.payload.json 15 개 재생성
```

---

## 6. 보안 체크리스트

- [ ] `.env` 가 `.gitignore` 에 포함되어 있는가
- [ ] `secrets/gurobi.lic` 이 git 에 추적되지 않는가 (`git ls-files secrets/` 비어야 함)
- [ ] `worker` 서비스에 `ports:` 매핑이 없는가
- [ ] `frontend` / `backend` 컨테이너에 `DWAVE_API_TOKEN` 이 주입되지 않는가
- [ ] 토큰이 로그 / 응답에 출력되지 않는가
- [ ] Vercel 환경변수에 토큰이 추가되지 않았는가 (`VITE_DEMO_MODE` 만 있어야 함)

---

## 7. 라이선스 / 인용

- 부산대학교 양자정보컴퓨팅 연구실 — Quantum Korea 2026 부스 데모
- 보고서: `Quantum Korea 2026 — 부산항 신항 BACAP 양자 최적화` (§4.2 표 4.2 의 obj/elapsed 수치를 데모 UI 가 참조)
