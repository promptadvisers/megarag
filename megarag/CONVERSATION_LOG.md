# MegaRAG Development Conversation Log

> This document chronicles the development journey of MegaRAG, a multi-modal RAG system built through AI-assisted pair programming with Claude.

---

## Table of Contents

1. [Project Genesis](#project-genesis)
2. [Phase 1: Supabase Setup](#phase-1-supabase-setup)
3. [Phase 2: Next.js Project Setup](#phase-2-nextjs-project-setup)
4. [Phase 3: File Upload & Basic UI](#phase-3-file-upload--basic-ui)
5. [Phase 4: Text Processing Pipeline](#phase-4-text-processing-pipeline)
6. [Phase 5: Document Processing](#phase-5-document-processing-officepdf)
7. [Phase 6: Video & Audio Processing](#phase-6-video--audio-processing)
8. [Phase 7: Entity Extraction](#phase-7-entity-extraction--knowledge-graph)
9. [Phase 8: RAG Query System](#phase-8-rag-query-system)
10. [Phase 9: Chat Interface](#phase-9-chat-interface)
11. [Phase 10: Polish & Deploy](#phase-10-polish--deploy)
12. [Latest Session: Feature Enhancements](#latest-session-feature-enhancements)
13. [Key Decisions & Learnings](#key-decisions--learnings)

---

## Project Genesis

### Initial Vision

The project started with a clear goal: build a comprehensive RAG (Retrieval-Augmented Generation) system that could handle ALL file types - not just text documents, but videos, audio, images, and complex Office documents.

### Why Gemini?

After comparing options, Gemini 2.0 Flash was chosen for several compelling reasons:

| Feature | Gemini 2.0 Flash | GPT-4o |
|---------|------------------|--------|
| Context Window | 1,048,576 tokens | 128,000 tokens |
| Native Video | Yes | No |
| Native Audio | Yes | No |
| Cost (input) | $0.50/1M tokens | $2.50/1M tokens |
| Context Caching | 90% savings | No |

### Architecture Decisions

**Database**: Supabase (PostgreSQL + pgvector)
- Fully managed PostgreSQL
- Native vector search with pgvector extension
- Built-in file storage
- Realtime subscriptions (for future features)
- Easy RPC functions for vector search

**Frontend**: Next.js 14 with App Router
- Server components for better performance
- API routes for backend logic
- TypeScript for type safety
- Tailwind CSS + shadcn/ui for rapid UI development

**Document Parsing**: Docling (separate Python service)
- Best-in-class PDF/Office parsing
- Extracts text, tables, images
- Runs as a microservice

---

## Phase 1: Supabase Setup

### Conversation Summary

**User Request**: "Let's start with Supabase setup"

**What Was Discussed**:
1. Creating a new Supabase project
2. Enabling pgvector extension
3. Designing the database schema

**Key Implementation Details**:

```sql
-- Enable vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Documents table
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

-- Chunks table with vector column
CREATE TABLE chunks (
    id VARCHAR(255) PRIMARY KEY,
    document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    content_vector VECTOR(768),  -- Gemini text-embedding-004 dimensions
    chunk_type VARCHAR(50) DEFAULT 'text',
    -- ... other fields
);

-- HNSW index for fast vector search
CREATE INDEX idx_chunks_vector ON chunks
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);
```

**Outcome**:
- Project ID: `phenoutbdxuvwfewtzka`
- URL: `https://phenoutbdxuvwfewtzka.supabase.co`
- Region: `us-east-1`
- Tables created: documents, chunks, entities, relations, llm_cache
- Storage bucket: `documents` (private, 100MB limit)

---

## Phase 2: Next.js Project Setup

### Conversation Summary

**User Request**: "Set up the Next.js project with all the basics"

**What Was Discussed**:
1. Project initialization with TypeScript
2. Tailwind CSS configuration
3. shadcn/ui component library setup
4. Environment variables structure

**Commands Executed**:

```bash
# Create Next.js project
npx create-next-app@latest megarag --typescript --tailwind --eslint --app --src-dir

# Install dependencies
npm install @supabase/supabase-js @google/generative-ai react-dropzone lucide-react uuid
npm install class-variance-authority clsx tailwind-merge

# Set up shadcn/ui
npx shadcn@latest init -y -d
npx shadcn@latest add button card dialog input progress textarea tabs sonner -y
```

**Outcome**:
- Project structure created at `/megarag`
- Supabase clients: `src/lib/supabase/client.ts` (browser) and `server.ts` (API)
- Gemini client: `src/lib/gemini/client.ts`
- TypeScript types: `src/types/database.ts`

---

## Phase 3: File Upload & Basic UI

### Conversation Summary

**User Request**: "Build the file upload functionality and dashboard"

**What Was Discussed**:
1. Drag-and-drop upload with react-dropzone
2. File type validation and icons
3. Upload progress tracking
4. Document list with status indicators

**Key Components Created**:

```typescript
// DocumentUploader.tsx
// - Drag-drop zone with file preview
// - Upload progress bar
// - File type icons (FileText, FileImage, FileVideo, FileAudio)
// - Error handling and retry

// DocumentList.tsx
// - Document cards with metadata
// - Status badges (pending, processing, processed, failed)
// - Delete with confirmation dialog
// - File size and chunk count display
```

**Outcome**:
- Full upload flow working
- Dashboard at `/dashboard` with stats cards
- API routes: `/api/upload`, `/api/documents`

---

## Phase 4: Text Processing Pipeline

### Conversation Summary

**User Request**: "Implement text file processing with chunking and embeddings"

**What Was Discussed**:
1. Token-based chunking strategy
2. Sentence-boundary awareness for cleaner chunks
3. Embedding generation with Gemini text-embedding-004
4. Async processing to not block uploads

**Key Implementation Details**:

```typescript
// text-processor.ts
const CHUNK_SIZE = 800;  // tokens
const CHUNK_OVERLAP = 100;  // tokens

// Chunking algorithm:
// 1. Split text into sentences
// 2. Group sentences until reaching chunk size
// 3. Include overlap from previous chunk
// 4. Respect sentence boundaries

// embeddings.ts
const model = 'text-embedding-004';  // 768 dimensions
// Batch processing with rate limiting
// Returns: number[][] (array of embedding vectors)
```

**Outcome**:
- TXT and MD files processed automatically on upload
- Chunks stored with embeddings in database
- Status updates: pending → processing → processed/failed

---

## Phase 5: Document Processing (Office/PDF)

### Conversation Summary

**User Request**: "Handle PDF, DOCX, PPTX, XLSX files"

**What Was Discussed**:
1. Docling as the document parsing solution
2. Python microservice architecture
3. Handling different content types (text, tables, images)
4. Using Gemini to describe tables and images

**Key Implementation Details**:

Created `docling-service/` Python FastAPI service:

```python
# main.py
@app.post("/parse")
async def parse_document(file: UploadFile):
    # Convert with Docling
    result = converter.convert(tmp_path)

    # Extract content types
    content_list = []
    for item in doc.texts:
        content_list.append({"type": "text", "content": item.text})
    for table in doc.tables:
        content_list.append({"type": "table", "content": table.export_to_markdown()})
    for picture in doc.pictures:
        content_list.append({"type": "image", "content": picture.image.uri})

    return {"content_list": content_list}
```

Created content describer for tables/images:

```typescript
// content-describer.ts
// Tables: Gemini describes the table structure and key data
// Images from docs: Gemini Vision generates searchable descriptions
```

**Outcome**:
- Docling service at `http://localhost:8000`
- PDF, DOCX, PPTX, XLSX files fully processed
- Tables converted to searchable text via Gemini descriptions

---

## Phase 6: Video & Audio Processing

### Conversation Summary

**User Request**: "Add video and audio file support"

**What Was Discussed**:
1. Gemini File API for uploading media
2. Native video understanding (no frame extraction needed!)
3. Audio transcription
4. Timestamped chunk creation

**Key Implementation Details**:

```typescript
// video-processor.ts
async function processVideo(buffer: Buffer, mimeType: string) {
  // 1. Upload to Gemini File API
  const uploadResult = await fileManager.uploadFile(tempPath, {
    mimeType,
    displayName: fileName
  });

  // 2. Wait for processing
  while (file.state === FileState.PROCESSING) {
    await new Promise(r => setTimeout(r, 2000));
    file = await fileManager.getFile(file.name);
  }

  // 3. Analyze video with prompt
  const result = await geminiFlash.generateContent([
    { fileData: { mimeType, fileUri: file.uri } },
    { text: "Analyze this video. Provide summary and key moments with timestamps." }
  ]);

  // 4. Create timestamped chunks
  // - Overview chunk (full summary)
  // - Key moment chunks (if detected)
  // - 30-second segment chunks (fallback)
}

// audio-processor.ts
// Similar flow but with transcription focus
```

**Outcome**:
- Video files (MP4, WebM, MOV, AVI) fully supported
- Audio files (MP3, WAV, OGG, FLAC, M4A, AAC) with transcription
- Timestamped chunks for precise retrieval

---

## Phase 7: Entity Extraction & Knowledge Graph

### Conversation Summary

**User Request**: "Extract entities and relationships for knowledge graph"

**What Was Discussed**:
1. Entity types to extract
2. Relationship extraction
3. Deduplication strategy
4. Embeddings for entities/relations

**Key Implementation Details**:

```typescript
// entity-extractor.ts
const ENTITY_TYPES = [
  'PERSON', 'ORGANIZATION', 'LOCATION', 'EVENT',
  'CONCEPT', 'TECHNOLOGY', 'PRODUCT', 'DATE'
];

const RELATION_TYPES = [
  'WORKS_FOR', 'FOUNDED', 'LEADS',
  'LOCATED_IN', 'HEADQUARTERS_IN',
  'CREATED', 'DEVELOPED', 'INVENTED',
  'PARTICIPATED_IN', 'ORGANIZED',
  'RELATED_TO', 'PART_OF', 'DEPENDS_ON'
];

// Extraction prompt asks Gemini to return structured JSON
// Deduplication merges entities by normalized name
// Each entity/relation gets its own embedding for search
```

**Outcome**:
- Automatic entity extraction from all content types
- Relationships captured and stored
- Knowledge graph searchable via vector embeddings

---

## Phase 8: RAG Query System

### Conversation Summary

**User Request**: "Build the retrieval system with multiple query modes"

**What Was Discussed**:
1. Different retrieval strategies
2. When to use each mode
3. Context building for Gemini
4. Source citation format

**Key Implementation Details**:

```typescript
// retriever.ts
async function retrieve(query: string, mode: QueryMode) {
  const queryEmbedding = await generateEmbedding(query);

  switch (mode) {
    case 'naive':
      return searchChunks(queryEmbedding);

    case 'local':
      const entities = await searchEntities(queryEmbedding);
      return getChunksFromEntities(entities);

    case 'global':
      const relations = await searchRelations(queryEmbedding);
      return traverseGraph(relations);

    case 'hybrid':
      const [local, global] = await Promise.all([
        retrieve(query, 'local'),
        retrieve(query, 'global')
      ]);
      return deduplicate([...local, ...global]);

    case 'mix':
      // Full combination: chunks + entities + relations
      return fullHybridSearch(queryEmbedding);
  }
}

// response-generator.ts
// Builds context from retrieved results
// Sends to Gemini with citation instructions
// Returns response with [Source N] references
```

**Outcome**:
- 5 query modes implemented
- API endpoint: `POST /api/query`
- Source citations included in responses

---

## Phase 9: Chat Interface

### Conversation Summary

**User Request**: "Build a chat interface with the RAG system"

**What Was Discussed**:
1. Chat UI components
2. Query mode selector
3. Source reference display
4. Message history

**Key Components Created**:

```typescript
// ChatInterface.tsx
// - Query mode dropdown with descriptions
// - Message input with keyboard shortcuts
// - Auto-scroll to latest message
// - Loading states

// ChatMessage.tsx
// - User/assistant distinction with avatars
// - Markdown rendering for responses
// - Inline source badges
// - Copy button on hover

// SourceReferences.tsx
// - Expandable panel showing source details
// - Document name, type, similarity score
// - Content preview
```

**Outcome**:
- Full chat page at `/dashboard/chat`
- Query mode selection working
- Source citations displayed inline

---

## Phase 10: Polish & Deploy

### Conversation Summary

**User Request**: "Add polish features and prepare for deployment"

**What Was Discussed**:
1. Dark mode support
2. Error boundaries
3. Loading skeletons
4. LLM response caching
5. Vercel deployment config

**Key Implementations**:

```typescript
// ThemeProvider.tsx + ThemeToggle.tsx
// - next-themes integration
// - Light/Dark/System options
// - Persists preference

// ErrorBoundary.tsx
// - Catches React errors
// - User-friendly error display
// - Retry functionality

// DocumentListSkeleton.tsx
// - Skeleton loading states
// - Smooth loading experience

// cache.ts
// - SHA-256 hash of prompts
// - Store in llm_cache table
// - 7-day expiration
```

**Outcome**:
- Dark mode working across app
- Error handling improved
- Ready for Vercel deployment

---

## Latest Session: Feature Enhancements

### Session Date: December 22, 2025

### Conversation Log

#### 1. Spinning Up the App

**User**: "spin this up on http://localhost:3000/"

**Claude**: Started the Next.js development server. Encountered port 3000 being in use, killed the existing process, and restarted successfully.

```bash
cd megarag && npm run dev
# Port 3000 was in use - killed existing process
lsof -ti:3000 | xargs kill -9
npm run dev
# Server started successfully on localhost:3000
```

---

#### 2. Bulk Upload Feature

**User**: "i want to enable bulk uploads, is that something we can do effectively? showing status of individual uploads etc"

**Claude**: Entered plan mode to explore the existing implementation. Found that react-dropzone already supported multiple files, but files were uploaded sequentially.

**Plan Approved**: Add parallel uploads with concurrency control, real progress tracking, and summary statistics.

**Implementation**:

```typescript
// DocumentUploader.tsx - Key changes

const MAX_CONCURRENT_UPLOADS = 3;

interface FileUpload {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
  documentId?: string;
  xhr?: XMLHttpRequest;  // For cancel support
}

// XHR-based upload with real progress
const uploadFile = async (upload: FileUpload) => {
  const xhr = new XMLHttpRequest();

  xhr.upload.addEventListener('progress', (event) => {
    if (event.lengthComputable) {
      const progress = Math.round((event.loaded / event.total) * 100);
      setUploads(prev => prev.map(u =>
        u.id === upload.id ? { ...u, progress } : u
      ));
    }
  });

  // ... promise wrapper for XHR
};

// Summary bar showing:
// - Total/uploading/success/failed counts
// - Cancel all button
// - Retry failed button
// - Clear completed button
```

**Outcome**: Bulk uploads working with:
- Up to 3 concurrent uploads
- Real progress bars per file
- Cancel individual or all uploads
- Retry failed uploads
- Summary statistics

---

#### 3. Fixing Console Errors

**User**: (shared screenshots showing "No session" errors)

**Claude**: Identified the issue in admin pages throwing errors instead of graceful handling.

**Fix**:

```typescript
// Before (src/app/admin/settings/page.tsx)
if (!session) {
  throw new Error('No session');  // Causes console error
}

// After
if (!session) {
  return;  // Graceful early return
}
```

Applied same fix to `api-keys/page.tsx` and `page.tsx` (AdminDashboardPage).

---

#### 4. Feature Enhancement Discussion

**User**: "is there anything else you see in the app that we could do, to make it absolutely awesome"

**Claude**: Explored the codebase comprehensively and identified enhancement opportunities:

1. **Global Search (Cmd+K)** - Quick access to anything
2. **Document Filters** - Search bar + status filters in document list
3. **Copy Buttons** - Copy message content and sources
4. **Chat Rename** - Inline rename in sidebar
5. **Batch Delete with Undo** - Multi-select + 5-second undo window

**User**: "implement those and add those features please, they sound great"

---

#### 5. Feature Implementation

**Claude** implemented all features:

**A. Command Palette (Cmd+K)**:

```typescript
// CommandPalette.tsx
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search documents, entities, navigation items
  // Debounced search with 200ms delay
  // Keyboard navigation support
}
```

**B. Document Filters**:

```typescript
// DocumentList.tsx additions
const [searchQuery, setSearchQuery] = useState('');
const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

// Filter types: all, processed, processing, failed
// Search input with clear button
// Status filter buttons with counts
```

**C. Copy Buttons**:

```typescript
// ChatMessage.tsx - CopyButton component
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Shows check icon for 2s after copy
}
```

**D. Chat Rename**:

```typescript
// ChatHistory.tsx - Inline editing
const [editingId, setEditingId] = useState<string | null>(null);
const [editTitle, setEditTitle] = useState('');

// Click pencil icon to enter edit mode
// Form submits on Enter, cancels on Escape
// PATCH /api/chat/[sessionId] to save
```

**E. Batch Delete with Undo**:

```typescript
// DocumentList.tsx - Undo delete pattern
const UNDO_DELAY = 5000;  // 5 seconds
const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>();

const scheduleDelete = (ids: string[]) => {
  // Add to pending set (hides from UI immediately)
  setPendingDeleteIds(prev => new Set([...prev, ...ids]));

  // Show toast with undo button
  toast(`${ids.length} documents will be deleted`, {
    duration: UNDO_DELAY,
    action: {
      label: 'Undo',
      onClick: () => undoDelete(ids)
    }
  });

  // Actually delete after 5 seconds
  setTimeout(() => executeDelete(ids), UNDO_DELAY);
};
```

---

## Key Decisions & Learnings

### Architecture Decisions

1. **Separate Docling Service**: Python for document parsing, Node.js for everything else
   - *Reason*: Best-in-class document parsing is in Python ecosystem
   - *Trade-off*: Additional service to deploy

2. **pgvector over Pinecone/Weaviate**: Native PostgreSQL vector search
   - *Reason*: Simpler architecture, all data in one place
   - *Trade-off*: Need to manage HNSW index parameters

3. **5 Query Modes**: Different strategies for different questions
   - *Reason*: One-size-fits-all retrieval often fails
   - *Insight*: `mix` mode works best for complex questions

4. **Token-based Chunking with Sentence Boundaries**
   - *Reason*: Pure character splitting breaks mid-word/sentence
   - *Trade-off*: Slightly more complex implementation

5. **XHR for Upload Progress**: XMLHttpRequest instead of fetch
   - *Reason*: `fetch` doesn't support upload progress events
   - *Trade-off*: Callback-based API instead of async/await

### Things That Worked Well

- **Gemini File API for Video/Audio**: No frame extraction needed, just upload and analyze
- **Deferred Entity Extraction**: Runs after chunking, can be disabled
- **Undo Pattern for Deletes**: Prevents accidental data loss
- **Command Palette**: Quick access improves UX significantly

### Things to Improve in Future

- **Real-time Processing Status**: Currently polling, could use SSE/WebSocket
- **Streaming Responses**: Gemini supports streaming for chat
- **Batch Entity Extraction**: Currently per-chunk, could batch for efficiency
- **Caching Layer**: Redis for faster repeated queries

---

## Files Created/Modified (Latest Session)

| File | Action | Purpose |
|------|--------|---------|
| `src/components/CommandPalette.tsx` | Created | Global search Cmd+K |
| `src/app/api/search/route.ts` | Created | Search API endpoint |
| `src/components/DocumentList.tsx` | Modified | Added filters, search, batch delete |
| `src/components/ChatMessage.tsx` | Modified | Added copy buttons |
| `src/components/ChatHistory.tsx` | Modified | Added inline rename |
| `src/components/DocumentUploader.tsx` | Modified | Bulk uploads with progress |
| `src/app/dashboard/page.tsx` | Modified | Added CommandPalette |
| `src/app/admin/settings/page.tsx` | Fixed | Graceful session handling |
| `src/app/admin/api-keys/page.tsx` | Fixed | Graceful session handling |
| `src/app/admin/page.tsx` | Fixed | Suppressed fetch errors |

---

## Running the Project

```bash
# Terminal 1: Next.js
cd megarag
npm run dev
# → http://localhost:3000

# Terminal 2: Docling (for PDF/Office)
cd megarag/docling-service
source venv/bin/activate
uvicorn main:app --port 8000
# → http://localhost:8000

# Environment Variables Required (.env.local)
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
GOOGLE_AI_API_KEY=AI...
DOCLING_SERVICE_URL=http://localhost:8000
```

---

*Document generated: December 22, 2025*
*Total Development Time: ~10 phases over multiple sessions*
*Current Status: Production Ready*
