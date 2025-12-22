import { supabaseAdmin } from '@/lib/supabase/server';
import type { UsageSummary } from '@/types';

/**
 * Usage event types
 */
export type UsageEventType = 'api_request' | 'llm_call' | 'embedding' | 'storage';

/**
 * Usage event to track
 */
export interface UsageEvent {
  orgId: string;
  type: UsageEventType;
  inputTokens?: number;
  outputTokens?: number;
  embeddingRequests?: number;
  storageBytes?: number;
}

/**
 * Track usage asynchronously (fire-and-forget)
 * This doesn't block the main request
 */
export async function trackUsage(event: UsageEvent): Promise<void> {
  try {
    const { orgId, type, inputTokens, outputTokens, embeddingRequests, storageBytes } = event;

    // Prepare increment values based on event type
    const params = {
      p_org_id: orgId,
      p_api_requests: type === 'api_request' ? 1 : 0,
      p_llm_input_tokens: inputTokens || 0,
      p_llm_output_tokens: outputTokens || 0,
      p_embedding_requests: embeddingRequests || (type === 'embedding' ? 1 : 0),
      p_storage_bytes: storageBytes || 0,
    };

    await supabaseAdmin.rpc('increment_usage', params);
  } catch (error) {
    // Log but don't throw - usage tracking should not fail requests
    console.error('Failed to track usage:', error);
  }
}

/**
 * Track an API request
 */
export function trackApiRequest(orgId: string): Promise<void> {
  return trackUsage({ orgId, type: 'api_request' });
}

/**
 * Track an LLM call with token counts
 */
export function trackLlmCall(
  orgId: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  return trackUsage({
    orgId,
    type: 'llm_call',
    inputTokens,
    outputTokens,
  });
}

/**
 * Track embedding requests
 */
export function trackEmbedding(orgId: string, count: number = 1): Promise<void> {
  return trackUsage({
    orgId,
    type: 'embedding',
    embeddingRequests: count,
  });
}

/**
 * Track storage usage
 */
export function trackStorage(orgId: string, bytes: number): Promise<void> {
  return trackUsage({
    orgId,
    type: 'storage',
    storageBytes: bytes,
  });
}

/**
 * Get usage summary for an organization
 */
export async function getUsageSummary(
  orgId: string,
  startDate: Date,
  endDate: Date
): Promise<UsageSummary> {
  const { data, error } = await supabaseAdmin.rpc('get_usage_summary', {
    p_org_id: orgId,
    p_start_date: startDate.toISOString().split('T')[0],
    p_end_date: endDate.toISOString().split('T')[0],
  });

  if (error) {
    console.error('Failed to get usage summary:', error);
    throw new Error('Failed to get usage summary');
  }

  // Handle empty result
  if (!data || data.length === 0) {
    return {
      total_api_requests: 0,
      total_llm_input_tokens: 0,
      total_llm_output_tokens: 0,
      total_embedding_requests: 0,
      total_storage_bytes: 0,
      daily_breakdown: [],
    };
  }

  const result = data[0];
  return {
    total_api_requests: result.total_api_requests || 0,
    total_llm_input_tokens: result.total_llm_input_tokens || 0,
    total_llm_output_tokens: result.total_llm_output_tokens || 0,
    total_embedding_requests: result.total_embedding_requests || 0,
    total_storage_bytes: result.total_storage_bytes || 0,
    daily_breakdown: result.daily_breakdown || [],
  };
}

/**
 * Get usage for the current month
 */
export async function getCurrentMonthUsage(orgId: string): Promise<UsageSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return getUsageSummary(orgId, startOfMonth, endOfMonth);
}

/**
 * Get usage for the last N days
 */
export async function getRecentUsage(orgId: string, days: number = 30): Promise<UsageSummary> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return getUsageSummary(orgId, startDate, endDate);
}
