-- Chat Sessions Table
CREATE TABLE chat_sessions (
    id VARCHAR(255) PRIMARY KEY,
    workspace VARCHAR(255) DEFAULT 'default',
    title VARCHAR(512),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_sessions_workspace ON chat_sessions(workspace);
CREATE INDEX idx_chat_sessions_updated ON chat_sessions(updated_at DESC);

-- Chat Messages Table
CREATE TABLE chat_messages (
    id VARCHAR(255) PRIMARY KEY,
    session_id VARCHAR(255) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    sources JSONB DEFAULT '[]'::jsonb,
    entities JSONB DEFAULT '[]'::jsonb,
    query_mode VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
