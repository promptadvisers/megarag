# MegaRAG System - Implementation Plan

## Overview

Build a comprehensive RAG system that handles all file types (DOCX, PPTX, XLSX, TXT, MP4, MP3, PDF, images) with:
- **Frontend**: Next.js + React with drag-and-drop upload
- **Storage**: Supabase PostgreSQL + pgvector
- **LLM**: Gemini 3 Flash (vision/extraction/embeddings) - 1M context window, native multimodal
- **Scale**: Personal/small team (<1000 docs)

---

## Why Gemini 3 Flash

| Feature | Gemini 3 Flash | GPT-4o |
|---------|----------------|--------|
| Context Window | 1,048,576 tokens | 128,000 tokens |
| Native Video | Yes | No (frame extraction needed) |
| Native Audio | Yes | No |
| MMMU-Pro Score | 81.2% (#1) | - |
| Pricing | $0.50/1M in, $3/1M out | $2.50/1M in, $10/1M out |
| Context Caching | 90% cost reduction | No |

---

# Phase 1: Supabase Setup ✅ COMPLETED

## 1.1 Create Supabase Project ✅
- [x] Create new Supabase project
- [x] Enable pgvector extension
- [x] Note down project URL and anon key
- [x] Set up storage bucket for file uploads

**Actual Values:**
- **Project Name:** `megarag`
- **Project ID:** `phenoutbdxuvwfewtzka`
- **Region:** `us-east-1`
- **URL:** `https://phenoutbdxuvwfewtzka.supabase.co`
- **Anon Key:** `[REDACTED - see .env.local]`

## 1.2 Create Database Schema ✅

### Documents Table
- [x] Create `documents` table
```sql
CREATE TABLE documents (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    file_name VARCHAR(1024) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    file_size BIGINT,
    file_path TEXT,
    status VARCHAR(64) DEFAULT 'pending',
    chunks_count INTEGER DEFAULT 0,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_documents_status ON documents(status);
CREATE INDEX idx_documents_file_type ON documents(file_type);
```

### Chunks Table
- [x] Create `chunks` table with vector column
```sql
CREATE TABLE chunks (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
    chunk_order_index INTEGER,
    content TEXT NOT NULL,
    content_vector VECTOR(768),  -- Gemini text-embedding-004
    tokens INTEGER,
    chunk_type VARCHAR(50) DEFAULT 'text',
    page_idx INTEGER,
    timestamp_start FLOAT,
    timestamp_end FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_chunks_document_id ON chunks(document_id);
CREATE INDEX idx_chunks_vector ON chunks
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### Entities Table
- [x] Create `entities` table
```sql
CREATE TABLE entities (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    entity_name VARCHAR(512) NOT NULL,
    entity_type VARCHAR(128),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_entities_name ON entities(entity_name);
CREATE INDEX idx_entities_vector ON entities
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### Relations Table
- [x] Create `relations` table
```sql
CREATE TABLE relations (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    source_entity_id VARCHAR(512),
    target_entity_id VARCHAR(512),
    relation_type VARCHAR(256),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_relations_source ON relations(source_entity_id);
CREATE INDEX idx_relations_target ON relations(target_entity_id);
CREATE INDEX idx_relations_vector ON relations
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

### LLM Cache Table
- [x] Create `llm_cache` table
```sql
CREATE TABLE llm_cache (
    id VARCHAR(255) PRIMARY KEY,
    prompt_hash VARCHAR(64),
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_cache_prompt_hash ON llm_cache(prompt_hash);
```

## 1.3 Create RPC Functions ✅
- [x] Create vector search function for chunks
```sql
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
) RETURNS TABLE (id VARCHAR, document_id VARCHAR, content TEXT, chunk_type VARCHAR, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT c.id, c.document_id, c.content, c.chunk_type,
           1 - (c.content_vector <=> query_embedding) AS similarity
    FROM chunks c
    WHERE c.content_vector IS NOT NULL
      AND 1 - (c.content_vector <=> query_embedding) > match_threshold
    ORDER BY c.content_vector <=> query_embedding
    LIMIT match_count;
END; $$;
```

- [x] Create vector search function for entities
```sql
CREATE OR REPLACE FUNCTION search_entities(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (id VARCHAR, entity_name VARCHAR, entity_type VARCHAR, description TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.entity_name, e.entity_type, e.description,
           1 - (e.content_vector <=> query_embedding) AS similarity
    FROM entities e
    WHERE e.content_vector IS NOT NULL
      AND 1 - (e.content_vector <=> query_embedding) > match_threshold
    ORDER BY e.content_vector <=> query_embedding
    LIMIT match_count;
END; $$;
```

- [x] Create vector search function for relations
```sql
CREATE OR REPLACE FUNCTION search_relations(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (id VARCHAR, source_entity_id VARCHAR, target_entity_id VARCHAR, relation_type VARCHAR, description TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.source_entity_id, r.target_entity_id, r.relation_type, r.description,
           1 - (r.content_vector <=> query_embedding) AS similarity
    FROM relations r
    WHERE r.content_vector IS NOT NULL
      AND 1 - (r.content_vector <=> query_embedding) > match_threshold
    ORDER BY r.content_vector <=> query_embedding
    LIMIT match_count;
END; $$;
```

## 1.4 Create Storage Bucket ✅
- [x] Create `documents` storage bucket in Supabase
- [x] Set up public/private access policies (private bucket, service role access)
- [x] Configure file size limits (100MB max)

**Storage Bucket Details:**
- **Bucket Name:** `documents`
- **Access:** Private
- **File Size Limit:** 100MB
- **Allowed MIME Types:** PDF, DOCX, PPTX, XLSX, TXT, MD, MP4, MP3, WAV, JPEG, PNG, GIF, WebP

---

# Phase 2: Next.js Project Setup ✅ COMPLETED

## 2.1 Initialize Project ✅
- [x] Create Next.js 14 project with App Router
```bash
npx create-next-app@latest megarag --typescript --tailwind --eslint --app --src-dir
```
- [x] Install dependencies
```bash
npm install @supabase/supabase-js @google/generative-ai react-dropzone lucide-react uuid
npm install class-variance-authority clsx tailwind-merge
npm install -D @types/uuid
```
- [x] Set up shadcn/ui
```bash
npx shadcn@latest init -y -d
npx shadcn@latest add button card dialog input progress textarea tabs sonner -y
```

**Project Location:** `/Users/marwankashef/Desktop/Early AI-dopters/RAG-mania/megarag`

## 2.2 Configure Environment ✅
- [x] Create `.env.local` file
```env
NEXT_PUBLIC_SUPABASE_URL=https://phenoutbdxuvwfewtzka.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Get from Supabase Dashboard
GOOGLE_AI_API_KEY=your_gemini_api_key  # Get from Google AI Studio
DOCLING_SERVICE_URL=http://localhost:8000
```

**Note:** Service Role Key and Gemini API Key need to be obtained manually and added to `.env.local`

## 2.3 Create Project Structure ✅
- [x] Create directory structure
```
src/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   │   ├── page.tsx
│   │   └── chat/page.tsx
│   └── api/
│       ├── upload/route.ts
│       ├── documents/route.ts
│       ├── query/route.ts
│       └── status/[id]/route.ts
├── components/
│   ├── DocumentUploader.tsx
│   ├── DocumentList.tsx
│   ├── ChatInterface.tsx
│   └── SourceReferences.tsx
├── lib/
│   ├── supabase/client.ts
│   ├── gemini/client.ts
│   ├── processing/
│   └── rag/
└── types/
    └── database.ts
```

## 2.4 Create Supabase Client ✅
- [x] Create `src/lib/supabase/client.ts` (client-side with anon key)
- [x] Create `src/lib/supabase/server.ts` (server-side with service role key)
- [x] Create database types from Supabase schema (`src/types/database.ts`)

## 2.5 Create Gemini Client ✅
- [x] Create `src/lib/gemini/client.ts`
```typescript
// Using gemini-2.0-flash (latest stable) and text-embedding-004
// Includes helper functions: generateEmbedding, generateEmbeddingsBatch,
// generateContent, generateContentWithMedia
```

---

# Phase 3: File Upload & Basic UI ✅ COMPLETED

## 3.1 Create Document Uploader Component ✅
- [x] Create `src/components/DocumentUploader.tsx` with react-dropzone
- [x] Support file types: PDF, DOCX, PPTX, XLSX, TXT, MD, MP4, MP3, WAV, JPG, PNG, GIF, WebP
- [x] Show upload progress
- [x] Display file type icons (FileText, FileImage, FileVideo, FileAudio)

## 3.2 Create Document List Component ✅
- [x] Create `src/components/DocumentList.tsx`
- [x] Show document name, type, status, date, file size, chunk count
- [x] Add delete functionality with confirmation dialog
- [x] Show processing status indicator (pending, processing, processed, failed)

## 3.3 Create Upload API Route ✅
- [x] Create `src/app/api/upload/route.ts`
- [x] Upload file to Supabase Storage (`documents` bucket)
- [x] Create document record in database with status='pending'
- [x] Return document ID for status tracking

## 3.4 Create Documents API Route ✅
- [x] Create `src/app/api/documents/route.ts`
- [x] GET: List all documents with pagination (page, limit, status filter)
- [x] DELETE: Remove document, chunks, and storage file

## 3.5 Create Dashboard Page ✅
- [x] Create `src/app/dashboard/page.tsx`
- [x] Integrate DocumentUploader and DocumentList
- [x] Add navigation to chat page
- [x] Add statistics card (total, ready, processing, failed)
- [x] Created landing page at `src/app/page.tsx`
- [x] Created placeholder chat page at `src/app/dashboard/chat/page.tsx`

**Files Created:**
- `src/components/DocumentUploader.tsx` - Drag-and-drop file uploader with progress
- `src/components/DocumentList.tsx` - Document list with status and delete
- `src/components/index.ts` - Component exports
- `src/app/api/upload/route.ts` - File upload API
- `src/app/api/documents/route.ts` - Document CRUD API
- `src/app/dashboard/page.tsx` - Main dashboard
- `src/app/dashboard/chat/page.tsx` - Chat placeholder (Phase 9)
- `src/app/page.tsx` - Landing page

---

# Phase 4: Text Processing Pipeline ✅ COMPLETED

## 4.1 Create Text Processor ✅
- [x] Create `src/lib/processing/text-processor.ts`
- [x] Implement token-based chunking (800 tokens, 100 overlap)
- [x] Handle TXT and MD files
- [x] Sentence-boundary-aware chunking for better context preservation

## 4.2 Create Embedding Generator ✅
- [x] Create `src/lib/gemini/embeddings.ts`
- [x] Use Gemini `text-embedding-004` model (768 dimensions)
- [x] Batch embedding generation with rate limiting
- [x] Helper functions: `generateEmbedding`, `generateEmbeddingsBatch`, `addEmbeddingsToChunks`

## 4.3 Create Processing Router ✅
- [x] Create `src/lib/processing/router.ts`
- [x] Route files to appropriate processor by extension
- [x] Handle processing errors gracefully
- [x] Placeholder responses for unsupported file types (PDF, DOCX, etc. for future phases)

## 4.4 Integrate Text Processing ✅
- [x] Update upload API to trigger processing asynchronously
- [x] Store chunks with embeddings in database
- [x] Update document status on completion (pending → processing → processed/failed)
- [x] Created status API endpoint: `/api/status/[id]`

## 4.5 Test Text Processing ✅
- [x] Build verification passed
- [x] Ready for manual testing with TXT/MD files

**Files Created:**
- `src/lib/processing/text-processor.ts` - Token-based text chunking
- `src/lib/processing/router.ts` - File type routing and processing orchestration
- `src/lib/processing/index.ts` - Module exports
- `src/lib/gemini/embeddings.ts` - Gemini embedding generation
- `src/app/api/status/[id]/route.ts` - Document status polling endpoint

**Processing Flow:**
1. File uploaded → stored in Supabase Storage
2. Document record created with status='pending'
3. If TXT/MD: processing triggered asynchronously
4. Text chunked (800 tokens, 100 overlap)
5. Embeddings generated via Gemini text-embedding-004
6. Chunks stored in database with vectors
7. Document status updated to 'processed' or 'failed'

**Supported File Types (Processing):**
- TXT, MD: Full processing with chunking + embeddings
- PDF, DOCX, PPTX, XLSX: Upload works, processing in Phase 5
- MP4, MP3, WAV: Upload works, processing in Phase 6
- Images: Upload works, processing in Phase 5

---

# Phase 5: Document Processing (Office/PDF) ✅ COMPLETED

## 5.1 Set Up Docling Integration ✅
- [x] Create Python backend service (FastAPI) for Docling
- [x] Configure Docling for DOCX, PPTX, XLSX, PDF parsing
- [x] Set up API endpoint for document parsing (`/parse`)
- [x] Created Dockerfile for containerized deployment

**Docling Service Files:**
- `docling-service/main.py` - FastAPI service with `/parse` and `/health` endpoints
- `docling-service/requirements.txt` - Python dependencies
- `docling-service/Dockerfile` - Container deployment
- `docling-service/README.md` - Setup instructions

**To run Docling service:**
```bash
cd megarag/docling-service
pip install -r requirements.txt
uvicorn main:app --port 8000
```

## 5.2 Create Document Processor ✅
- [x] Create `src/lib/processing/document-processor.ts`
- [x] Create `src/lib/processing/docling-client.ts` - Client to call Docling API
- [x] Call Docling to extract content list
- [x] Handle text, tables, images from parsed documents

## 5.3 Create Table Processor ✅
- [x] Extract tables from Docling output (Markdown format)
- [x] Use Gemini 2.0 Flash to generate table descriptions
- [x] Create chunks for tables with both description and content
- [x] Created `src/lib/processing/content-describer.ts`

## 5.4 Create Image Processor ✅
- [x] Create `src/lib/processing/image-processor.ts`
- [x] Use Gemini 2.0 Flash Vision for image descriptions
- [x] Process standalone image files (JPG, PNG, GIF, WebP)
- [x] Create chunks with image descriptions for semantic search

## 5.5 Test Document Processing ✅
- [x] Build verification passed
- [x] Ready for manual testing (requires Docling service running)

**Files Created:**
- `docling-service/` - Complete Python FastAPI service for Docling
- `src/lib/processing/docling-client.ts` - Docling API client
- `src/lib/processing/document-processor.ts` - Document processing orchestration
- `src/lib/processing/content-describer.ts` - Gemini-based content description
- `src/lib/processing/image-processor.ts` - Standalone image processing

**Processing Flow (Documents):**
1. Upload PDF/DOCX/PPTX/XLSX → stored in Supabase
2. Router detects document type → calls Docling
3. Docling extracts text, tables, images
4. Text → chunked as before
5. Tables → Gemini describes → chunk with description + markdown
6. Images → Gemini Vision describes → chunk with description
7. All chunks get embeddings → stored in database

**Supported File Types:**
- PDF, DOCX, PPTX, XLSX: Via Docling (requires service running)
- JPG, PNG, GIF, WebP: Direct Gemini Vision processing
- TXT, MD: Direct text processing (Phase 4)

---

# Phase 6: Video & Audio Processing ✅ COMPLETED

## 6.1 Create Video Processor ✅
- [x] Create `src/lib/processing/video-processor.ts`
- [x] Upload video to Gemini 2.0 Flash (native video support via File API)
- [x] Generate video description and transcript
- [x] Create timestamped chunks (30-second segments or key moments)

## 6.2 Create Audio Processor ✅
- [x] Create `src/lib/processing/audio-processor.ts`
- [x] Upload audio to Gemini 2.0 Flash (native audio support via File API)
- [x] Generate transcription
- [x] Chunk transcription by time segments or paragraphs

## 6.3 Gemini 2.0 Flash Video/Audio Integration ✅
- [x] Updated `src/lib/gemini/client.ts` with File API support
- [x] Added `uploadFileToGemini()` - uploads to Gemini File API, waits for processing
- [x] Added `generateContentWithFile()` - generates content using uploaded file URI
- [x] Added `deleteGeminiFile()` - cleans up uploaded files

```typescript
// Updated implementation using GoogleAIFileManager
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';

const fileManager = new GoogleAIFileManager(apiKey);
const uploadResult = await fileManager.uploadFile(tempPath, { mimeType, displayName });

// Wait for processing
let file = uploadResult.file;
while (file.state === FileState.PROCESSING) {
  await new Promise((resolve) => setTimeout(resolve, 2000));
  file = await fileManager.getFile(file.name);
}

// Generate content with file
const result = await geminiFlash.generateContent([
  { fileData: { mimeType, fileUri: file.uri } },
  { text: prompt }
]);
```

## 6.4 Test Video/Audio Processing ✅
- [x] Build verification passed
- [x] Ready for manual testing with MP4, WebM, MOV, AVI video files
- [x] Ready for manual testing with MP3, WAV, OGG, FLAC, M4A, AAC audio files

**Files Created:**
- `src/lib/processing/video-processor.ts` - Video processing with Gemini File API
- `src/lib/processing/audio-processor.ts` - Audio processing with Gemini File API

**Updated Files:**
- `src/lib/gemini/client.ts` - Added File API functions (uploadFileToGemini, generateContentWithFile, deleteGeminiFile)
- `src/lib/processing/router.ts` - Added video/audio routing with VIDEO_TYPES and AUDIO_TYPES
- `src/lib/processing/index.ts` - Added exports for video/audio processors

**Processing Flow (Video):**
1. Video uploaded → stored in Supabase Storage
2. Router detects video type → triggers processVideo
3. Video buffer downloaded → uploaded to Gemini File API
4. Wait for Gemini to process file
5. Generate video overview with summary + timestamps
6. Create overview chunk
7. If key moments detected → create chunks for each key moment
8. Otherwise → create 30-second segment chunks
9. All chunks get embeddings → stored in database
10. Gemini file deleted (cleanup)

**Processing Flow (Audio):**
1. Audio uploaded → stored in Supabase Storage
2. Router detects audio type → triggers processAudio
3. Audio buffer downloaded → uploaded to Gemini File API
4. Wait for Gemini to process file
5. Generate full transcription + summary + timestamps
6. Create summary chunk
7. If topic timestamps detected → create chunks for each topic
8. Otherwise → split transcription into token-based chunks
9. All chunks get embeddings → stored in database
10. Gemini file deleted (cleanup)

**Supported Media Types:**
| Type | Extensions | MIME Types |
|------|------------|------------|
| Video | mp4, webm, mov, avi | video/mp4, video/webm, video/quicktime, video/x-msvideo |
| Audio | mp3, wav, ogg, flac, m4a, aac | audio/mpeg, audio/wav, audio/ogg, audio/flac, audio/mp4, audio/aac |

**Environment Variables:**
- `VIDEO_SEGMENT_SECONDS` - Default segment length for videos (default: 30)
- `AUDIO_SEGMENT_SECONDS` - Default segment length for audio (default: 60)

---

# Phase 7: Entity Extraction & Knowledge Graph ✅ COMPLETED

## 7.1 Create Entity Extractor ✅
- [x] Create `src/lib/processing/entity-extractor.ts`
- [x] Use Gemini 2.0 Flash with entity extraction prompt
- [x] Extract entities: PERSON, ORGANIZATION, LOCATION, EVENT, CONCEPT, TECHNOLOGY, PRODUCT, DATE

## 7.2 Create Relation Extractor ✅
- [x] Extract relationships between entities (in same extraction call)
- [x] Store relation type and description
- [x] Link relations to source chunks via source_chunk_ids

## 7.3 Generate Entity/Relation Embeddings ✅
- [x] Generate embeddings for entity descriptions (entity name + description)
- [x] Generate embeddings for relation descriptions (source + type + target + description)
- [x] Store in respective tables with content_vector

## 7.4 Integrate Entity Extraction into Pipeline ✅
- [x] Run entity extraction after chunking (in processDocument)
- [x] Deduplicate entities by normalized name
- [x] Merge entity descriptions from multiple chunks
- [x] Optional via ENABLE_ENTITY_EXTRACTION env var

## 7.5 Test Entity Extraction ✅
- [x] Build verification passed
- [x] Ready for manual testing with documents containing entities

**Files Created:**
- `src/lib/processing/entity-extractor.ts` - Entity and relation extraction with Gemini

**Updated Files:**
- `src/lib/processing/router.ts` - Added entity extraction after chunk processing
- `src/lib/processing/index.ts` - Added entity extractor exports

**Key Functions:**
- `extractEntitiesFromText(content)` - Extract entities and relations from text using Gemini
- `processEntitiesForDocument(documentId, chunks, workspace)` - Full entity processing pipeline
- `deduplicateEntities(entities)` - Deduplicate and merge entities by normalized name
- `getEntitiesForDocument(documentId)` - Get entities for a document
- `deleteEntitiesForDocument(documentId)` - Clean up entities when document deleted

**Entity Types Supported:**
- PERSON: Individual people, historical figures
- ORGANIZATION: Companies, institutions, teams
- LOCATION: Places, cities, countries
- EVENT: Named events, conferences
- CONCEPT: Abstract ideas, theories
- TECHNOLOGY: Software, hardware, tools
- PRODUCT: Physical or digital products
- DATE: Specific dates, time periods

**Relationship Types Supported:**
- WORKS_FOR, FOUNDED, LEADS (person-organization)
- LOCATED_IN, HEADQUARTERS_IN (entity-location)
- CREATED, DEVELOPED, INVENTED (entity-product/technology)
- PARTICIPATED_IN, ORGANIZED (entity-event)
- RELATED_TO, PART_OF, DEPENDS_ON (general)

**Processing Flow:**
1. Document processed → chunks created and stored
2. Entity extraction triggered (if enabled)
3. For each text-based chunk (text, audio, video_segment):
   - Gemini extracts entities and relations as JSON
4. Entities deduplicated by normalized name
5. Descriptions merged from multiple sources
6. Embeddings generated for entities and relations
7. Stored in `entities` and `relations` tables

**Environment Variables:**
- `ENABLE_ENTITY_EXTRACTION` - Set to 'false' to disable (default: enabled)

---

# Phase 8: RAG Query System ✅ COMPLETED

## 8.1 Create Retriever ✅
- [x] Create `src/lib/rag/retriever.ts`
- [x] Implement vector search on chunks (using search_chunks RPC)
- [x] Implement vector search on entities (using search_entities RPC)
- [x] Implement vector search on relations (using search_relations RPC)

## 8.2 Implement Query Modes ✅
- [x] `naive`: Vector search on chunks only
- [x] `local`: Search entities → get related chunks via source_chunk_ids
- [x] `global`: Search relations → traverse graph, get linked entities and chunks
- [x] `hybrid`: Combine local + global (parallel execution, deduplicated results)
- [x] `mix`: Full hybrid (chunks + entities + relations, recommended default)

## 8.3 Create Response Generator ✅
- [x] Create `src/lib/rag/response-generator.ts`
- [x] Build context from retrieved chunks/entities/relations
- [x] Use Gemini 2.0 Flash to generate response
- [x] Include source citations with [Source N] format
- [x] Return document info with sources (name, type)

## 8.4 Create Query API Route ✅
- [x] Create `src/app/api/query/route.ts`
- [x] Accept query, mode, workspace, top_k parameters
- [x] Return response with sources and entities
- [x] GET endpoint with API documentation

## 8.5 Test Query System ✅
- [x] Build verification passed
- [x] Ready for manual testing

**Files Created:**
- `src/lib/rag/retriever.ts` - Vector search and retrieval with all query modes
- `src/lib/rag/response-generator.ts` - Gemini-based response generation with citations
- `src/lib/rag/index.ts` - Module exports
- `src/app/api/query/route.ts` - Query API endpoint

**Query Modes:**
| Mode | Description | Best For |
|------|-------------|----------|
| `naive` | Vector search on chunks only | Simple fact lookup |
| `local` | Search entities → get related chunks | Entity-focused queries |
| `global` | Search relations → traverse graph | Relationship queries |
| `hybrid` | Combine local + global | Balanced retrieval |
| `mix` | Full hybrid: chunks + entities + relations | Complex queries (default) |

**API Usage:**
```bash
# POST /api/query
curl -X POST http://localhost:3000/api/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is the relationship between X and Y?",
    "mode": "mix",
    "workspace": "default",
    "top_k": 10
  }'
```

**Response Format:**
```json
{
  "response": "Based on the context, [Source 1]...",
  "sources": [
    {
      "id": "chunk-id",
      "content": "Chunk content preview...",
      "document_id": "doc-id",
      "document_name": "file.pdf",
      "document_type": "pdf",
      "similarity": 0.85
    }
  ],
  "entities": [
    { "name": "Entity Name", "type": "ORGANIZATION" }
  ]
}
```

**Key Functions:**
- `retrieve(query, mode, workspace, topK)` - Main retrieval function
- `generateResponse(query, mode, workspace, topK)` - Full RAG pipeline
- `searchChunks/searchEntities/searchRelations` - Individual vector searches

---

# Phase 9: Chat Interface ✅ COMPLETED

## 9.1 Create Chat Components ✅
- [x] Create `src/components/ChatInterface.tsx`
- [x] Create `src/components/ChatMessage.tsx`
- [x] Create `src/components/SourceReferences.tsx`

## 9.2 Implement Chat Features ✅
- [x] Query mode selector (naive, local, global, hybrid, mix)
- [x] Message history display
- [x] Source references with links to documents
- [x] Loading states

## 9.3 Create Chat Page ✅
- [x] Create `src/app/dashboard/chat/page.tsx`
- [x] Integrate chat components
- [x] Navigation header with back to documents

## 9.4 Test Chat Interface ✅
- [x] Build verification passed
- [x] Ready for manual testing

**Files Created:**
- `src/components/ChatInterface.tsx` - Main chat interface with query mode selector
- `src/components/ChatMessage.tsx` - Individual message display (user/assistant)
- `src/components/SourceReferences.tsx` - Expandable source citations panel

**UI Components Added (via shadcn):**
- `src/components/ui/collapsible.tsx` - For expandable source cards
- `src/components/ui/badge.tsx` - For entity type badges
- `src/components/ui/select.tsx` - For query mode dropdown

**Chat Features:**
| Feature | Description |
|---------|-------------|
| Query Mode Selector | Dropdown to select between naive, local, global, hybrid, mix modes |
| Mode Descriptions | Contextual help text explaining each mode |
| Message History | Scrollable list of user/assistant messages |
| Source Citations | Inline source badges with similarity scores |
| Expandable Sources | Click message to see full source details |
| Loading States | Spinner and status text during query processing |
| Clear Chat | Button to reset conversation |
| Keyboard Shortcuts | Enter to send, Shift+Enter for newline |

**Chat Flow:**
1. User enters question in textarea
2. Selects query mode (default: mix)
3. Presses Enter or clicks Send
4. Loading indicator shows while querying
5. Response appears with inline source citations
6. Click on assistant message to see detailed sources
7. Sources show document name, type, similarity, and content preview

---

# Phase 10: Polish & Deploy ✅ COMPLETED

## 10.1 Add Processing Status ✅
- [x] Create `src/app/api/status/[id]/stream/route.ts` with SSE
- [x] Real-time status polling with automatic updates
- [x] Proper error handling and timeout management

## 10.2 Error Handling ✅
- [x] Add error boundaries (`src/components/ErrorBoundary.tsx`)
- [x] `withErrorBoundary` HOC for functional components
- [x] User-friendly error messages with retry option

## 10.3 UI Polish ✅
- [x] Add loading skeletons (`src/components/DocumentListSkeleton.tsx`)
- [x] DocumentListSkeleton, StatsSkeleton, ChatMessageSkeleton
- [x] Add dark mode support with next-themes
- [x] ThemeProvider and ThemeToggle components
- [x] Theme toggle in dashboard and chat headers

## 10.4 Performance Optimization ✅
- [x] Add LLM response caching (`src/lib/gemini/cache.ts`)
- [x] getCachedResponse, cacheResponse, generateContentCached
- [x] clearOldCache for automatic cleanup (7 days)
- [x] Hash-based cache keys for prompt deduplication

## 10.5 Deploy ✅
- [x] Create Vercel config (`vercel.json`)
- [x] API routes configured with 60s max duration
- [x] Build verification passed

**Files Created:**
- `src/components/ThemeProvider.tsx` - next-themes provider wrapper
- `src/components/ThemeToggle.tsx` - Light/Dark/System mode dropdown
- `src/components/ErrorBoundary.tsx` - React error boundary with retry
- `src/components/DocumentListSkeleton.tsx` - Loading skeletons
- `src/app/api/status/[id]/stream/route.ts` - SSE status endpoint
- `src/lib/gemini/cache.ts` - LLM response caching utilities
- `vercel.json` - Vercel deployment configuration

**UI Components Added (via shadcn):**
- `src/components/ui/skeleton.tsx` - Skeleton loading component
- `src/components/ui/switch.tsx` - Toggle switch
- `src/components/ui/dropdown-menu.tsx` - Dropdown menu

**npm Packages Added:**
- `next-themes` - Theme management for Next.js

**Deployment Instructions:**
1. Push to GitHub
2. Connect repository to Vercel
3. Configure environment variables in Vercel dashboard:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `GOOGLE_AI_API_KEY`
   - `DOCLING_SERVICE_URL` (optional, for PDF/Office processing)
4. Deploy

---

# MegaRAG Implementation Complete

All 10 phases have been successfully implemented:

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Supabase Setup | ✅ Complete |
| 2 | Next.js Project Setup | ✅ Complete |
| 3 | File Upload & Basic UI | ✅ Complete |
| 4 | Text Processing Pipeline | ✅ Complete |
| 5 | Document Processing (Office/PDF) | ✅ Complete |
| 6 | Video & Audio Processing | ✅ Complete |
| 7 | Entity Extraction & Knowledge Graph | ✅ Complete |
| 8 | RAG Query System | ✅ Complete |
| 9 | Chat Interface | ✅ Complete |
| 10 | Polish & Deploy | ✅ Complete |

---

# File Processing Reference

| File Type | Processor | Chunking Strategy | Gemini Model |
|-----------|-----------|-------------------|--------------|
| TXT, MD | text-processor | 800 tokens, 100 overlap | text-embedding-004 |
| DOCX, PPTX, XLSX | Docling → document-processor | Extract all content types | gemini-3-flash |
| PDF | Docling → document-processor | Extract all content types | gemini-3-flash |
| JPG, PNG, GIF, WebP | image-processor | Single chunk = description | gemini-3-flash (vision) |
| MP4 | video-processor | Native video → 30s segments | gemini-3-flash (video) |
| MP3, WAV | audio-processor | Native audio → transcription | gemini-3-flash (audio) |

---

# Query Modes Reference

| Mode | Description | Best For |
|------|-------------|----------|
| `naive` | Vector search on chunks only | Simple fact lookup |
| `local` | Search entities → get related chunks | Entity-focused queries |
| `global` | Search relations → traverse graph | Relationship queries |
| `hybrid` | Combine local + global | Balanced retrieval |
| `mix` | Full hybrid: chunks + entities + relations | Complex queries |

---

# Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "@supabase/supabase-js": "^2",
    "@google/generative-ai": "^0.21",
    "react-dropzone": "^14",
    "@radix-ui/react-dialog": "latest",
    "@radix-ui/react-progress": "latest",
    "@radix-ui/react-tabs": "latest",
    "class-variance-authority": "latest",
    "clsx": "latest",
    "tailwind-merge": "latest",
    "lucide-react": "latest"
  }
}
```

---

# Critical Reference Files

From existing repos (inspiration only - not copying code):
- `LightRAG/lightrag/kg/postgres_impl.py` - PostgreSQL schema patterns
- `RAG-Anything/raganything/modalprocessors.py` - Multimodal processing patterns
- `LightRAG/lightrag/prompt.py` - Entity extraction prompt ideas
- `VideoRAG/VideoRAG-algorithm/videorag/_videoutil/split.py` - Video segmentation concepts
- `RAG-Anything/raganything/parser.py` - Docling integration patterns

---

# Appendix A: Docling Integration Approach

## Problem
Docling is a Python library. Our Next.js app runs on Node.js. We need to bridge this gap.

## Recommended Solution: Python FastAPI Microservice

Deploy a lightweight Python service alongside the Next.js app.

### Docling Service (`docling-service/main.py`)
```python
from fastapi import FastAPI, UploadFile, File
from fastapi.responses import JSONResponse
from docling.document_converter import DocumentConverter
import tempfile
import os

app = FastAPI()
converter = DocumentConverter()

@app.post("/parse")
async def parse_document(file: UploadFile = File(...)):
    # Save uploaded file temporarily
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as tmp:
        content = await file.read()
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Convert document
        result = converter.convert(tmp_path)
        doc = result.document

        # Extract content list
        content_list = []

        # Extract text blocks
        for item in doc.texts:
            content_list.append({
                "type": "text",
                "content": item.text,
                "page_idx": item.prov[0].page if item.prov else 0
            })

        # Extract tables
        for table in doc.tables:
            content_list.append({
                "type": "table",
                "content": table.export_to_markdown(),
                "page_idx": table.prov[0].page if table.prov else 0
            })

        # Extract images (paths)
        for picture in doc.pictures:
            content_list.append({
                "type": "image",
                "content": picture.image.uri if picture.image else None,
                "page_idx": picture.prov[0].page if picture.prov else 0
            })

        return JSONResponse({"success": True, "content_list": content_list})

    finally:
        os.unlink(tmp_path)

@app.get("/health")
def health():
    return {"status": "ok"}
```

### Docling Service Requirements (`docling-service/requirements.txt`)
```
fastapi>=0.109.0
uvicorn>=0.27.0
python-multipart>=0.0.6
docling>=2.0.0
```

### Docling Service Dockerfile
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .
EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Calling from Next.js
```typescript
// src/lib/processing/docling-client.ts
const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';

export async function parseDocument(file: File): Promise<ContentItem[]> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Docling parsing failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.content_list;
}
```

### Deployment Options
1. **Local Development**: Run `uvicorn main:app --reload` alongside Next.js
2. **Production**: Deploy to Railway, Render, or Fly.io as a separate service
3. **Docker Compose**: Run both services together

---

# Appendix B: Full LLM Prompts

## Entity Extraction Prompt

```typescript
export const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are a Knowledge Graph Specialist. Your task is to extract entities and relationships from text.

## Entity Types
- PERSON: Individual people, historical figures, characters
- ORGANIZATION: Companies, institutions, agencies, teams
- LOCATION: Places, cities, countries, addresses
- EVENT: Named events, conferences, incidents
- CONCEPT: Abstract ideas, theories, methodologies
- TECHNOLOGY: Software, hardware, tools, frameworks
- PRODUCT: Physical or digital products
- DATE: Specific dates, time periods

## Output Format
Return a JSON object with two arrays:

{
  "entities": [
    {
      "name": "Entity Name",
      "type": "ENTITY_TYPE",
      "description": "Brief description of the entity in context"
    }
  ],
  "relations": [
    {
      "source": "Source Entity Name",
      "target": "Target Entity Name",
      "type": "RELATIONSHIP_TYPE",
      "description": "Description of how they are related"
    }
  ]
}

## Relationship Types
- WORKS_FOR, FOUNDED, LEADS (person-organization)
- LOCATED_IN, HEADQUARTERS_IN (entity-location)
- CREATED, DEVELOPED, INVENTED (entity-product/technology)
- PARTICIPATED_IN, ORGANIZED (entity-event)
- RELATED_TO, PART_OF, DEPENDS_ON (general)

## Guidelines
1. Only extract clearly mentioned entities, don't infer
2. Use the exact name as it appears in the text
3. Keep descriptions concise (1-2 sentences)
4. Ensure relationship source/target match extracted entity names exactly
5. Skip generic terms that aren't meaningful entities`;

export const ENTITY_EXTRACTION_USER_PROMPT = `Extract all entities and relationships from the following text:

---
{chunk_content}
---

Return valid JSON only.`;
```

## Image Description Prompt

```typescript
export const IMAGE_DESCRIPTION_PROMPT = `Analyze this image and provide a detailed description for search and retrieval purposes.

Include:
1. **Main Subject**: What is the primary focus of the image?
2. **Visual Elements**: Describe key objects, people, text, colors, layout
3. **Context**: What setting or scenario does this represent?
4. **Technical Details**: If it's a chart/diagram/screenshot, describe the data or information shown
5. **Relevance**: What topics or queries might this image be relevant for?

Format your response as a single paragraph optimized for semantic search.`;
```

## Table Description Prompt

```typescript
export const TABLE_DESCRIPTION_PROMPT = `Analyze this table and provide a comprehensive description.

Table content:
{table_markdown}

Include:
1. **Purpose**: What information does this table convey?
2. **Structure**: How many rows/columns? What are the headers?
3. **Key Data Points**: Highlight the most important values or trends
4. **Insights**: What conclusions can be drawn from this data?
5. **Context**: What questions could this table answer?

Format your response as a descriptive paragraph suitable for semantic search.`;
```

## Video Segment Prompt

```typescript
export const VIDEO_SEGMENT_PROMPT = `Analyze this video segment and provide a detailed description.

Segment timeframe: {start_time}s - {end_time}s

Describe:
1. **Visual Content**: What is shown in the video frames?
2. **Actions**: What activities or movements occur?
3. **Audio/Speech**: Summarize any spoken content or sounds
4. **Key Moments**: What are the most significant events in this segment?
5. **Context**: How does this segment relate to the overall video?

Format as a searchable paragraph that captures both visual and audio content.`;
```

## RAG Response Prompt

```typescript
export const RAG_RESPONSE_SYSTEM_PROMPT = `You are a helpful assistant that answers questions based on provided context.

## Guidelines
1. Only use information from the provided context
2. If the context doesn't contain enough information, say so
3. Cite your sources using [Source X] format
4. Be concise but thorough
5. If multiple sources agree, synthesize the information
6. Maintain factual accuracy - don't add information not in context`;

export const RAG_RESPONSE_USER_PROMPT = `## Context

### Relevant Entities
{entities_context}

### Relationships
{relations_context}

### Source Documents
{chunks_context}

---

## Question
{user_query}

---

Provide a comprehensive answer based on the context above. Cite sources as [Source 1], [Source 2], etc.`;
```

---

# Appendix C: TypeScript Interfaces

```typescript
// src/types/database.ts

// ============================================
// Core Database Types
// ============================================

export type DocumentStatus = 'pending' | 'processing' | 'processed' | 'failed';
export type ChunkType = 'text' | 'image' | 'table' | 'equation' | 'video_segment' | 'audio';
export type EntityType = 'PERSON' | 'ORGANIZATION' | 'LOCATION' | 'EVENT' | 'CONCEPT' | 'TECHNOLOGY' | 'PRODUCT' | 'DATE';
export type QueryMode = 'naive' | 'local' | 'global' | 'hybrid' | 'mix';

// ============================================
// Document Types
// ============================================

export interface Document {
  id: string;
  workspace: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  file_path: string | null;
  status: DocumentStatus;
  chunks_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface DocumentInsert {
  id?: string;
  workspace?: string;
  file_name: string;
  file_type: string;
  file_size?: number;
  file_path?: string;
  status?: DocumentStatus;
  metadata?: Record<string, unknown>;
}

// ============================================
// Chunk Types
// ============================================

export interface Chunk {
  id: string;
  workspace: string;
  document_id: string;
  chunk_order_index: number;
  content: string;
  content_vector: number[] | null;
  tokens: number | null;
  chunk_type: ChunkType;
  page_idx: number | null;
  timestamp_start: number | null;
  timestamp_end: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ChunkInsert {
  id?: string;
  workspace?: string;
  document_id: string;
  chunk_order_index: number;
  content: string;
  content_vector?: number[];
  tokens?: number;
  chunk_type?: ChunkType;
  page_idx?: number;
  timestamp_start?: number;
  timestamp_end?: number;
  metadata?: Record<string, unknown>;
}

export interface ChunkWithScore extends Chunk {
  similarity: number;
}

// ============================================
// Entity Types
// ============================================

export interface Entity {
  id: string;
  workspace: string;
  entity_name: string;
  entity_type: EntityType | string;
  description: string | null;
  content_vector: number[] | null;
  source_chunk_ids: string[];
  created_at: string;
}

export interface EntityInsert {
  id?: string;
  workspace?: string;
  entity_name: string;
  entity_type: EntityType | string;
  description?: string;
  content_vector?: number[];
  source_chunk_ids?: string[];
}

export interface EntityWithScore extends Entity {
  similarity: number;
}

// ============================================
// Relation Types
// ============================================

export interface Relation {
  id: string;
  workspace: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  description: string | null;
  content_vector: number[] | null;
  source_chunk_ids: string[];
  created_at: string;
}

export interface RelationInsert {
  id?: string;
  workspace?: string;
  source_entity_id: string;
  target_entity_id: string;
  relation_type: string;
  description?: string;
  content_vector?: number[];
  source_chunk_ids?: string[];
}

export interface RelationWithScore extends Relation {
  similarity: number;
}

// ============================================
// Processing Types
// ============================================

export interface ContentItem {
  type: 'text' | 'image' | 'table' | 'equation';
  content: string;
  page_idx?: number;
  metadata?: Record<string, unknown>;
}

export interface ProcessingResult {
  chunks: ChunkInsert[];
  entities: EntityInsert[];
  relations: RelationInsert[];
}

export interface ExtractionResult {
  entities: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  relations: Array<{
    source: string;
    target: string;
    type: string;
    description: string;
  }>;
}

// ============================================
// Query Types
// ============================================

export interface QueryRequest {
  query: string;
  mode?: QueryMode;
  workspace?: string;
  top_k?: number;
}

export interface QueryResponse {
  response: string;
  sources: Array<{
    id: string;
    content: string;
    document_id: string;
    similarity: number;
  }>;
  entities: Array<{
    name: string;
    type: string;
  }>;
}

export interface RetrievalResult {
  chunks: ChunkWithScore[];
  entities: EntityWithScore[];
  relations: RelationWithScore[];
  context: string;
}

// ============================================
// API Types
// ============================================

export interface UploadResponse {
  documentId: string;
  status: DocumentStatus;
  message: string;
}

export interface ProcessingStatus {
  status: DocumentStatus;
  progress: number;
  error?: string;
}

// ============================================
// Component Props Types
// ============================================

export interface DocumentUploaderProps {
  onUploadComplete?: (documentId: string) => void;
  onUploadError?: (error: Error) => void;
  maxFileSizeMB?: number;
}

export interface DocumentListProps {
  documents: Document[];
  onDelete?: (documentId: string) => void;
  isLoading?: boolean;
}

export interface ChatInterfaceProps {
  onQueryModeChange?: (mode: QueryMode) => void;
  defaultMode?: QueryMode;
}

export interface ChatMessageProps {
  role: 'user' | 'assistant';
  content: string;
  sources?: QueryResponse['sources'];
  timestamp?: Date;
}

export interface SourceReferencesProps {
  sources: QueryResponse['sources'];
  onSourceClick?: (documentId: string) => void;
}
```

---

# Appendix D: Environment Variables

```env
# .env.local

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Google AI (Gemini)
GOOGLE_AI_API_KEY=your-gemini-api-key

# Docling Service
DOCLING_SERVICE_URL=http://localhost:8000

# Optional: Processing Config
MAX_FILE_SIZE_MB=100
CHUNK_SIZE_TOKENS=800
CHUNK_OVERLAP_TOKENS=100
VIDEO_SEGMENT_SECONDS=30
```

---

# Appendix E: Gemini API Limits & Considerations

## Gemini 3 Flash Limits
| Limit | Value |
|-------|-------|
| Context Window | 1,048,576 tokens |
| Max Output | 65,536 tokens |
| Rate Limit (free) | 15 RPM, 1M TPM |
| Rate Limit (paid) | 2000 RPM, 4M TPM |
| Max Video Size | 1GB |
| Max Video Length | 1 hour |
| Max Audio Length | 9.5 hours |

## Cost Optimization
1. **Context Caching**: Enable for repeated document queries (90% savings)
2. **Thinking Levels**: Use `minimal` for simple tasks, `high` for complex reasoning
3. **Batch Embeddings**: Process multiple texts in single API call
4. **LLM Cache Table**: Cache entity extraction results by content hash
