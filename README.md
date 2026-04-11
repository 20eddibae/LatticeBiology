# LatticeBio

A platform for turning unstructured biological study data into structured, queryable entities. Ingests from the [EBI BioStudies API](https://www.ebi.ac.uk/biostudies/), runs NER extraction via a local language model ([Ollama](https://ollama.com/)), and surfaces results in a dashboard.

---

## Project Structure

```
LatticeBio/
├── frontend/                  # Next.js 14
│   ├── app/
│   │   ├── page.tsx           # Dashboard
│   │   ├── explorer/          # Entity Explorer
│   │   ├── pipeline/          # Pipeline Health
│   │   ├── studies/           # Study Browser
│   │   └── settings/          # Config
│   ├── components/            # Sidebar, MetricCard, StudyCard, etc.
│   └── lib/api.ts             # Backend client (falls back to mock data)
│
└── backend/                   # FastAPI
    ├── main.py                # API routes + lifespan (DB init, cache warm-up)
    ├── models.py              # Pydantic schemas (camelCase aliases)
    ├── biostudies.py          # EBI BioStudies API client
    ├── ai_processor.py        # Ollama-powered entity extraction (NER)
    ├── pipeline.py            # Ingestion orchestrator
    ├── database.py            # SQLAlchemy async DB layer
    ├── db_models.py           # ORM table definitions
    ├── celery_app.py          # Celery broker configuration
    ├── tasks.py               # Celery task definitions
    └── mock_data.py           # Seed data for first-run
```

---

## Quick Start (minimal)

Works with zero external services — SQLite for storage, FastAPI BackgroundTasks for queuing, regex NER fallback if Ollama is not running.

```bash
# Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python main.py                 # http://localhost:8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                    # http://localhost:3000
```

The frontend works standalone — it falls back to mock data if the backend is not running.

---

## Full Infrastructure

### 1. Pull the model

```bash
ollama pull llama3.2:3b
```

### 2. Redis (for Celery)

```bash
redis-server
```

### 3. Celery worker

```bash
cd backend
REDIS_URL=redis://localhost:6379/0 celery -A celery_app.celery_app worker --loglevel=info --concurrency=2
```

### 4. FastAPI

```bash
cd backend
REDIS_URL=redis://localhost:6379/0 python main.py
```

For Postgres instead of SQLite, just swap the env var:

```bash
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5432/biostream
```

---

## Entity Types

| Type     | Examples                                        |
|----------|-------------------------------------------------|
| Protein  | BRCA1, p53, HER2, ACE2                         |
| Gene     | TP53, EGFR, KRAS, PIK3CA                       |
| Compound | imatinib, pembrolizumab, remdesivir             |
| Disease  | non-small cell lung cancer, ALS                 |
| Pathway  | mTOR signaling, Wnt/β-catenin                  |

---

## Tech Stack

| Layer       | Technology                                             |
|-------------|--------------------------------------------------------|
| Frontend    | Next.js 14, Tailwind CSS, Framer Motion                |
| API         | FastAPI, Pydantic v2                                   |
| NER         | Ollama (`llama3.2:3b`) with regex fallback             |
| Task Queue  | Celery + Redis (optional — falls back to BackgroundTasks) |
| Database    | SQLAlchemy async — SQLite (default) or PostgreSQL      |
| Ingestion   | httpx async client → EBI BioStudies API                |

---

## Environment Variables

See [`backend/.env.example`](backend/.env.example) for the full list. Key variables:

| Variable         | Default                              | Description                        |
|------------------|--------------------------------------|------------------------------------|
| `DATABASE_URL`   | `sqlite+aiosqlite:///./biostream.db` | SQLAlchemy connection string       |
| `REDIS_URL`      | *(empty — Celery disabled)*          | Redis broker for Celery            |
| `OLLAMA_MODEL`   | `llama3.2:3b`                        | Model for entity extraction        |
| `PIPELINE_QUERY` | `cancer`                             | Default BioStudies search query    |
| `PIPELINE_PAGE_SIZE` | `10`                             | Studies per pipeline run           |
