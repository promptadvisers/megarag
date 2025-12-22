import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest, trackLlmCall, trackEmbedding } from '@/lib/usage/tracker';
import { generateResponse } from '@/lib/rag';
import type { AuthContext } from '@/lib/auth/context';
import type { QueryMode } from '@/types';

interface RouteParams {
  sessionId: string;
}

/**
 * POST /api/v1/chat/[sessionId]/messages - Send a message and get AI response
 */
export const POST = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const sessionId = params?.sessionId;
    if (!sessionId) {
      return createErrorResponse('INVALID_REQUEST', 'Session ID required', 400);
    }

    // Check for Gemini key
    if (!ctx.geminiApiKey) {
      return createErrorResponse(
        'GEMINI_KEY_MISSING',
        'This organization has not configured a Gemini API key. Configure it in the admin panel.',
        400
      );
    }

    let body: { content: string; mode?: QueryMode };
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('INVALID_REQUEST', 'Invalid JSON body', 400);
    }

    if (!body.content || typeof body.content !== 'string' || body.content.trim() === '') {
      return createErrorResponse('INVALID_REQUEST', 'Message content is required', 400);
    }

    try {
      // Verify session belongs to org and get settings
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('workspace', ctx.orgId)
        .single();

      if (sessionError || !session) {
        return createErrorResponse('NOT_FOUND', 'Chat session not found', 404);
      }

      const userContent = body.content.trim();
      const mode: QueryMode = body.mode || 'mix';

      // Save user message
      const userMessageId = uuidv4();
      await supabaseAdmin.from('chat_messages').insert({
        id: userMessageId,
        session_id: sessionId,
        role: 'user',
        content: userContent,
        query_mode: mode,
        created_at: new Date().toISOString(),
      });

      // Track embedding for query
      trackEmbedding(ctx.orgId, 1);

      // Generate AI response
      const response = await generateResponse(
        userContent,
        mode,
        ctx.orgId, // workspace = org_id
        10,
        {
          systemPrompt: session.system_prompt,
          model: session.model,
          geminiApiKey: ctx.geminiApiKey,
        }
      );

      // Save assistant message
      const assistantMessageId = uuidv4();
      await supabaseAdmin.from('chat_messages').insert({
        id: assistantMessageId,
        session_id: sessionId,
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        entities: response.entities,
        created_at: new Date().toISOString(),
      });

      // Update session timestamp
      await supabaseAdmin
        .from('chat_sessions')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', sessionId);

      // Track LLM usage
      const inputTokens = Math.ceil(userContent.length / 4);
      const outputTokens = Math.ceil(response.response.length / 4);
      trackLlmCall(ctx.orgId, inputTokens, outputTokens);

      return createSuccessResponse(
        {
          user_message: {
            id: userMessageId,
            role: 'user',
            content: userContent,
          },
          assistant_message: {
            id: assistantMessageId,
            role: 'assistant',
            content: response.response,
            sources: response.sources,
            entities: response.entities,
          },
        },
        { input_tokens: inputTokens, output_tokens: outputTokens }
      );
    } catch (error) {
      console.error('Send message error:', error);
      return createErrorResponse(
        'SERVER_ERROR',
        error instanceof Error ? error.message : 'Failed to send message',
        500
      );
    }
  },
  { requiredScopes: ['write'], requireGeminiKey: true }
);

/**
 * GET /api/v1/chat/[sessionId]/messages - Get message history
 */
export const GET = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const sessionId = params?.sessionId;
    if (!sessionId) {
      return createErrorResponse('INVALID_REQUEST', 'Session ID required', 400);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 200);
    const before = searchParams.get('before'); // Message ID to paginate before

    try {
      // Verify session belongs to org
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('workspace', ctx.orgId)
        .single();

      if (sessionError || !session) {
        return createErrorResponse('NOT_FOUND', 'Chat session not found', 404);
      }

      // Build query
      let query = supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true })
        .limit(limit);

      // If paginating, get messages before the specified ID
      if (before) {
        const { data: beforeMessage } = await supabaseAdmin
          .from('chat_messages')
          .select('created_at')
          .eq('id', before)
          .single();

        if (beforeMessage) {
          query = query.lt('created_at', beforeMessage.created_at);
        }
      }

      const { data: messages, error } = await query;

      if (error) {
        console.error('Error fetching messages:', error);
        return createErrorResponse('SERVER_ERROR', 'Failed to fetch messages', 500);
      }

      return createSuccessResponse({
        messages: messages || [],
        has_more: (messages?.length || 0) === limit,
      });
    } catch (error) {
      console.error('Get messages error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to get messages', 500);
    }
  },
  { requiredScopes: ['read'] }
);
