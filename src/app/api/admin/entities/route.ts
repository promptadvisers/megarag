import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/admin/entities - List entities (no auth required)
 */
export async function GET(request: NextRequest) {
  const workspace = 'default';
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
  const entityType = searchParams.get('type');
  const search = searchParams.get('search');
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('entities')
      .select('*', { count: 'exact' })
      .eq('workspace', workspace)
      .order('created_at', { ascending: false });

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (search) {
      query = query.ilike('name', `%${search}%`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data: entities, error, count } = await query;

    if (error) {
      console.error('Error fetching entities:', error);
      return NextResponse.json({ success: false, error: 'Failed to fetch entities' }, { status: 500 });
    }

    // Get entity types for filter dropdown
    const { data: types } = await supabaseAdmin
      .from('entities')
      .select('entity_type')
      .eq('workspace', workspace);

    const uniqueTypes = [...new Set(types?.map(t => t.entity_type) || [])];

    return NextResponse.json({
      success: true,
      data: {
        entities: entities || [],
        available_types: uniqueTypes,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      },
    });
  } catch (error) {
    console.error('List entities error:', error);
    return NextResponse.json({ success: false, error: 'Failed to list entities' }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/entities - Bulk delete entities (no auth required)
 */
export async function DELETE(request: NextRequest) {
  const workspace = 'default';

  const body = await request.json();
  const entityIds: string[] = body.entity_ids;

  if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
    return NextResponse.json({ success: false, error: 'entity_ids array is required' }, { status: 400 });
  }

  try {
    const { error } = await supabaseAdmin
      .from('entities')
      .delete()
      .eq('workspace', workspace)
      .in('id', entityIds);

    if (error) {
      console.error('Error deleting entities:', error);
      return NextResponse.json({ success: false, error: 'Failed to delete entities' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: {
        deleted_count: entityIds.length,
        message: `Successfully deleted ${entityIds.length} entities`,
      },
    });
  } catch (error) {
    console.error('Delete entities error:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete entities' }, { status: 500 });
  }
}
