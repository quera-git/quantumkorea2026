# Quantum Port Optimizer

항만 물류(선석 배정 등) 양자 최적화 시스템의 웹 인터페이스.
3티어 컨테이너 격리로 양자 토큰을 보호한다.

## 구조

```
frontend (React/Vite/TS)  ──HTTP──▶  backend (FastAPI/SQLite)  ──HTTP──▶  worker (D-Wave + Gurobi)
   :8080 (호스트)                       :8000 (호스트, 개발용)               :9000 (내부 전용)
```

토큰/라이선스는 `worker` 컨테이너에만 주입된다. 자세한 규칙은 [`AGENTS.md`](./AGENTS.md) 참조.

---

## 셋업

### 1. D-Wave Leap 토큰 발급
- https://cloud.dwavesys.com/leap/ 에서 가입 → API 토큰 복사.

### 2. `.env` 파일 작성
```bash
cp .env.example .env
# .env 를 열어 DWAVE_API_TOKEN 값을 채운다
```

### 3. Gurobi 라이선스 배치
- 학술 라이선스(WLS 또는 named-user) 파일 `gurobi.lic`을 발급받아 `secrets/gurobi.lic` 경로에 둔다.
```bash
# 예시
cp ~/Downloads/gurobi.lic secrets/gurobi.lic
```
- `secrets/*.lic`는 gitignored 이므로 저장소에는 들어가지 않는다.

### 4. 컨테이너 빌드 & 실행
```bash
docker compose up --build
```

### 5. 접속
- Frontend: http://localhost:8080
- Backend Swagger UI: http://localhost:8000/docs
- Worker는 호스트에 노출되지 않으며, 같은 docker network의 `backend`에서만 호출 가능하다.

---

## 개발

각 서비스 디렉토리에서 로컬 실행도 가능하다. (도커 외부 개발 시 `shared/`를 PYTHONPATH에 추가해야 함)

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

---

## 보안 체크리스트

- [ ] `.env`가 `.gitignore`에 포함되어 있는가
- [ ] `secrets/gurobi.lic`이 git에 추적되지 않는가
- [ ] `worker` 서비스에 `ports:` 매핑이 없는가
- [ ] frontend/backend 컨테이너에 `DWAVE_API_TOKEN`이 주입되지 않는가
- [ ] 토큰이 로그/응답에 출력되지 않는가
