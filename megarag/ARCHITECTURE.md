# MegaRAG Architecture Guide

> A comprehensive Multi-Modal RAG (Retrieval-Augmented Generation) system built with Next.js, Supabase, and Google Gemini AI.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [High-Level Architecture](#high-level-architecture)
3. [Development Phases](#development-phases)
4. [Technology Stack](#technology-stack)
5. [Data Flow](#data-flow)
6. [Database Schema](#database-schema)
7. [Processing Pipeline](#processing-pipeline)
8. [RAG Query System](#rag-query-system)
9. [Component Architecture](#component-architecture)
10. [API Reference](#api-reference)
11. [Deployment](#deployment)

---

## System Overview

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                              MEGARAG SYSTEM                                    ║
║                                                                                ║
║   ┌─────────────────────────────────────────────────────────────────────────┐ ║
║   │                        Multi-Modal RAG Platform                          │ ║
║   │                                                                          │ ║
║   │  • Upload ANY file type (PDF, DOCX, MP4, MP3, Images, etc.)             │ ║
║   │  • Automatic content extraction and understanding                        │ ║
║   │  • Knowledge Graph with entities and relationships                       │ ║
║   │  • 5 Query Modes: naive, local, global, hybrid, mix                     │ ║
║   │  • Chat interface with source citations                                  │ ║
║   └─────────────────────────────────────────────────────────────────────────┘ ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

---

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT LAYER                                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                   │
│  │   Dashboard     │  │   Chat Page     │  │  Data Explorer  │                   │
│  │   /dashboard    │  │ /dashboard/chat │  │ /dashboard/     │                   │
│  │                 │  │                 │  │    explorer     │                   │
│  │  • Upload UI    │  │  • Chat UI      │  │  • Entities     │                   │
│  │  • Doc List     │  │  • Mode Select  │  │  • Relations    │                   │
│  │  • Stats        │  │  • Sources      │  │  • Chunks       │                   │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                   │
│           │                    │                    │                            │
└───────────┼────────────────────┼────────────────────┼────────────────────────────┘
            │                    │                    │
            ▼                    ▼                    ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                                   API LAYER                                       │
│                                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ /api/upload │  │ /api/query  │  │ /api/chat   │  │/api/documents│             │
│  │             │  │             │  │             │  │              │             │
│  │  POST       │  │  POST       │  │  GET/POST   │  │  GET/DELETE  │             │
│  │  Upload →   │  │  RAG Query  │  │  Sessions   │  │  CRUD Docs   │             │
│  │  Process    │  │  → Response │  │  Messages   │  │  + Chunks    │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘             │
│         │                │                │                │                      │
└─────────┼────────────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │                │
          ▼                ▼                ▼                ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              PROCESSING LAYER                                     │
│                                                                                   │
│  ┌────────────────────────────────────────────────────────────────────────────┐  │
│  │                         Processing Router                                   │  │
│  │                      src/lib/processing/router.ts                          │  │
│  │                                                                             │  │
│  │    File Type → Processor Mapping                                           │  │
│  │    ┌─────────────────────────────────────────────────────────────────┐    │  │
│  │    │  TXT/MD  → text-processor      │  PDF/DOCX  → document-processor │    │  │
│  │    │  Images  → image-processor     │  MP4/WebM  → video-processor    │    │  │
│  │    │  MP3/WAV → audio-processor     │  PPTX/XLSX → document-processor │    │  │
│  │    └─────────────────────────────────────────────────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────────────────┘  │
│                                       │                                          │
│                                       ▼                                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────────┐  │
│  │   Chunking  │  │  Embedding  │  │         Entity Extraction               │  │
│  │             │  │  Generator  │  │                                          │  │
│  │ 800 tokens  │→│ text-embed  │→│  Gemini → Entities + Relations           │  │
│  │ 100 overlap │  │   ing-004   │  │  → Dedup → Embeddings → Store           │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────────────────────┘  │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL SERVICES                                    │
│                                                                                   │
│  ┌──────────────────────────────┐    ┌──────────────────────────────┐           │
│  │        SUPABASE              │    │         GEMINI AI             │           │
│  │                              │    │                               │           │
│  │  ┌─────────┐  ┌─────────┐   │    │  ┌─────────────────────────┐  │           │
│  │  │PostgreSQL│  │ Storage │   │    │  │  gemini-2.0-flash       │  │           │
│  │  │+pgvector │  │ Bucket  │   │    │  │  • Content Generation   │  │           │
│  │  │         │  │         │   │    │  │  • Vision (Images)       │  │           │
│  │  │• docs   │  │• files  │   │    │  │  • Video Understanding   │  │           │
│  │  │• chunks │  │• images │   │    │  │  • Audio Transcription   │  │           │
│  │  │• entities│ │• videos │   │    │  │                          │  │           │
│  │  │• relations││• audio  │   │    │  ├─────────────────────────┤  │           │
│  │  └─────────┘  └─────────┘   │    │  │  text-embedding-004      │  │           │
│  │                              │    │  │  768 dimensions          │  │           │
│  └──────────────────────────────┘    └──────────────────────────────┘           │
│                                                                                   │
│  ┌──────────────────────────────┐                                                │
│  │     DOCLING SERVICE          │    Port 8000                                   │
│  │     (Python FastAPI)         │    /parse endpoint                             │
│  │                              │    PDF/DOCX/PPTX/XLSX → structured content    │
│  └──────────────────────────────┘                                                │
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Development Phases

```
═══════════════════════════════════════════════════════════════════════════════════
                        MEGARAG DEVELOPMENT JOURNEY
═══════════════════════════════════════════════════════════════════════════════════

     PHASE 1                PHASE 2                PHASE 3                PHASE 4
  ┌───────────┐          ┌───────────┐          ┌───────────┐          ┌───────────┐
  │ SUPABASE  │          │ NEXT.JS   │          │   FILE    │          │   TEXT    │
  │  SETUP    │   ──▶    │  PROJECT  │   ──▶    │  UPLOAD   │   ──▶    │ PROCESSING│
  │           │          │  SETUP    │          │   & UI    │          │ PIPELINE  │
  └───────────┘          └───────────┘          └───────────┘          └───────────┘
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
  • PostgreSQL           • Next.js 14           • Drag-drop           • Token chunking
  • pgvector ext         • TypeScript           • File preview        • Sentence-aware
  • Storage bucket       • Tailwind CSS         • Upload API          • Embeddings
  • RPC functions        • shadcn/ui            • Doc list            • Status tracking


     PHASE 5                PHASE 6                PHASE 7                PHASE 8
  ┌───────────┐          ┌───────────┐          ┌───────────┐          ┌───────────┐
  │ DOCUMENT  │          │  VIDEO &  │          │  ENTITY   │          │   RAG     │
  │PROCESSING │   ──▶    │   AUDIO   │   ──▶    │EXTRACTION │   ──▶    │  QUERY    │
  │(PDF/DOCX) │          │PROCESSING │          │   & KG    │          │  SYSTEM   │
  └───────────┘          └───────────┘          └───────────┘          └───────────┘
       │                      │                      │                      │
       ▼                      ▼                      ▼                      ▼
  • Docling svc          • Gemini File API     • 8 entity types       • 5 query modes
  • Table extract        • Video analysis      • Relation types       • Vector search
  • Image extract        • Audio transcript    • Deduplication        • Context build
  • Content describe     • Timestamped chunks  • KG embeddings        • Citations


     PHASE 9                PHASE 10               PHASE 11
  ┌───────────┐          ┌───────────┐          ┌───────────┐
  │   CHAT    │          │ POLISH &  │          │  FEATURE  │
  │ INTERFACE │   ──▶    │  DEPLOY   │   ──▶    │ENHANCEMENTS│
  │           │          │           │          │ (LATEST)   │
  └───────────┘          └───────────┘          └───────────┘
       │                      │                      │
       ▼                      ▼                      ▼
  • Chat UI              • Dark mode            • Bulk uploads
  • Mode selector        • Error boundary       • Cmd+K search
  • Source refs          • Loading states       • Doc filters
  • Session mgmt         • LLM caching          • Chat rename
                         • SSE streaming        • Undo delete

═══════════════════════════════════════════════════════════════════════════════════
                           ALL PHASES COMPLETE ✅
═══════════════════════════════════════════════════════════════════════════════════
```

---

## Technology Stack

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              TECHNOLOGY STACK                                     │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  FRONTEND                        BACKEND                     AI/ML               │
│  ─────────                       ───────                     ─────               │
│  ┌─────────────────┐            ┌─────────────────┐         ┌──────────────────┐│
│  │ Next.js 14      │            │ Next.js API     │         │ Gemini 2.0 Flash ││
│  │ App Router      │            │ Routes          │         │ • 1M context     ││
│  │                 │            │                 │         │ • Native video   ││
│  │ React 18        │            │ Supabase JS     │         │ • Native audio   ││
│  │ TypeScript      │            │ Client          │         │                  ││
│  │                 │            │                 │         │ text-embedding   ││
│  │ Tailwind CSS    │            │ Docling         │         │ -004             ││
│  │ shadcn/ui       │            │ (Python/FastAPI)│         │ 768 dimensions   ││
│  └─────────────────┘            └─────────────────┘         └──────────────────┘│
│                                                                                   │
│  STORAGE                         DATABASE                    TOOLING             │
│  ───────                         ────────                    ───────             │
│  ┌─────────────────┐            ┌─────────────────┐         ┌──────────────────┐│
│  │ Supabase        │            │ PostgreSQL      │         │ ESLint           ││
│  │ Storage         │            │ + pgvector      │         │ Prettier         ││
│  │                 │            │                 │         │ TypeScript       ││
│  │ • documents     │            │ Tables:         │         │                  ││
│  │   bucket        │            │ • documents     │         │ Vercel           ││
│  │ • 100MB limit   │            │ • chunks        │         │ (deployment)     ││
│  │ • private       │            │ • entities      │         │                  ││
│  │                 │            │ • relations     │         │ Docker           ││
│  └─────────────────┘            │ • llm_cache     │         │ (Docling svc)    ││
│                                 └─────────────────┘         └──────────────────┘│
│                                                                                   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Document Upload & Processing Flow

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         DOCUMENT PROCESSING PIPELINE                             │
└─────────────────────────────────────────────────────────────────────────────────┘

   USER                UPLOAD                   STORAGE                PROCESSING
    │                    │                        │                        │
    │  Drag & Drop       │                        │                        │
    │  ──────────────▶  │                        │                        │
    │   file.pdf        │   Store File           │                        │
    │                   │  ─────────────────────▶│                        │
    │                   │                        │   documents/uuid/      │
    │                   │                        │   file.pdf             │
    │                   │   Create DB Record     │                        │
    │                   │  ─────────────────────▶│                        │
    │                   │                        │   status: 'pending'    │
    │                   │                        │                        │
    │                   │   Trigger Processing   │                        │
    │                   │  ──────────────────────────────────────────────▶│
    │                   │                        │                        │
    │                   │                        │       ROUTER           │
    │                   │                        │    ┌─────────────┐     │
    │                   │                        │    │ Detect Type │     │
    │                   │                        │    │ Route to    │     │
    │                   │                        │    │ Processor   │     │
    │                   │                        │    └──────┬──────┘     │
    │                   │                        │           │            │
    │                   │                        │           ▼            │
    │                   │                        │    ┌─────────────┐     │
    │                   │                        │    │  PROCESSOR  │     │
    │                   │                        │    │ (see below) │     │
    │                   │                        │    └──────┬──────┘     │
    │                   │                        │           │            │
    │                   │                        │           ▼            │
    │                   │                        │    ┌─────────────┐     │
    │                   │                        │    │  CHUNKING   │     │
    │                   │                        │    │ 800 tokens  │     │
    │                   │                        │    │ 100 overlap │     │
    │                   │                        │    └──────┬──────┘     │
    │                   │                        │           │            │
    │                   │                        │           ▼            │
    │                   │                        │    ┌─────────────┐     │
    │                   │                        │    │ EMBEDDINGS  │     │
    │                   │                        │    │ Gemini      │     │
    │                   │                        │    │ text-004    │     │
    │                   │                        │    └──────┬──────┘     │
    │                   │                        │           │            │
    │                   │                        │           ▼            │
    │                   │                        │    ┌─────────────┐     │
    │                   │                        │    │  ENTITIES   │     │
    │                   │                        │    │ Extraction  │     │
    │                   │                        │    │ + Relations │     │
    │                   │                        │    └──────┬──────┘     │
    │                   │                        │           │            │
    │                   │   Store Chunks         │           │            │
    │                   │  ◀──────────────────────────────────            │
    │                   │                        │                        │
    │                   │   Update Status        │                        │
    │                   │  ◀──────────────────────────────────            │
    │   Processing      │                        │   status: 'processed'  │
    │   Complete        │                        │                        │
    │  ◀───────────────│                        │                        │
    │                   │                        │                        │
```

### Processor-Specific Flows

```
═══════════════════════════════════════════════════════════════════════════════════
                          FILE TYPE PROCESSING FLOWS
═══════════════════════════════════════════════════════════════════════════════════

TEXT FILES (TXT, MD)
────────────────────
    File ──▶ Read Content ──▶ Token Chunking ──▶ Embeddings ──▶ Entities ──▶ Store
                                (800/100)

DOCUMENTS (PDF, DOCX, PPTX, XLSX)
─────────────────────────────────
    File ──▶ Docling Service ──▶ Extract Content ──▶ Per-Type Processing ──▶ Store
                │
                ├── Text Blocks ──▶ Chunking ──▶ Embeddings
                ├── Tables ──▶ Gemini Describe ──▶ Embeddings
                └── Images ──▶ Gemini Vision ──▶ Embeddings

IMAGES (JPG, PNG, GIF, WebP)
────────────────────────────
    File ──▶ Gemini Vision ──▶ Generate Description ──▶ Embeddings ──▶ Store
                               "Describe this image
                                for semantic search"

VIDEO (MP4, WebM, MOV, AVI)
───────────────────────────
    File ──▶ Upload to Gemini ──▶ Wait for Processing ──▶ Analyze Video ──▶ Store
                File API            (polling)              │
                                                          ├── Overview chunk
                                                          ├── Key moment chunks
                                                          └── 30s segment chunks

AUDIO (MP3, WAV, OGG, FLAC, M4A, AAC)
─────────────────────────────────────
    File ──▶ Upload to Gemini ──▶ Wait for Processing ──▶ Transcribe ──▶ Store
                File API            (polling)              │
                                                          ├── Summary chunk
                                                          ├── Topic chunks
                                                          └── Token-based chunks

═══════════════════════════════════════════════════════════════════════════════════
```

---

## Database Schema

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              DATABASE SCHEMA                                      │
└──────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        documents                                 │
├─────────────────────────────────────────────────────────────────┤
│ id              VARCHAR(255)   PRIMARY KEY                      │
│ workspace       VARCHAR(255)   DEFAULT 'default'                │
│ file_name       VARCHAR(1024)  NOT NULL                         │
│ file_type       VARCHAR(50)    NOT NULL                         │
│ file_size       BIGINT                                          │
│ file_path       TEXT                                            │
│ status          VARCHAR(64)    DEFAULT 'pending'                │
│ chunks_count    INTEGER        DEFAULT 0                        │
│ error_message   TEXT                                            │
│ metadata        JSONB          DEFAULT '{}'                     │
│ created_at      TIMESTAMP      DEFAULT NOW()                    │
│ updated_at      TIMESTAMP      DEFAULT NOW()                    │
└─────────────────────────────────────────────────────────────────┘
                                │
                                │ 1:N
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                          chunks                                  │
├─────────────────────────────────────────────────────────────────┤
│ id                VARCHAR(255)   PRIMARY KEY                    │
│ workspace         VARCHAR(255)   DEFAULT 'default'              │
│ document_id       VARCHAR(255)   FK → documents(id) ON DELETE   │
│ chunk_order_index INTEGER                                       │
│ content           TEXT           NOT NULL                       │
│ content_vector    VECTOR(768)    ← pgvector                     │
│ tokens            INTEGER                                       │
│ chunk_type        VARCHAR(50)    DEFAULT 'text'                 │
│ page_idx          INTEGER                                       │
│ timestamp_start   FLOAT                                         │
│ timestamp_end     FLOAT                                         │
│ metadata          JSONB          DEFAULT '{}'                   │
│ created_at        TIMESTAMP      DEFAULT NOW()                  │
├─────────────────────────────────────────────────────────────────┤
│ INDEXES:                                                         │
│ • idx_chunks_document_id (document_id)                          │
│ • idx_chunks_vector HNSW (content_vector vector_cosine_ops)     │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         entities                                 │
├─────────────────────────────────────────────────────────────────┤
│ id                VARCHAR(255)   PRIMARY KEY                    │
│ workspace         VARCHAR(255)   DEFAULT 'default'              │
│ entity_name       VARCHAR(512)   NOT NULL                       │
│ entity_type       VARCHAR(128)   PERSON, ORG, LOCATION, etc.   │
│ description       TEXT                                          │
│ content_vector    VECTOR(768)                                   │
│ source_chunk_ids  JSONB          DEFAULT '[]'                   │
│ created_at        TIMESTAMP      DEFAULT NOW()                  │
├─────────────────────────────────────────────────────────────────┤
│ INDEXES:                                                         │
│ • idx_entities_name (entity_name)                               │
│ • idx_entities_vector HNSW (content_vector vector_cosine_ops)   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         relations                                │
├─────────────────────────────────────────────────────────────────┤
│ id                VARCHAR(255)   PRIMARY KEY                    │
│ workspace         VARCHAR(255)   DEFAULT 'default'              │
│ source_entity_id  VARCHAR(512)                                  │
│ target_entity_id  VARCHAR(512)                                  │
│ relation_type     VARCHAR(256)   WORKS_FOR, LOCATED_IN, etc.   │
│ description       TEXT                                          │
│ content_vector    VECTOR(768)                                   │
│ source_chunk_ids  JSONB          DEFAULT '[]'                   │
│ created_at        TIMESTAMP      DEFAULT NOW()                  │
├─────────────────────────────────────────────────────────────────┤
│ INDEXES:                                                         │
│ • idx_relations_source (source_entity_id)                       │
│ • idx_relations_target (target_entity_id)                       │
│ • idx_relations_vector HNSW (content_vector vector_cosine_ops)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         llm_cache                                │
├─────────────────────────────────────────────────────────────────┤
│ id              VARCHAR(255)   PRIMARY KEY                      │
│ prompt_hash     VARCHAR(64)    (SHA-256 of prompt)             │
│ response        TEXT                                            │
│ created_at      TIMESTAMP      DEFAULT NOW()                    │
├─────────────────────────────────────────────────────────────────┤
│ INDEX: idx_cache_prompt_hash (prompt_hash)                      │
└─────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════════
                              RPC FUNCTIONS
═══════════════════════════════════════════════════════════════════════════════════

search_chunks(query_embedding, match_threshold, match_count)
    → Returns chunks with similarity scores via cosine distance

search_entities(query_embedding, match_threshold, match_count)
    → Returns entities with similarity scores

search_relations(query_embedding, match_threshold, match_count)
    → Returns relations with similarity scores
```

---

## RAG Query System

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                              RAG QUERY SYSTEM                                     │
└──────────────────────────────────────────────────────────────────────────────────┘

USER QUERY: "What is the relationship between Google and AI?"
                                    │
                                    ▼
                          ┌─────────────────┐
                          │  Generate Query │
                          │    Embedding    │
                          │  (768 dims)     │
                          └────────┬────────┘
                                   │
                                   ▼
                 ┌─────────────────────────────────────┐
                 │          SELECT QUERY MODE          │
                 └─────────────────────────────────────┘
                   │       │       │       │       │
                   ▼       ▼       ▼       ▼       ▼
               ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐ ┌─────┐
               │NAIVE│ │LOCAL│ │GLOBAL││HYBRID│ │ MIX │
               └──┬──┘ └──┬──┘ └──┬──┘ └──┬───┘ └──┬──┘
                  │       │       │       │        │

═══════════════════════════════════════════════════════════════════════════════════
                              QUERY MODES EXPLAINED
═══════════════════════════════════════════════════════════════════════════════════

NAIVE MODE
──────────
    Query Embedding ──▶ search_chunks() ──▶ Top K Chunks ──▶ Context

    • Simplest mode - pure vector search on chunks
    • Best for: Simple fact lookup, direct questions


LOCAL MODE
──────────
    Query Embedding ──▶ search_entities() ──▶ Entity IDs
                                                   │
                                                   ▼
                        Get source_chunk_ids from matched entities
                                                   │
                                                   ▼
                                            Related Chunks ──▶ Context

    • Entity-centric retrieval
    • Best for: "Tell me about [Person/Company/Location]"


GLOBAL MODE
───────────
    Query Embedding ──▶ search_relations() ──▶ Relations
                                                   │
                        ┌──────────────────────────┴──────────────────────────┐
                        ▼                                                      ▼
              source_entity_id                                      target_entity_id
                        │                                                      │
                        └──────────────────────────┬──────────────────────────┘
                                                   │
                                          Get Entities ──▶ Get Chunks ──▶ Context

    • Relationship-focused traversal
    • Best for: "How does X relate to Y?", "What connects A and B?"


HYBRID MODE
───────────
    Query Embedding ──┬──▶ LOCAL MODE  ──▶ Chunks Set A
                      │
                      └──▶ GLOBAL MODE ──▶ Chunks Set B
                                                   │
                                          Deduplicate & Merge ──▶ Context

    • Combines local + global
    • Best for: Complex queries needing both entity and relationship context


MIX MODE (DEFAULT)
──────────────────
    Query Embedding ──┬──▶ search_chunks()    ──▶ Chunks
                      │
                      ├──▶ search_entities()  ──▶ Entities ──▶ Related Chunks
                      │
                      └──▶ search_relations() ──▶ Relations ──▶ Connected Chunks
                                                   │
                                          Merge All + Deduplicate ──▶ Context

    • Full hybrid: chunks + entities + relations
    • Best for: Complex questions requiring comprehensive context

═══════════════════════════════════════════════════════════════════════════════════
                            RESPONSE GENERATION
═══════════════════════════════════════════════════════════════════════════════════

    Context + Query ──▶ Gemini 2.0 Flash ──▶ Response with [Source N] citations

    System Prompt:
    "You are a helpful assistant. Answer based on provided context.
     Cite sources using [Source N] format. Be concise but thorough."

    User Prompt:
    "## Context
     ### Entities: {entity_descriptions}
     ### Relations: {relation_descriptions}
     ### Sources: {chunk_contents}

     ## Question: {user_query}

     Provide answer with citations."
```

---

## Component Architecture

```
═══════════════════════════════════════════════════════════════════════════════════
                           FRONTEND COMPONENTS
═══════════════════════════════════════════════════════════════════════════════════

src/components/
├── index.ts                    # Barrel exports
│
├── DocumentUploader.tsx        # Drag-drop file upload with:
│   │                           # • Multi-file support
│   │                           # • Parallel uploads (max 3)
│   │                           # • XHR progress tracking
│   │                           # • Cancel/retry functionality
│   │                           # • Summary bar with stats
│   │
├── DocumentList.tsx            # Document management with:
│   │                           # • Search bar
│   │                           # • Status filters (All/Ready/Processing/Failed)
│   │                           # • Multi-select checkboxes
│   │                           # • Bulk delete with 5s undo
│   │                           # • Inline rename
│   │
├── ChatInterface.tsx           # Chat UI with:
│   │                           # • Query mode selector
│   │                           # • Message history
│   │                           # • Auto-scroll
│   │                           # • Loading states
│   │
├── ChatMessage.tsx             # Message display with:
│   │                           # • User/assistant avatars
│   │                           # • Markdown rendering
│   │                           # • Copy button (hover)
│   │                           # • Inline source badges
│   │
├── ChatHistory.tsx             # Session sidebar with:
│   │                           # • Session list
│   │                           # • Inline rename (click pencil)
│   │                           # • Delete button
│   │                           # • Relative timestamps
│   │
├── CommandPalette.tsx          # Global search (Cmd+K):
│   │                           # • Search documents
│   │                           # • Search entities
│   │                           # • Quick navigation
│   │                           # • Keyboard navigation
│   │
├── SourceReferences.tsx        # Expandable source panel
├── DataExplorer.tsx            # Entity/relation explorer
├── ThemeProvider.tsx           # Dark mode context
├── ThemeToggle.tsx             # Theme switcher dropdown
├── ErrorBoundary.tsx           # Error handling with retry
├── DocumentListSkeleton.tsx    # Loading skeletons
└── Logo.tsx                    # Brand logo

═══════════════════════════════════════════════════════════════════════════════════
                           BACKEND MODULES
═══════════════════════════════════════════════════════════════════════════════════

src/lib/
├── supabase/
│   ├── client.ts              # Browser client (anon key)
│   └── server.ts              # Server client (service role)
│
├── gemini/
│   ├── client.ts              # Gemini AI client
│   │                          # • generateContent()
│   │                          # • uploadFileToGemini()
│   │                          # • generateContentWithFile()
│   ├── embeddings.ts          # Embedding generation
│   │                          # • generateEmbedding()
│   │                          # • generateEmbeddingsBatch()
│   ├── cache.ts               # LLM response caching
│   ├── factory.ts             # Client factory (multi-org)
│   └── models.ts              # Model configurations
│
├── processing/
│   ├── router.ts              # File type → processor routing
│   ├── text-processor.ts      # TXT/MD processing
│   ├── document-processor.ts  # PDF/DOCX via Docling
│   ├── image-processor.ts     # Image → Gemini Vision
│   ├── video-processor.ts     # Video → Gemini File API
│   └── audio-processor.ts     # Audio → Gemini File API
│
├── rag/
│   ├── retriever.ts           # Multi-mode retrieval
│   │                          # • retrieve(query, mode, workspace, topK)
│   │                          # • searchChunks/Entities/Relations
│   ├── response-generator.ts  # Context → Gemini → Response
│   └── index.ts               # Module exports
│
└── auth/
    ├── admin-auth.ts          # Admin session management
    ├── api-auth.ts            # API key validation
    └── context.ts             # Auth context utilities
```

---

## API Reference

```
═══════════════════════════════════════════════════════════════════════════════════
                              API ENDPOINTS
═══════════════════════════════════════════════════════════════════════════════════

DOCUMENTS
─────────
POST   /api/upload              Upload file, triggers processing
       Body: FormData { file }
       Returns: { documentId, status, message }

GET    /api/documents           List documents (paginated)
       Query: ?page=1&limit=20&status=processed
       Returns: { documents[], total, page, limit }

DELETE /api/documents           Delete document + chunks
       Query: ?id=doc-uuid
       Returns: { success: true }

PATCH  /api/documents           Rename document
       Body: { id, file_name }
       Returns: { success: true }

GET    /api/documents/[id]/details  Get document with chunks
       Returns: { document, chunks[] }


PROCESSING STATUS
─────────────────
GET    /api/status/[id]         Get processing status
       Returns: { status, chunks_count, error_message }

GET    /api/status/[id]/stream  SSE status updates
       Returns: EventStream { status, chunks_count }


RAG QUERY
─────────
POST   /api/query               Execute RAG query
       Body: { query, mode?, workspace?, top_k? }
       Returns: { response, sources[], entities[] }

GET    /api/query               API documentation


CHAT
────
GET    /api/chat                List chat sessions
       Query: ?limit=20
       Returns: { sessions[] }

POST   /api/chat                Create new session
       Body: { title?, system_prompt?, model? }
       Returns: { id, title, ... }

GET    /api/chat/[sessionId]    Get session with messages
       Returns: { session, messages[] }

PATCH  /api/chat/[sessionId]    Update session
       Body: { title?, system_prompt?, model? }
       Returns: { success: true }

DELETE /api/chat/[sessionId]    Delete session
       Returns: { success: true }

POST   /api/chat/[sessionId]/messages  Send message
       Body: { content, role, mode? }
       Returns: { message, response?, sources? }


SEARCH
──────
GET    /api/search              Global search
       Query: ?q=search+term
       Returns: { documents[], entities[], navigation[] }


HEALTH
──────
GET    /api/health              System health check
       Returns: { status: 'ok', timestamp }


V1 API (Public, requires API key)
─────────────────────────────────
All above endpoints also available under /api/v1/* with API key auth:
Header: X-API-Key: <key>

═══════════════════════════════════════════════════════════════════════════════════
```

---

## Deployment

```
═══════════════════════════════════════════════════════════════════════════════════
                           DEPLOYMENT ARCHITECTURE
═══════════════════════════════════════════════════════════════════════════════════

┌───────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION SETUP                                  │
└───────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────────┐
                              │    CLOUDFLARE   │
                              │    (optional)   │
                              │    CDN + WAF    │
                              └────────┬────────┘
                                       │
                                       ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                               VERCEL                                           │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │                        Next.js Application                               │  │
│  │                                                                          │  │
│  │  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                 │  │
│  │  │   Pages     │    │   API       │    │   Static    │                 │  │
│  │  │  (SSR/SSG)  │    │   Routes    │    │   Assets    │                 │  │
│  │  │             │    │   (Edge)    │    │   (CDN)     │                 │  │
│  │  └─────────────┘    └─────────────┘    └─────────────┘                 │  │
│  │                                                                          │  │
│  │  Environment Variables:                                                  │  │
│  │  • NEXT_PUBLIC_SUPABASE_URL                                             │  │
│  │  • NEXT_PUBLIC_SUPABASE_ANON_KEY                                        │  │
│  │  • SUPABASE_SERVICE_ROLE_KEY                                            │  │
│  │  • GOOGLE_AI_API_KEY                                                    │  │
│  │  • DOCLING_SERVICE_URL (optional)                                       │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────┬────────────────────────────────────────┘
                                       │
           ┌───────────────────────────┼───────────────────────────┐
           │                           │                           │
           ▼                           ▼                           ▼
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│    SUPABASE         │    │    GOOGLE AI        │    │  DOCLING SERVICE    │
│                     │    │                     │    │  (Railway/Render)   │
│  • PostgreSQL       │    │  • Gemini Flash     │    │                     │
│  • pgvector         │    │  • Embedding API    │    │  • Python/FastAPI   │
│  • Storage          │    │  • File API         │    │  • Document parsing │
│  • Auth (optional)  │    │                     │    │                     │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘


═══════════════════════════════════════════════════════════════════════════════════
                           LOCAL DEVELOPMENT
═══════════════════════════════════════════════════════════════════════════════════

Terminal 1 (Next.js):
  $ cd megarag
  $ npm run dev
  → http://localhost:3000

Terminal 2 (Docling - optional for PDF/Office):
  $ cd megarag/docling-service
  $ source venv/bin/activate
  $ uvicorn main:app --port 8000
  → http://localhost:8000

Environment (.env.local):
  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
  SUPABASE_SERVICE_ROLE_KEY=eyJ...
  GOOGLE_AI_API_KEY=AI...
  DOCLING_SERVICE_URL=http://localhost:8000

═══════════════════════════════════════════════════════════════════════════════════
```

---

## Quick Reference

```
═══════════════════════════════════════════════════════════════════════════════════
                              QUICK REFERENCE
═══════════════════════════════════════════════════════════════════════════════════

SUPPORTED FILE TYPES
────────────────────
Text:     TXT, MD
Docs:     PDF, DOCX, PPTX, XLSX (requires Docling)
Images:   JPG, PNG, GIF, WebP
Video:    MP4, WebM, MOV, AVI
Audio:    MP3, WAV, OGG, FLAC, M4A, AAC


QUERY MODES
───────────
naive   → Vector search only              (simple facts)
local   → Entity-centric search           (about X)
global  → Relationship traversal          (X relates to Y)
hybrid  → local + global                  (balanced)
mix     → chunks + entities + relations   (comprehensive, DEFAULT)


ENTITY TYPES
────────────
PERSON, ORGANIZATION, LOCATION, EVENT,
CONCEPT, TECHNOLOGY, PRODUCT, DATE


KEY KEYBOARD SHORTCUTS
──────────────────────
Cmd+K (Ctrl+K)  → Open global search
Enter           → Send chat message
Shift+Enter     → New line in chat
Escape          → Close dialogs


PROJECT STRUCTURE
─────────────────
megarag/
├── src/
│   ├── app/           # Pages & API routes
│   ├── components/    # React components
│   ├── lib/           # Business logic
│   └── types/         # TypeScript definitions
├── docling-service/   # Python document parser
├── public/            # Static assets
└── vercel.json        # Deploy config

═══════════════════════════════════════════════════════════════════════════════════
```

---

*Last updated: 2025-12-22*
*Version: 1.0 (All 10 phases complete + enhancements)*
