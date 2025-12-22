# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Overview

This is a multi-repository workspace containing four related RAG (Retrieval-Augmented Generation) projects from HKUDS:

| Repository | Purpose | PyPI Package |
|------------|---------|--------------|
| **LightRAG/** | Core graph-based RAG framework with knowledge graph indexing | `lightrag-hku` |
| **RAG-Anything/** | Multimodal document processing RAG (PDFs, images, tables, equations) | `raganything` |
| **VideoRAG/** | Long-context video understanding RAG with Vimo desktop app | - |
| **docling/** | Document parsing library (PDF, DOCX, PPTX, HTML, images) | `docling` |

**Relationship**: RAG-Anything is built on top of LightRAG. Both can use docling as a document parser option.

## Build and Development Commands

### LightRAG

```bash
cd LightRAG
uv sync                           # Create venv and install dependencies
source .venv/bin/activate         # Activate virtual environment
pip install -e .                  # Install core in editable mode
pip install -e ".[api]"           # Install with API server extras

# Run API server
lightrag-server                   # Or: uvicorn lightrag.api.lightrag_server:app --reload

# Testing & Linting
python -m pytest tests            # Run tests (offline by default)
python -m pytest tests --run-integration  # Include integration tests
ruff check .                      # Lint Python

# Web UI (requires Bun)
cd lightrag_webui
bun install --frozen-lockfile
bun run dev                       # Development server
bun run build                     # Production build
bun test                          # Run UI tests
```

### RAG-Anything

```bash
cd RAG-Anything
uv sync                           # Install with uv
pip install raganything           # Or install from PyPI
pip install "raganything[all]"    # Include all optional dependencies

# Run examples
python examples/raganything_example.py path/to/doc.pdf --api-key YOUR_KEY
python examples/modalprocessors_example.py --api-key YOUR_KEY
```

### docling

```bash
cd docling
pip install docling               # Install from PyPI
docling document.pdf              # CLI usage
docling --pipeline vlm --vlm-model granite_docling document.pdf  # With VLM

# Testing
pytest
```

### VideoRAG

```bash
cd VideoRAG/Vimo-desktop
# Backend: Set up Python environment and start VideoRAG server
# Frontend: Electron app - see Vimo-desktop/README for details
```

## Architecture Notes

### LightRAG Core Architecture

- **Storage Layer** (`lightrag/kg/`): Pluggable storage backends
  - KV Storage: JsonKVStorage, PGKVStorage, RedisKVStorage, MongoKVStorage
  - Vector Storage: NanoVectorDB, PGVector, Milvus, Chroma, Faiss, Qdrant, MongoDB
  - Graph Storage: NetworkX (default), Neo4J, PostgreSQL+AGE, Memgraph
  - Doc Status Storage: JsonDocStatusStorage, PGDocStatusStorage, MongoDocStatusStorage

- **LLM Bindings** (`lightrag/llm/`): OpenAI, Ollama, HuggingFace, LlamaIndex, Azure, Bedrock, etc.

- **Core Orchestration**: `lightrag/lightrag.py` with `operate.py` for operations

- **API Layer** (`lightrag/api/`): FastAPI server with routers under `routers/`

### RAG-Anything Architecture

- **Modal Processors** (`raganything/modalprocessors/`): Specialized processors for images, tables, equations
- **Parsers**: MinerU (default) or Docling for document parsing
- **Integration**: Wraps LightRAG instance, adds multimodal entity extraction to knowledge graph

### Key Initialization Pattern (LightRAG)

```python
rag = LightRAG(working_dir=WORKING_DIR, llm_model_func=..., embedding_func=...)
await rag.initialize_storages()  # REQUIRED before use
# ... use rag ...
await rag.finalize_storages()    # Cleanup
```

## Environment Configuration

Copy `.env.example` to `.env` in each repository. Key variables:

- `OPENAI_API_KEY`, `OPENAI_BASE_URL` - LLM configuration
- `NEO4J_URI`, `NEO4J_USERNAME`, `NEO4J_PASSWORD` - Neo4J storage
- Storage-specific: `POSTGRES_*`, `REDIS_*`, `MILVUS_*`, `MONGODB_*`
- `LANGFUSE_*` - Observability (optional)

## Testing Guidelines

- LightRAG uses pytest with markers: `offline`, `integration`, `requires_db`, `requires_api`
- Default runs exclude integration tests; use `--run-integration` or `LIGHTRAG_RUN_INTEGRATION=true`
- Custom flags: `--keep-artifacts`, `--stress-test`, `--test-workers N`
- Export `LIGHTRAG_*` environment variables for storage backend tests

## Coding Conventions

- Python: PEP 8, 4-space indentation, type annotations, dataclasses for state
- Use `lightrag.utils.logger` instead of `print`
- Frontend (LightRAG WebUI): TypeScript, 2-space indentation, functional React with hooks, Tailwind CSS
- Commit messages: Concise, imperative (e.g., "Fix lock key normalization")

## Query Modes

LightRAG supports multiple retrieval modes via `QueryParam(mode=...)`:
- `local`: Context-dependent, entity-focused
- `global`: Relationship-focused, global knowledge
- `hybrid`: Combines local and global
- `naive`: Basic vector search
- `mix`: Knowledge graph + vector retrieval (recommended with reranker)

---

## MegaRAG Implementation Tracking

When working on the MegaRAG project (defined in `MEGARAG_PLAN.md`), you MUST follow these rules:

### 1. Always Check Off Completed Items
- After completing any task in `MEGARAG_PLAN.md`, immediately update the checkbox from `- [ ]` to `- [x]`
- Add `✅` to section headers when all items in that section are complete
- Mark phases as `✅ COMPLETED` or `🔄 IN PROGRESS` in the header

### 2. Add Context After Each Section
After completing a section, add an **Actual Values** or **Details** block with:
- Real values used (project IDs, URLs, API keys - partial for security)
- File paths created
- Any deviations from the plan
- Important notes for future reference

### 3. Phase Summary for Handoff
At the end of each phase, provide a summary that includes:
- What was accomplished (tables work well)
- Key files/resources created with their purposes
- Any credentials or configuration that was set up
- **Action Required** items the user needs to do manually
- Current state so a new agent can pick up seamlessly

### Example Phase Summary Format:
```markdown
## Phase X: [Name] - COMPLETE

| Task | Status |
|------|--------|
| X.1 Task name | ✅ Complete |
| X.2 Task name | ✅ Complete |

### What Was Created
- **Resource 1:** Description and location
- **Resource 2:** Description and location

### Key Values
- **Project ID:** `abc123`
- **URL:** `https://...`

### Action Required
1. Manual step the user needs to do
2. Another manual step

### Next Phase Preview
Phase X+1 will implement [brief description]...
```

### Current MegaRAG State (Updated: 2025-12-20)

**ALL PHASES COMPLETE:**
- Phase 1: Supabase Setup ✅
- Phase 2: Next.js Project Setup ✅
- Phase 3: File Upload & Basic UI ✅
- Phase 4: Text Processing Pipeline ✅
- Phase 5: Document Processing (Office/PDF) ✅
- Phase 6: Video & Audio Processing ✅
- Phase 7: Entity Extraction & Knowledge Graph ✅
- Phase 8: RAG Query System ✅
- Phase 9: Chat Interface ✅
- Phase 10: Polish & Deploy ✅

**Supabase Project:**
- Project ID: `phenoutbdxuvwfewtzka`
- URL: `https://phenoutbdxuvwfewtzka.supabase.co`
- Region: `us-east-1`
- Tables: `documents`, `chunks`, `entities`, `relations`, `llm_cache`
- RPC Functions: `search_chunks`, `search_entities`, `search_relations`
- Storage Bucket: `documents` (private, 100MB limit)

**Next.js Project:**
- Location: `/megarag`
- Framework: Next.js 14 with App Router, TypeScript, Tailwind CSS
- Run with: `cd megarag && npm run dev`
- Key directories:
  - `src/lib/supabase/` - Supabase clients
  - `src/lib/gemini/` - Gemini AI client + embeddings + File API
  - `src/lib/processing/` - All file processors (text, document, image, video, audio, entity)
  - `src/lib/rag/` - RAG retrieval and response generation
  - `src/types/` - TypeScript definitions
  - `src/components/` - React components
  - `src/app/api/` - API routes
  - `src/app/dashboard/` - Dashboard and chat pages

**Docling Service (for PDF/Office docs):**
- Location: `/megarag/docling-service`
- Run with: `cd docling-service && uvicorn main:app --port 8000`
- Endpoints: `/parse` (POST), `/health` (GET)
- Required for: PDF, DOCX, PPTX, XLSX processing

**Current API Routes:**
- `POST /api/upload` - Upload file, triggers processing
- `GET /api/documents` - List documents (paginated)
- `DELETE /api/documents?id=` - Delete document
- `GET /api/status/[id]` - Get document processing status
- `POST /api/query` - RAG query with multiple modes
- `GET /api/query` - Query API documentation

**Processing Pipeline:**
| File Type | Processing |
|-----------|------------|
| TXT, MD | Text chunking → embeddings → entity extraction |
| PDF, DOCX, PPTX, XLSX | Docling → text/table/image extraction → Gemini description → embeddings → entity extraction |
| JPG, PNG, GIF, WebP | Gemini Vision → description → embeddings |
| MP4, WebM, MOV, AVI | Gemini File API → video analysis → timestamped chunks → embeddings → entity extraction |
| MP3, WAV, OGG, FLAC, M4A, AAC | Gemini File API → transcription → text chunks → embeddings → entity extraction |

**RAG Query Modes:**
| Mode | Description |
|------|-------------|
| `naive` | Vector search on chunks only |
| `local` | Search entities → get related chunks |
| `global` | Search relations → traverse knowledge graph |
| `hybrid` | Combine local + global |
| `mix` | Full hybrid (chunks + entities + relations) - default |

**Entity Extraction:**
- Automatic extraction of entities (PERSON, ORGANIZATION, LOCATION, EVENT, CONCEPT, TECHNOLOGY, PRODUCT, DATE)
- Automatic extraction of relationships between entities
- Deduplication and merging of entities across chunks
- Embeddings generated for semantic search on entities/relations

**Pending User Actions:**
1. Add `SUPABASE_SERVICE_ROLE_KEY` to `megarag/.env.local`
2. Add `GOOGLE_AI_API_KEY` to `megarag/.env.local`
3. Start Docling service for PDF/Office processing: `cd docling-service && pip install -r requirements.txt && uvicorn main:app --port 8000`

**Chat Interface Components:**
- `src/components/ChatInterface.tsx` - Main chat with query mode selector
- `src/components/ChatMessage.tsx` - User/assistant message display
- `src/components/SourceReferences.tsx` - Expandable source citations

**Polish & Deploy Components:**
- `src/components/ThemeProvider.tsx` - Dark mode support
- `src/components/ThemeToggle.tsx` - Theme switcher (Light/Dark/System)
- `src/components/ErrorBoundary.tsx` - Error handling with retry
- `src/components/DocumentListSkeleton.tsx` - Loading skeletons
- `src/lib/gemini/cache.ts` - LLM response caching
- `src/app/api/status/[id]/stream/route.ts` - SSE status updates
- `vercel.json` - Deployment configuration

**Implementation Status:** COMPLETE - Ready for Vercel deployment
