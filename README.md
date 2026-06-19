# AI Interviewer

A production-ready conversational AI interviewer that conducts structured job interviews, asks intelligent follow-up questions, evaluates responses, and generates comprehensive candidate assessment reports.

Powered by a Groq-compatible AI service, with Gemini-compatible internal naming retained for existing code paths.

## ✨ Features

- **AI-Powered Interviews** — Natural conversational flow with intelligent follow-up questions
- **Resume Analysis** — Automatic PDF parsing and skill extraction using the configured AI provider
- **Real-time Evaluation** — Every response scored across technical, communication, problem-solving, and leadership dimensions
- **Interview Memory** — AI references previous answers for contextual follow-ups
- **Assessment Reports** — Comprehensive recruiter-friendly reports with scores and recommendations
- **Multiple Interview Types** — Software Engineering, Product Management, Data Science, General Screening

## 🏗️ Architecture

```
ai-interviewer/
├── docker-compose.yml          # Orchestration
├── backend/                    # FastAPI + Python 3.12
│   ├── app/
│   │   ├── api/               # API routes
│   │   ├── agents/            # AI agents (Interview, Evaluation, Report, Memory)
│   │   ├── services/          # Business logic
│   │   ├── repositories/      # Data access
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── prompts/           # AI prompt templates
│   │   ├── utils/             # Utilities
│   │   └── tests/             # Test suite
│   ├── alembic/               # Database migrations
│   ├── Dockerfile
│   └── requirements.txt
└── frontend/                   # Next.js 15 + TypeScript
    ├── src/
    │   ├── app/               # App Router pages
    │   ├── components/        # React components
    │   └── lib/               # Utilities & API client
    ├── Dockerfile
    └── package.json
```

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v4, shadcn/ui |
| **Backend** | FastAPI, Python 3.12, SQLAlchemy 2.0 (async), Pydantic v2 |
| **Database** | PostgreSQL 16, Alembic migrations |
| **AI** | Groq Chat Completions-compatible models |
| **Infrastructure** | Docker, Docker Compose |

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) and Docker Compose
- Groq API key

### Setup

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd ai-interviewer
   ```

2. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and add your GROQ_API_KEY
   ```

3. **Start the application**
   ```bash
   docker-compose up --build
   ```

4. **Access the application**
   - Frontend: [http://localhost:3000](http://localhost:3000)
   - Backend API: [http://localhost:8000](http://localhost:8000)
   - API Docs (Swagger): [http://localhost:8000/docs](http://localhost:8000/docs)
   - API Docs (ReDoc): [http://localhost:8000/redoc](http://localhost:8000/redoc)

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/health/` | Health check |
| `POST` | `/api/v1/candidates/` | Create a candidate |
| `GET` | `/api/v1/candidates/` | List candidates |
| `GET` | `/api/v1/candidates/{id}` | Get candidate details |
| `PUT` | `/api/v1/candidates/{id}` | Update candidate |
| `POST` | `/api/v1/candidates/{id}/resume` | Upload resume (PDF) |
| `POST` | `/api/v1/interviews/` | Create an interview |
| `GET` | `/api/v1/interviews/` | List interviews |
| `GET` | `/api/v1/interviews/{id}` | Get interview details |
| `POST` | `/api/v1/interviews/{id}/start` | Start an interview |
| `POST` | `/api/v1/interviews/{id}/message` | Send a message |
| `GET` | `/api/v1/interviews/{id}/report` | Get assessment report |

## 🗃️ Database Schema

- **Candidate** — Name, email, parsed resume data (skills, experience, education, projects)
- **Interview** — Links candidate + job description, tracks status and conversation history
- **InterviewPlan** — Structured interview plan with sections and topics
- **InterviewSection** — Individual section within a plan
- **Question** — Each question asked, with type (primary/follow-up), embeddings
- **Response** — Candidate responses with key topics and embeddings
- **Evaluation** — AI scoring per response (technical, communication, problem-solving, leadership)
- **Report** — Final assessment with overall scores and recommendation

## 🧪 Running Tests

```bash
# Backend tests
docker-compose exec backend pytest app/tests/ -v --cov=app

# Frontend (coming soon)
docker-compose exec frontend npm test
```

## 📋 Development Phases

- [x] **Phase 1** — Project architecture, Docker, database models
- [ ] **Phase 2** — API endpoints, resume upload, candidate management
- [ ] **Phase 3** — AI integration, interview agent, evaluation agent
- [ ] **Phase 4** — Memory system, follow-up engine
- [ ] **Phase 5** — Report generation
- [ ] **Phase 6** — Frontend dashboard, chat UI, report UI

## 🔑 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key used for interview planning, evaluation, and reports | (required outside local fallback mode) |
| `GEMINI_API_KEY` | Optional compatibility variable for older Gemini deployments | empty |
| `APP_SECRET_KEY` | Application secret for signing | `change-me-in-production` |
| `DATABASE_URL` | Async PostgreSQL connection string | `postgresql+asyncpg://postgres:postgres@db:5432/ai_interviewer` |
| `APP_DEBUG` | Enable debug mode | `true` |
| `CORS_ORIGINS` | Allowed CORS origins | `["http://localhost:3000"]` |
| `MAX_RESUME_UPLOAD_BYTES` | Maximum PDF resume upload size | `5242880` |

## 📄 License

MIT
