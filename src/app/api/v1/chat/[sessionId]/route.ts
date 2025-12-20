import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest } from '@/lib/usage/tracker';
import type { AuthContext } from '@/lib/auth/context';

interface RouteParams {
  sessionId: string;
}

/**
 * GET /api/v1/chat/[sessionId] - Get chat session with messages
 */
export const GET = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const sessionId = params?.sessionId;
    if (!sessionId) {
      return createErrorResponse('INVALID_REQUEST', 'Session ID required', 400);
    }

    try {
      // Get session
      const { data: session, error: sessionError } = await supabaseAdmin
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .eq('workspace', ctx.orgId)
        .single();

      if (sessionError || !session) {
        return createErrorResponse('NOT_FOUND', 'Chat session not found', 404);
      }

      // Get messages
      const { data: messages, error: messagesError } = await supabaseAdmin
        .from('chat_messages')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: true });

      if (messagesError) {
        console.error('Error fetching messages:', messagesError);
        return createErrorResponse('SERVER_ERROR', 'Failed to fetch messages', 500);
      }

      return createSuccessResponse({
        session,
        messages: messages || [],
      });
    } catch (error) {
      console.error('Get chat error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to get chat session', 500);
    }
  },
  { requiredScopes: ['read'] }
);

/**
 * DELETE /api/v1/chat/[sessionId] - Delete a chat session
 */
export const DELETE = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const sessionId = params?.sessionId;
    if (!sessionId) {
      return createErrorResponse('INVALID_REQUEST', 'Session ID required', 400);
    }

    try {
      // Verify session belongs to org
      const { data: session, error: fetchError } = await supabaseAdmin
        .from('chat_sessions')
        .select('id')
        .eq('id', sessionId)
        .eq('workspace', ctx.orgId)
        .single();

      if (fetchError || !session) {
        return createErrorResponse('NOT_FOUND', 'Chat session not found', 404);
      }

      // Delete session (messages will be cascade deleted)
      const { error } = await supabaseAdmin
        .from('chat_sessions')
        .delete()
        .eq('id', sessionId);

      if (error) {
        console.error('Error deleting chat session:', error);
        return createErrorResponse('SERVER_ERROR', 'Failed to delete chat session', 500);
      }

      return createSuccessResponse({
        deleted: true,
        session_id: sessionId,
      });
    } catch (error) {
      console.error('Delete chat error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to delete chat session', 500);
    }
  },
  { requiredScopes: ['write'] }
);
