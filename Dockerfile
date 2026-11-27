FROM python:3.12-slim

WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 ATALAYA_DB=/data/atalaya.db

COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

COPY backend backend
COPY web web
RUN python web/build.py

WORKDIR /app/backend
VOLUME ["/data"]
EXPOSE 8000
CMD ["uvicorn", "atalaya.api:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers"]
