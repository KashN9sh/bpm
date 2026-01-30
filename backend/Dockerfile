FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY src/ ./src/
COPY alembic.ini ./
COPY alembic/ ./alembic/

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1

EXPOSE 8000

CMD ["sh", "-c", "PYTHONPATH=/app alembic upgrade head && PYTHONPATH=/app/src exec uvicorn main:app --host 0.0.0.0 --port 8000"]
