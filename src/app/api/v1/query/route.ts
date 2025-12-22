import { NextRequest } from 'next/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest, trackLlmCall, trackEmbedding } from '@/lib/usage/tracker';
import { generateResponse } from '@/lib/rag';
import type { AuthContext } from '@/lib/auth/context';
import type { QueryMode } from '@/types';

const VALID_MODES: QueryMode[] = ['naive', 'local', 'global', 'hybrid', 'mix'];

interface QueryRequestBody {
  query: string;
  mode?: QueryMode;
  top_k?: number;
  system_prompt?: string;
  model?: string;
}

/**
 * POST /api/v1/query - Execute a RAG query
 */
export const POST = withApiAuth(
  async (request: NextRequest, ctx: AuthContext) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    // Check for Gemini key
    if (!ctx.geminiApiKey) {
      return createErrorResponse(
        'GEMINI_KEY_MISSING',
        'This organization has not configured a Gemini API key. Configure it in the admin panel.',
        400
      );
    }

    let body: QueryRequestBody;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('INVALID_REQUEST', 'Invalid JSON body', 400);
    }

    // Validate query
    if (!body.query || typeof body.query !== 'string' || body.query.trim() === '') {
      return createErrorResponse('INVALID_REQUEST', 'Query is required and must be a non-empty string', 400);
    }

    // Validate mode
    const mode: QueryMode = body.mode && VALID_MODES.includes(body.mode) ? body.mode : 'mix';

    // Validate top_k
    const topK = body.top_k && typeof body.top_k === 'number' && body.top_k > 0 && body.top_k <= 50
      ? body.top_k
      : 10;

    try {
      // Track embedding usage (we'll do ~1 embedding for the query)
      trackEmbedding(ctx.orgId, 1);

      // Generate response using org's Gemini key
      const response = await generateResponse(
        body.query.trim(),
        mode,
        ctx.orgId, // Use org_id as workspace
        topK,
        {
          systemPrompt: body.system_prompt || null,
          model: body.model || null,
          geminiApiKey: ctx.geminiApiKey,
        }
      );

      // Estimate token usage (rough estimate)
      const inputTokens = Math.ceil(body.query.length / 4);
      const outputTokens = Math.ceil(response.response.length / 4);
      trackLlmCall(ctx.orgId, inputTokens, outputTokens);

      return createSuccessResponse(
        {
          response: response.response,
          sources: response.sources,
          entities: response.entities,
          mode_used: mode,
        },
        { input_tokens: inputTokens, output_tokens: outputTokens }
      );
    } catch (error) {
      console.error('Query error:', error);
      return createErrorResponse(
        'SERVER_ERROR',
        error instanceof Error ? error.message : 'Query failed',
        500
      );
    }
  },
  { requiredScopes: ['read'], requireGeminiKey: true }
);

/**
 * GET /api/v1/query - API documentation
 */
export const GET = withApiAuth(
  async () => {
    return createSuccessResponse({
      endpoint: 'POST /api/v1/query',
      description: 'Execute a RAG query against your document collection',
      parameters: {
        query: {
          type: 'string',
          required: true,
          description: 'The question or query to answer',
        },
        mode: {
          type: 'string',
          required: false,
          default: 'mix',
          options: VALID_MODES,
          description: 'Query mode: naive (vectors only), local (entities), global (relations), hybrid, mix (recommended)',
        },
        top_k: {
          type: 'number',
          required: false,
          default: 10,
          min: 1,
          max: 50,
          description: 'Number of results to retrieve',
        },
        system_prompt: {
          type: 'string',
          required: false,
          description: 'Custom system prompt for the response',
        },
        model: {
          type: 'string',
          required: false,
          default: 'gemini-2.5-flash',
          description: 'Model to use for response generation',
        },
      },
      example_request: {
        query: 'What are the main topics discussed in my documents?',
        mode: 'mix',
        top_k: 10,
      },
    });
  },
  { requiredScopes: ['read'] }
);
