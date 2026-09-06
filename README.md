# AI-Based Intelligent Examination Platform with Automated Proctoring

A secure, modular, full-stack online examination platform featuring client-side computer vision proctoring, server-authoritative timed testing, deterministic question paper randomization, objective auto-evaluation, LLM-based subjective answer grading, and handwritten answer OCR with examiner canvas annotation.

---

## Architecture Overview

```
ai-exam-proctor-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI application & lifespan management
│   │   ├── config.py                # Pydantic v2 application settings
│   │   ├── database.py              # Async SQLAlchemy 2.0 engine & session maker
│   │   ├── models/                  # SQLAlchemy models (User, Question, Exam, Session, Proctor, Result)
│   │   ├── schemas/                 # Pydantic request/response validation schemas
│   │   ├── routers/                 # Modular API routers (/auth, /questions, /exams, /grading, etc.)
│   │   ├── services/                # Business logic (auto-grading, LLM grading, OCR, proctoring)
│   │   ├── auth/                    # JWT authentication & role-based dependencies
│   │   ├── websocket/               # WebSocket proctoring telemetry handler
│   │   └── utils/                   # File storage, thumbnails, and database seeding
│   ├── alembic/                     # Database migrations
│   ├── tests/                       # Pytest test suite
│   ├── requirements.txt             # Python dependencies
│   └── Dockerfile                   # Production container for backend
│
├── frontend/
│   ├── app/                         # Next.js App Router pages
│   ├── components/                  # Reusable UI components (Exam, Proctoring, Grading)
│   ├── hooks/                       # Custom React hooks (session sync, proctoring CV)
│   ├── services/                    # API client layer
│   ├── types/                       # TypeScript interfaces
│   ├── package.json                 # Node dependencies
│   └── Dockerfile                   # Production container for frontend
│
├── database/                        # Local PostgreSQL cluster & scripts
├── docker-compose.yml               # Multi-container orchestration (PostgreSQL, Backend, Frontend)
├── .env.example                     # Environment configuration reference
└── docs/                            # Architectural specifications & guides
```

---

## Technology Stack

- **Backend**: Python 3.11+, FastAPI, SQLAlchemy 2.0 (Async), asyncpg / psycopg3, Pydantic v2, python-jose, APScheduler, WebSockets, Pytest
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Lucide React
- **AI & Proctoring**: MediaPipe Face Detection, MediaPipe FaceMesh (Client-side CV, privacy-preserving), OpenAI GPT-4o / Heuristic evaluator
- **OCR**: Tesseract OCR / Google Vision API with examiner manual review & canvas annotation
- **Database**: PostgreSQL 16+ with Alembic migrations
- **Orchestration**: Docker & Docker Compose

---

## Quickstart Guide

### 1. Environment Setup
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

### 2. Running Locally

#### PostgreSQL
Start the local PostgreSQL instance:
```bash
# Point to your PostgreSQL instance or start the bundled local cluster:
& "C:\Program Files\PostgreSQL\18\bin\postgres.exe" -D "database/pg_data" -p 5433
```

#### Backend (FastAPI)
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload
```
- API Root: `http://127.0.0.1:8001/`
- Interactive Swagger Docs: `http://127.0.0.1:8001/docs`
- Health Check: `http://127.0.0.1:8001/api/health`

#### Frontend (Next.js)
```bash
cd frontend
npm install
npm run dev
# or for production:
npm run build
npm run start
```
- Frontend Portal: `http://localhost:3000/`

---

### 3. Running with Docker Compose
```bash
docker compose up --build
```
Services started:
- PostgreSQL on port `5432`
- FastAPI backend on port `8000`
- Next.js frontend on port `3000`

---

## Verification & Health Check

The backend exposes an automated health check endpoint at `/api/health`:
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2026-09-06T15:28:56.743868+00:00",
  "version": "1.0.0"
}
```

The Next.js frontend at `http://localhost:3000` dynamically queries `/api/health` and displays the live connection status of both the FastAPI backend and PostgreSQL database.
