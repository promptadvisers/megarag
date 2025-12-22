<div align="center">

# MegaRAG

### The Ultimate Multi-Modal RAG System

**Upload anything. Query everything. Get answers instantly.**

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Database-green?logo=supabase)](https://supabase.com/)
[![Gemini](https://img.shields.io/badge/Gemini-2.0-orange?logo=google)](https://ai.google.dev/)

[Features](#features) | [Quick Start](#quick-start) | [Architecture](#architecture) | [API](#api)

</div>

---

## What is MegaRAG?

MegaRAG is a production-ready **Retrieval-Augmented Generation** system that processes and queries **any file type** - PDFs, images, videos, audio, and documents. Built with Next.js, Supabase, and Google Gemini, it provides intelligent document understanding with a beautiful UI.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Upload    │────▶│   Process   │────▶│   Query     │
│  Any File   │     │  & Extract  │     │  with AI    │
└─────────────┘     └─────────────┘     └─────────────┘
```

## Features

### Multi-Modal Processing

| File Type | Processing | Output |
|-----------|-----------|--------|
| **PDF/DOCX/PPTX/XLSX** | Gemini document understanding | Text chunks + tables |
| **Images** (PNG/JPG/GIF/WebP) | Gemini Vision analysis | Detailed descriptions |
| **Video** (MP4/WebM/MOV) | Frame-by-frame analysis | Timestamped segments |
| **Audio** (MP3/WAV/FLAC) | Full transcription | Searchable text chunks |
| **Text** (TXT/MD) | Smart chunking | Semantic sections |

### Intelligent Retrieval

- **5 Query Modes**: Naive, Local, Global, Hybrid, Mix
- **Knowledge Graph**: Automatic entity and relationship extraction
- **Vector Search**: 768-dimensional embeddings with pgvector
- **Source Citations**: Every answer includes clickable references

### Modern UI

- Dark/Light Mode with system-aware switching
- Real-time processing status updates
- Data Explorer for inspecting indexed content
- Multi-select bulk delete operations
- Beautiful markdown rendering in chat

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (free tier works)
- Google AI API key

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/megarag.git
cd megarag
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google AI
GOOGLE_AI_API_KEY=your-gemini-api-key
```

### 3. Set Up Database

Run the SQL migrations in `supabase/migrations/` in order.

### 4. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── upload/        # File upload & processing
│   │   ├── documents/     # CRUD operations
│   │   ├── query/         # RAG query endpoint
│   │   └── chat/          # Chat sessions
│   └── dashboard/
│       ├── page.tsx       # Main dashboard
│       ├── chat/          # Chat interface
│       └── explorer/      # Data explorer
├── components/
│   ├── ChatInterface.tsx  # Chat UI
│   ├── DocumentList.tsx   # File list with multi-select
│   └── DataExplorer.tsx   # Content inspector
├── lib/
│   ├── gemini/            # AI client & embeddings
│   ├── processing/        # File processors
│   ├── rag/               # Retrieval & generation
│   └── supabase/          # Database client
└── types/                 # TypeScript definitions
```

### Database Schema

```sql
documents    -- File metadata & status
chunks       -- Text chunks with embeddings (pgvector)
entities     -- Extracted entities
relations    -- Entity relationships
```

## API Reference

### Upload File

```bash
POST /api/upload
Content-Type: multipart/form-data
Body: file (required)
```

### Query Documents

```bash
POST /api/query
Content-Type: application/json

{
  "query": "What are the key features?",
  "mode": "mix"  # naive|local|global|hybrid|mix
}
```

### Query Modes

| Mode | Description | Best For |
|------|-------------|----------|
| **Naive** | Direct vector search | Simple facts |
| **Local** | Entity-focused | "Who is..." |
| **Global** | Relationship traversal | Themes & connections |
| **Hybrid** | Local + Global | Complex questions |
| **Mix** | All combined | General use (default) |

## Processing Pipeline

```
Upload → Router → Processor → Embeddings → Entities → Storage
           │
           ├── PDF/Office  → Gemini Document Parser
           ├── Images      → Gemini Vision
           ├── Video       → Gemini Video Analysis
           ├── Audio       → Gemini Transcription
           └── Text        → Smart Chunker
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `CHUNK_SIZE_TOKENS` | Chunk size | 800 |
| `CHUNK_OVERLAP_TOKENS` | Overlap | 100 |
| `ENABLE_ENTITY_EXTRACTION` | Knowledge graph | true |
| `MAX_FILE_SIZE_MB` | Max upload | 100 |

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL + pgvector)
- **AI**: Google Gemini 2.0 Flash
- **UI**: shadcn/ui + Tailwind CSS
- **Markdown**: react-markdown + remark-gfm

## Deploy

### Vercel (Recommended)

```bash
vercel deploy
```

### Docker

```bash
docker build -t megarag .
docker run -p 3000:3000 megarag
```

## License

MIT License

---

<div align="center">

**Built with AI, for AI applications**

</div>
