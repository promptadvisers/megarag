import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/chat/[sessionId] - Get chat session with messages
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Get session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Chat session not found' },
        { status: 404 }
      );
    }

    // Get messages
    const { data: messages, error: messagesError } = await supabaseAdmin
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      session,
      messages: messages || [],
    });
  } catch (error) {
    console.error('Get chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chat/[sessionId] - Delete a chat session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .delete()
      .eq('id', sessionId);

    if (error) {
      console.error('Error deleting chat session:', error);
      return NextResponse.json(
        { error: 'Failed to delete chat session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/chat/[sessionId] - Update chat session (title, system_prompt, model)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();

    // Build update object with only provided fields
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.title !== undefined) {
      updateData.title = body.title;
    }
    if (body.system_prompt !== undefined) {
      updateData.system_prompt = body.system_prompt;
    }
    if (body.model !== undefined) {
      updateData.model = body.model;
    }

    const { error } = await supabaseAdmin
      .from('chat_sessions')
      .update(updateData)
      .eq('id', sessionId);

    if (error) {
      console.error('Error updating chat session:', error);
      return NextResponse.json(
        { error: 'Failed to update chat session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
