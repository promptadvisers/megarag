-- White Label API Schema for MegaRAG
-- Run this in Supabase SQL Editor

-- ============================================
-- 1. Organizations (tenants)
-- ============================================
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  gemini_api_key_encrypted TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. API Keys for authentication
-- ============================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  scopes TEXT[] DEFAULT ARRAY['read', 'write'],
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  is_active BOOLEAN DEFAULT true
);

-- ============================================
-- 3. Usage tracking per org per day
-- ============================================
CREATE TABLE IF NOT EXISTS usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  api_requests INTEGER DEFAULT 0,
  llm_input_tokens INTEGER DEFAULT 0,
  llm_output_tokens INTEGER DEFAULT 0,
  embedding_requests INTEGER DEFAULT 0,
  storage_bytes BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(org_id, date)
);

CREATE TRIGGER update_usage_stats_updated_at
  BEFORE UPDATE ON usage_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 4. Admin users for panel access
-- ============================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'admin' CHECK (role IN ('owner', 'admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT now(),
  last_login_at TIMESTAMPTZ
);

-- ============================================
-- 5. Admin sessions for cookie-based auth
-- ============================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- Indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_org_id ON api_keys(org_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_usage_stats_org_date ON usage_stats(org_id, date);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug);

-- ============================================
-- Update existing tables to support org_id
-- ============================================
-- Note: The existing 'workspace' field in documents, chunks, entities, relations
-- will be used as org_id. No schema change needed, just a semantic shift.

-- ============================================
-- RPC function to increment usage
-- ============================================
CREATE OR REPLACE FUNCTION increment_usage(
  p_org_id UUID,
  p_api_requests INTEGER DEFAULT 0,
  p_llm_input_tokens INTEGER DEFAULT 0,
  p_llm_output_tokens INTEGER DEFAULT 0,
  p_embedding_requests INTEGER DEFAULT 0,
  p_storage_bytes BIGINT DEFAULT 0
)
RETURNS void AS $$
BEGIN
  INSERT INTO usage_stats (org_id, date, api_requests, llm_input_tokens, llm_output_tokens, embedding_requests, storage_bytes)
  VALUES (p_org_id, CURRENT_DATE, p_api_requests, p_llm_input_tokens, p_llm_output_tokens, p_embedding_requests, p_storage_bytes)
  ON CONFLICT (org_id, date)
  DO UPDATE SET
    api_requests = usage_stats.api_requests + EXCLUDED.api_requests,
    llm_input_tokens = usage_stats.llm_input_tokens + EXCLUDED.llm_input_tokens,
    llm_output_tokens = usage_stats.llm_output_tokens + EXCLUDED.llm_output_tokens,
    embedding_requests = usage_stats.embedding_requests + EXCLUDED.embedding_requests,
    storage_bytes = usage_stats.storage_bytes + EXCLUDED.storage_bytes,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC function to get usage summary
-- ============================================
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_org_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  total_api_requests BIGINT,
  total_llm_input_tokens BIGINT,
  total_llm_output_tokens BIGINT,
  total_embedding_requests BIGINT,
  total_storage_bytes BIGINT,
  daily_breakdown JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(api_requests), 0)::BIGINT,
    COALESCE(SUM(llm_input_tokens), 0)::BIGINT,
    COALESCE(SUM(llm_output_tokens), 0)::BIGINT,
    COALESCE(SUM(embedding_requests), 0)::BIGINT,
    COALESCE(MAX(storage_bytes), 0)::BIGINT,
    COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'date', date,
          'api_requests', api_requests,
          'llm_input_tokens', llm_input_tokens,
          'llm_output_tokens', llm_output_tokens,
          'embedding_requests', embedding_requests
        ) ORDER BY date
      ),
      '[]'::jsonb
    )
  FROM usage_stats
  WHERE org_id = p_org_id
    AND date >= p_start_date
    AND date <= p_end_date;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RPC function to validate and get API key info
-- ============================================
CREATE OR REPLACE FUNCTION validate_api_key(p_key_hash TEXT)
RETURNS TABLE (
  api_key_id UUID,
  org_id UUID,
  org_name TEXT,
  org_slug TEXT,
  gemini_api_key_encrypted TEXT,
  scopes TEXT[],
  is_valid BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ak.id,
    o.id,
    o.name,
    o.slug,
    o.gemini_api_key_encrypted,
    ak.scopes,
    (ak.is_active AND (ak.expires_at IS NULL OR ak.expires_at > now()))
  FROM api_keys ak
  JOIN organizations o ON o.id = ak.org_id
  WHERE ak.key_hash = p_key_hash
  LIMIT 1;

  -- Update last_used_at
  UPDATE api_keys SET last_used_at = now() WHERE key_hash = p_key_hash;
END;
$$ LANGUAGE plpgsql;
