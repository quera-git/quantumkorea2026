FROM python:3.11-slim

WORKDIR /app

# uv 설치 (pyproject.toml 기반 의존성 설치용)
RUN pip install --no-cache-dir uv

# 의존성 먼저 설치 (Docker 레이어 캐시 활용)
COPY backend/pyproject.toml ./pyproject.toml
RUN uv pip compile pyproject.toml -o requirements.txt && \
    uv pip install --system --no-cache -r requirements.txt && \
    rm requirements.txt

# 소스 복사: shared/ 와 backend/app/ 모두 /app 하위로
COPY shared/ ./shared/
COPY backend/app/ ./app/

# /app이 cwd이므로 `import shared.schema`, `import app.main` 모두 가능
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
