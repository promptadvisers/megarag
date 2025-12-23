-- ═══════════════════════════════════════════════════════════════════════════════
-- MegaRAG Core Schema
-- Run this FIRST in Supabase SQL Editor before other migrations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Enable the pgvector extension for embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. DOCUMENTS TABLE
-- Stores metadata about uploaded files
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS documents (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. CHUNKS TABLE
-- Stores text chunks from documents with vector embeddings
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chunks (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    document_id VARCHAR(255) REFERENCES documents(id) ON DELETE CASCADE,
    chunk_order_index INTEGER,
    content TEXT NOT NULL,
    content_vector VECTOR(768),
    tokens INTEGER,
    chunk_type VARCHAR(50) DEFAULT 'text',
    page_idx INTEGER,
    timestamp_start FLOAT,
    timestamp_end FLOAT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_type ON chunks(chunk_type);
CREATE INDEX IF NOT EXISTS idx_chunks_workspace ON chunks(workspace);

-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON chunks
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. ENTITIES TABLE
-- Stores extracted entities (people, places, organizations, etc.)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS entities (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    entity_name VARCHAR(512) NOT NULL,
    entity_type VARCHAR(128),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entities_name ON entities(entity_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_workspace ON entities(workspace);
CREATE INDEX IF NOT EXISTS idx_entities_vector ON entities
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. RELATIONS TABLE
-- Stores relationships between entities (knowledge graph edges)
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS relations (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    source_entity_id VARCHAR(512),
    target_entity_id VARCHAR(512),
    relation_type VARCHAR(256),
    description TEXT,
    content_vector VECTOR(768),
    source_chunk_ids JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_entity_id);
CREATE INDEX IF NOT EXISTS idx_relations_type ON relations(relation_type);
CREATE INDEX IF NOT EXISTS idx_relations_workspace ON relations(workspace);
CREATE INDEX IF NOT EXISTS idx_relations_vector ON relations
USING hnsw (content_vector vector_cosine_ops) WITH (m = 16, ef_construction = 64);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. CHAT TABLES
-- Stores conversation history
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    title VARCHAR(512) DEFAULT 'New Chat',
    system_prompt TEXT,
    model VARCHAR(100) DEFAULT 'gemini-2.5-flash',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    entities JSONB DEFAULT '[]'::jsonb,
    query_mode VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated ON chat_sessions(updated_at);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_workspace ON chat_sessions(workspace);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. LLM CACHE TABLE
-- Caches AI responses to reduce API calls
-- ═══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS llm_cache (
    id VARCHAR(255) PRIMARY KEY,
    prompt_hash VARCHAR(64) NOT NULL,
    response TEXT NOT NULL,
    model VARCHAR(128),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_llm_cache_hash ON llm_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires ON llm_cache(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 7. SEARCH RPC FUNCTIONS
-- These functions perform vector similarity search
-- ═══════════════════════════════════════════════════════════════════════════════

-- Search chunks by semantic similarity
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 10
) RETURNS TABLE (
    id VARCHAR,
    document_id VARCHAR,
    content TEXT,
    chunk_type VARCHAR,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.document_id,
        c.content,
        c.chunk_type,
        (1 - (c.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM chunks c
    WHERE c.content_vector IS NOT NULL
      AND 1 - (c.content_vector <=> query_embedding) > match_threshold
    ORDER BY c.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search entities by semantic similarity
CREATE OR REPLACE FUNCTION search_entities(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id VARCHAR,
    entity_name VARCHAR,
    entity_type VARCHAR,
    description TEXT,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.entity_name,
        e.entity_type,
        e.description,
        (1 - (e.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM entities e
    WHERE e.content_vector IS NOT NULL
      AND 1 - (e.content_vector <=> query_embedding) > match_threshold
    ORDER BY e.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Search relations by semantic similarity
CREATE OR REPLACE FUNCTION search_relations(
    query_embedding VECTOR(768),
    match_threshold FLOAT DEFAULT 0.3,
    match_count INT DEFAULT 20
) RETURNS TABLE (
    id VARCHAR,
    source_entity_id VARCHAR,
    target_entity_id VARCHAR,
    relation_type VARCHAR,
    description TEXT,
    similarity FLOAT
) LANGUAGE plpgsql AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.source_entity_id,
        r.target_entity_id,
        r.relation_type,
        r.description,
        (1 - (r.content_vector <=> query_embedding))::FLOAT AS similarity
    FROM relations r
    WHERE r.content_vector IS NOT NULL
      AND 1 - (r.content_vector <=> query_embedding) > match_threshold
    ORDER BY r.content_vector <=> query_embedding
    LIMIT match_count;
END;
$$;
