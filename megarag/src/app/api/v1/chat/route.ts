import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest } from '@/lib/usage/tracker';
import type { AuthContext } from '@/lib/auth/context';

/**
 * POST /api/v1/chat - Create a new chat session
 */
export const POST = withApiAuth(
  async (request: NextRequest, ctx: AuthContext) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    let body: { title?: string; system_prompt?: string; model?: string };
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const sessionId = uuidv4();
    const title = body.title || 'New Chat';
    const systemPrompt = body.system_prompt || null;
    const model = body.model || 'gemini-2.5-flash';

    try {
      const { error } = await supabaseAdmin.from('chat_sessions').insert({
        id: sessionId,
        workspace: ctx.orgId, // Use org_id as workspace
        title,
        system_prompt: systemPrompt,
        model,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      if (error) {
        console.error('Error creating chat session:', error);
        return createErrorResponse('SERVER_ERROR', 'Failed to create chat session', 500);
      }

      return createSuccessResponse({
        session_id: sessionId,
        title,
        system_prompt: systemPrompt,
        model,
      });
    } catch (error) {
      console.error('Create chat error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to create chat session', 500);
    }
  },
  { requiredScopes: ['write'] }
);

/**
 * GET /api/v1/chat - List chat sessions
 */
export const GET = withApiAuth(
  async (request: NextRequest, ctx: AuthContext) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = (page - 1) * limit;

    try {
      const { data: sessions, error, count } = await supabaseAdmin
        .from('chat_sessions')
        .select('*', { count: 'exact' })
        .eq('workspace', ctx.orgId)
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching sessions:', error);
        return createErrorResponse('SERVER_ERROR', 'Failed to fetch chat sessions', 500);
      }

      return createSuccessResponse({
        sessions: sessions || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      console.error('List chats error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to list chat sessions', 500);
    }
  },
  { requiredScopes: ['read'] }
);
