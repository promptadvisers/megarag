import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * POST /api/chat/[sessionId]/messages - Add a message to a chat session
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    const { role, content, sources, entities, query_mode } = body;

    if (!role || !content) {
      return NextResponse.json(
        { error: 'Role and content are required' },
        { status: 400 }
      );
    }

    const messageId = uuidv4();

    const { error: messageError } = await supabaseAdmin
      .from('chat_messages')
      .insert({
        id: messageId,
        session_id: sessionId,
        role,
        content,
        sources: sources || [],
        entities: entities || [],
        query_mode,
        created_at: new Date().toISOString(),
      });

    if (messageError) {
      console.error('Error saving message:', messageError);
      return NextResponse.json(
        { error: 'Failed to save message' },
        { status: 500 }
      );
    }

    // Update session's updated_at and title (from first user message)
    if (role === 'user') {
      const { data: session } = await supabaseAdmin
        .from('chat_sessions')
        .select('title')
        .eq('id', sessionId)
        .single();

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      // Set title from first user message if it's still "New Chat"
      if (session?.title === 'New Chat') {
        updates.title = content.slice(0, 100) + (content.length > 100 ? '...' : '');
      }

      await supabaseAdmin
        .from('chat_sessions')
        .update(updates)
        .eq('id', sessionId);
    }

    return NextResponse.json({ messageId }, { status: 201 });
  } catch (error) {
    console.error('Add message error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
