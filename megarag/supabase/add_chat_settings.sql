-- Migration: Add system_prompt and model to chat_sessions
-- Run this in your Supabase SQL editor

-- Add new columns to chat_sessions
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS model VARCHAR(100) DEFAULT 'gemini-2.5-flash';

-- Add comment for documentation
COMMENT ON COLUMN chat_sessions.system_prompt IS 'Custom system prompt for this chat session';
COMMENT ON COLUMN chat_sessions.model IS 'AI model to use for this chat session';
