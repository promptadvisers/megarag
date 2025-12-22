import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/stats - Get dashboard statistics (no auth required)
 */
export async function GET(request: NextRequest) {
  const workspace = 'default';

  try {
    // Get document counts by status
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select('status')
      .eq('workspace', workspace);

    if (docError) throw docError;

    // Count by status
    const docStats = {
      total: documents?.length || 0,
      completed: documents?.filter(d => d.status === 'completed' || d.status === 'processed').length || 0,
      processing: documents?.filter(d => d.status === 'processing').length || 0,
      pending: documents?.filter(d => d.status === 'pending').length || 0,
      failed: documents?.filter(d => d.status === 'failed').length || 0,
    };

    // Get chunks count
    const { count: chunksCount } = await supabaseAdmin
      .from('chunks')
      .select('*', { count: 'exact', head: true })
      .eq('workspace', workspace);

    // Get entities count
    const { count: entitiesCount } = await supabaseAdmin
      .from('entities')
      .select('*', { count: 'exact', head: true })
      .eq('workspace', workspace);

    // Get relations count
    const { count: relationsCount } = await supabaseAdmin
      .from('relations')
      .select('*', { count: 'exact', head: true })
      .eq('workspace', workspace);

    // Get chat sessions count
    const { count: sessionsCount } = await supabaseAdmin
      .from('chat_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace', workspace);

    // Get recent documents (last 5)
    const { data: recentDocs } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, file_type, status, created_at')
      .eq('workspace', workspace)
      .order('created_at', { ascending: false })
      .limit(5);

    // Get top entity types
    const { data: entityTypes } = await supabaseAdmin
      .from('entities')
      .select('entity_type')
      .eq('workspace', workspace);

    const entityTypeCounts: Record<string, number> = {};
    entityTypes?.forEach(e => {
      entityTypeCounts[e.entity_type] = (entityTypeCounts[e.entity_type] || 0) + 1;
    });

    return NextResponse.json({
      success: true,
      data: {
        documents: docStats,
        chunks: chunksCount || 0,
        entities: entitiesCount || 0,
        relations: relationsCount || 0,
        chat_sessions: sessionsCount || 0,
        api_keys: 0,
        usage: {
          total_api_requests: 0,
          total_llm_input_tokens: 0,
          total_llm_output_tokens: 0,
          total_embedding_requests: 0,
          total_storage_bytes: 0,
        },
        recent_documents: recentDocs || [],
        entity_types: Object.entries(entityTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      },
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
