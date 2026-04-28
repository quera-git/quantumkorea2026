# AGENTS.md — 프로젝트 작업 규칙

이 문서는 Claude/AI 에이전트와 사람 기여자 모두가 따라야 할 규칙을 정의한다.
모든 변경은 이 문서의 원칙을 준수해야 한다.

---

## 1. 아키텍처 개요

3티어 컨테이너 격리 구조:

| 컨테이너 | 역할 | 토큰/라이선스 보유 | 호스트 노출 |
|----------|------|-------------------|------------|
| `frontend` | React UI (Vite + TS) | ❌ | 8080 |
| `backend`  | FastAPI, BPT/SQLite/조회 | ❌ | 8000 (개발 편의) |
| `worker`   | FastAPI, 양자 최적화 전용 | ✅ D-Wave + Gurobi | ❌ (expose만) |

`worker`는 같은 docker network 내부의 `backend`로부터만 호출되며 외부 호스트에는 절대 노출되지 않는다.

---

## 2. 기술 스택

### Backend / Worker (Python 3.11)
- FastAPI, Uvicorn
- Pydantic v2
- SQLAlchemy 2 + aiosqlite (backend 전용)
- httpx (backend → worker HTTP 클라이언트)
- dwave-ocean-sdk, gurobipy (worker 전용)
- 패키지 매니저: **uv**

### Frontend (Node 20)
- React 18, Vite, TypeScript (strict)
- axios (HTTP 클라이언트)
- plotly.js / react-plotly.js (Gantt 차트)

---

## 3. 절대 금지 사항 (보안)

> 위반 시 토큰/라이선스 유출로 직결. PR 단계에서 거부 사유.

- ❌ **D-Wave 토큰을 frontend나 backend 컨테이너의 환경변수, 코드, 설정 파일에 두지 말 것.**
  토큰은 오직 `worker` 컨테이너에서만 접근 가능해야 한다.
- ❌ **Gurobi 라이선스 파일(`gurobi.lic`)을 worker 외 컨테이너에 마운트하지 말 것.**
- ❌ **토큰/라이선스 값을 로그, HTTP 응답, 에러 메시지에 출력하지 말 것.**
  존재 여부(불리언)만 로깅 허용.
- ❌ **worker 컨테이너에 `ports:` 매핑을 추가하지 말 것.** `expose:`만 사용한다.
- ❌ **Celery / Redis / Kafka / RabbitMQ 등 외부 메시지 큐를 도입하지 말 것.**
  현 규모에서는 backend ↔ worker 간 동기 HTTP(httpx)로 충분하며, 인프라 복잡도와 토큰 노출면을 늘리지 않는다.
- ❌ `.env`, `secrets/*.lic` 등을 git에 커밋하지 말 것.

---

## 4. 모듈 경계 규칙

### 4.1 데이터 교환 스키마
- backend ↔ worker 간 모든 요청/응답 DTO는 **`shared/schema.py`의 Pydantic 모델**을 사용한다.
- `shared/`는 두 컨테이너의 Dockerfile에서 각각 `COPY shared/ ./shared/`로 복사된다 (별도 패키지 배포 X).
- 스키마 변경 시 frontend의 `frontend/src/types/schema.ts`도 함께 갱신해야 한다.
- 추후 `openapi-typescript`로 자동 생성 도입 검토.

### 4.2 Frontend 호출 규칙
- ✅ 모든 backend 호출은 **`frontend/src/api/client.ts`의 단일 axios 인스턴스**를 통해서만 수행한다.
- ❌ 컴포넌트나 페이지에서 직접 `fetch()` / `axios.get()` 호출 금지.
- 이유: baseURL, 타임아웃, 인터셉터, 에러 처리 정책의 일관성 확보.

### 4.3 Backend → Worker 호출 규칙
- ✅ backend의 worker 호출은 **`backend/app/services/worker_client.py`**의 함수만을 통해 수행한다.
- ❌ 라우터에서 `httpx`를 직접 import해서 worker URL을 호출하지 말 것.
- 이유: 타임아웃/재시도/에러 변환 정책의 단일 진입점 유지, 토큰 누출 면 최소화.

### 4.4 라우터 규칙
- ✅ 모든 FastAPI 라우터 핸들러는 `try / except`로 감싸고, 예외 발생 시 의미에 맞는 HTTP status code로 변환하여 `HTTPException`을 던진다.
  - 클라이언트 입력 오류: 400 (Bad Request) / 422 (Unprocessable Entity, Pydantic이 자동 처리)
  - 인증 실패: 401 / 403
  - 리소스 없음: 404
  - upstream(worker) 실패: 502 (Bad Gateway) / 503 (Service Unavailable)
  - 내부 오류: 500 (Internal Server Error) — 단, 예외 메시지에 토큰/스택을 노출하지 말 것
- ✅ `logger.exception(...)`으로 스택트레이스를 서버 로그에는 남기되, 응답 본문에는 안전한 메시지만 포함한다.

### 4.5 외부 호출 함수
- 외부 시스템(D-Wave Leap, Gurobi 라이선스 서버, worker, DB 등)을 호출하는 모든 함수는 `try / except + logging`을 갖추어야 한다.

---

## 5. 코드 스타일

- 한글 주석 / docstring 환영. 도메인 용어(선석, 본선처리, BPT 등)는 한글 그대로 사용.
- 코드 식별자(변수/함수/클래스명)는 영어로.
- Python: type hint 필수, Pydantic 모델 우선.
- TypeScript: `strict: true`, `any` 사용 지양.
- Docker: 멀티스테이지 빌드 사용, 이미지 크기 최소화.

---

## 6. 디렉토리 책임

```
frontend/   — UI만. 도메인 로직/계산 금지 (표시 계산은 OK).
backend/    — BPT 입력 검증, SQLite 영속화, worker 위임, 결과 조회 API.
worker/     — 양자/MIP 최적화 전용. DB 직접 접근 금지(상태는 응답으로 반환).
shared/     — Pydantic DTO만. 비즈니스 로직 두지 말 것.
secrets/    — gitignored. 사용자가 직접 파일 배치.
```

---

## 7. 추후 통합 예정

- `worker/app/solvers/dwave_solver.py`, `gurobi_solver.py`에 기존 양자 최적화 코드를 통합한다.
- 통합 시에도 위 규칙(특히 §3, §4.3)을 위배하지 않도록 한다.
