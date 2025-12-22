import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/search - Global search across documents and entities
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get('q')?.trim() || '';
  const workspace = 'default';

  if (!query || query.length < 2) {
    return NextResponse.json({
      success: true,
      data: { documents: [], entities: [], navigation: [] },
    });
  }

  try {
    // Search documents by file name
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('id, file_name, file_type, status, created_at')
      .eq('workspace', workspace)
      .ilike('file_name', `%${query}%`)
      .order('created_at', { ascending: false })
      .limit(5);

    // Search entities by name
    const { data: entities } = await supabaseAdmin
      .from('entities')
      .select('id, name, entity_type, description')
      .eq('workspace', workspace)
      .ilike('name', `%${query}%`)
      .limit(5);

    // Navigation items (filtered by query)
    const navigationItems = [
      { id: 'dashboard', name: 'Dashboard', path: '/dashboard', icon: 'home' },
      { id: 'chat', name: 'Chat', path: '/dashboard/chat', icon: 'message' },
      { id: 'explorer', name: 'Data Explorer', path: '/dashboard/explorer', icon: 'database' },
      { id: 'admin', name: 'Admin Dashboard', path: '/admin', icon: 'settings' },
      { id: 'settings', name: 'Settings', path: '/admin/settings', icon: 'cog' },
      { id: 'api-keys', name: 'API Keys', path: '/admin/api-keys', icon: 'key' },
      { id: 'knowledge-graph', name: 'Knowledge Graph', path: '/admin/knowledge-graph', icon: 'git-branch' },
    ];

    const filteredNavigation = navigationItems.filter(
      item => item.name.toLowerCase().includes(query.toLowerCase())
    );

    return NextResponse.json({
      success: true,
      data: {
        documents: documents || [],
        entities: entities || [],
        navigation: filteredNavigation,
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      success: true,
      data: { documents: [], entities: [], navigation: [] },
    });
  }
}
