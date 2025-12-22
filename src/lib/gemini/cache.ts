import { supabaseAdmin } from '@/lib/supabase/server';
import crypto from 'crypto';

/**
 * Generate a hash for a prompt to use as cache key
 */
function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex').slice(0, 64);
}

/**
 * Get cached LLM response if available
 */
export async function getCachedResponse(prompt: string): Promise<string | null> {
  const promptHash = hashPrompt(prompt);

  try {
    const { data, error } = await supabaseAdmin
      .from('llm_cache')
      .select('response')
      .eq('prompt_hash', promptHash)
      .single();

    if (error || !data) {
      return null;
    }

    return data.response;
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

/**
 * Cache an LLM response
 */
export async function cacheResponse(prompt: string, response: string): Promise<void> {
  const promptHash = hashPrompt(prompt);
  const id = `cache-${promptHash.slice(0, 16)}-${Date.now()}`;

  try {
    await supabaseAdmin.from('llm_cache').upsert(
      {
        id,
        prompt_hash: promptHash,
        response,
        created_at: new Date().toISOString(),
      },
      { onConflict: 'prompt_hash' }
    );
  } catch (err) {
    console.error('Cache write error:', err);
  }
}

/**
 * Generate content with caching
 */
export async function generateContentCached(
  prompt: string,
  generateFn: (prompt: string) => Promise<string>
): Promise<string> {
  // Check cache first
  const cached = await getCachedResponse(prompt);
  if (cached) {
    console.log('Cache hit for prompt');
    return cached;
  }

  // Generate new response
  const response = await generateFn(prompt);

  // Cache the response (don't await, fire and forget)
  cacheResponse(prompt, response).catch(() => {});

  return response;
}

/**
 * Clear old cache entries (older than 7 days)
 */
export async function clearOldCache(): Promise<number> {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  try {
    const { data, error } = await supabaseAdmin
      .from('llm_cache')
      .delete()
      .lt('created_at', sevenDaysAgo.toISOString())
      .select('id');

    if (error) {
      console.error('Cache cleanup error:', error);
      return 0;
    }

    return data?.length || 0;
  } catch (err) {
    console.error('Cache cleanup error:', err);
    return 0;
  }
}
