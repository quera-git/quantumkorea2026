FROM python:3.11-slim

WORKDIR /app

# Gurobi/dwave-ocean-sdk 빌드에 필요한 최소 시스템 패키지
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir uv

COPY worker/pyproject.toml ./pyproject.toml
RUN uv pip compile pyproject.toml -o requirements.txt && \
    uv pip install --system --no-cache -r requirements.txt && \
    rm requirements.txt

COPY shared/ ./shared/
COPY worker/app/ ./app/

# 9000은 docker-compose.yml의 expose만으로 같은 네트워크 내 backend에서만 접근.
# 호스트(외부)에는 절대 노출되지 않는다 (AGENTS.md §3).
EXPOSE 9000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "9000"]
