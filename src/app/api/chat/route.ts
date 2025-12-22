import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/chat - List all chat sessions
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = searchParams.get('workspace') || 'default';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    const { data, error } = await supabaseAdmin
      .from('chat_sessions')
      .select('*')
      .eq('workspace', workspace)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching chat sessions:', error);
      return NextResponse.json(
        { error: 'Failed to fetch chat sessions' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessions: data || [] });
  } catch (error) {
    console.error('Chat sessions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/chat - Create a new chat session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workspace = body.workspace || 'default';
    const title = body.title || 'New Chat';
    const systemPrompt = body.system_prompt || null;
    const model = body.model || 'gemini-2.5-flash';

    const sessionId = uuidv4();

    const { error } = await supabaseAdmin.from('chat_sessions').insert({
      id: sessionId,
      workspace,
      title,
      system_prompt: systemPrompt,
      model,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating chat session:', error);
      return NextResponse.json(
        { error: 'Failed to create chat session' },
        { status: 500 }
      );
    }

    return NextResponse.json({ sessionId, title, system_prompt: systemPrompt, model }, { status: 201 });
  } catch (error) {
    console.error('Create chat error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
