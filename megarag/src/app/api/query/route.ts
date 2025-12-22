import { NextRequest, NextResponse } from 'next/server';
import { generateResponse } from '@/lib/rag';
import type { QueryMode, QueryRequest } from '@/types';
import type { ChatSettings } from '@/lib/rag';

const VALID_MODES: QueryMode[] = ['naive', 'local', 'global', 'hybrid', 'mix'];

interface ExtendedQueryRequest extends QueryRequest {
  system_prompt?: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as ExtendedQueryRequest;

    // Validate query
    if (!body.query || typeof body.query !== 'string' || body.query.trim() === '') {
      return NextResponse.json(
        { error: 'Query is required and must be a non-empty string' },
        { status: 400 }
      );
    }

    // Validate mode
    const mode: QueryMode = body.mode && VALID_MODES.includes(body.mode)
      ? body.mode
      : 'mix';

    // Validate top_k
    const topK = body.top_k && typeof body.top_k === 'number' && body.top_k > 0 && body.top_k <= 50
      ? body.top_k
      : 10;

    // Get workspace (default if not provided)
    const workspace = body.workspace || 'default';

    // Build chat settings
    const settings: ChatSettings = {
      systemPrompt: body.system_prompt || null,
      model: body.model || null,
    };

    // Generate response
    const response = await generateResponse(
      body.query.trim(),
      mode,
      workspace,
      topK,
      settings
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Query error:', error);

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Query failed' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'RAG Query API',
    usage: {
      method: 'POST',
      body: {
        query: 'Your question (required)',
        mode: 'Query mode: naive | local | global | hybrid | mix (default: mix)',
        workspace: 'Workspace name (default: default)',
        top_k: 'Number of results to retrieve (default: 10, max: 50)',
      },
    },
    modes: {
      naive: 'Vector search on document chunks only',
      local: 'Search entities, get related chunks',
      global: 'Search relations, traverse knowledge graph',
      hybrid: 'Combine local and global modes',
      mix: 'Full hybrid: chunks + entities + relations (recommended)',
    },
  });
}
