import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

/**
 * GET /api/admin/organizations/[orgId]/entities - List entities with filtering
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

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
        .eq('workspace', orgId)
        .order('created_at', { ascending: false });

      // Filter by type
      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      // Search by name
      if (search) {
        query = query.ilike('name', `%${search}%`);
      }

      // Paginate
      query = query.range(offset, offset + limit - 1);

      const { data: entities, error, count } = await query;

      if (error) {
        console.error('Error fetching entities:', error);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch entities', 500);
      }

      // Get entity types for filter dropdown
      const { data: types } = await supabaseAdmin
        .from('entities')
        .select('entity_type')
        .eq('workspace', orgId);

      const uniqueTypes = [...new Set(types?.map(t => t.entity_type) || [])];

      return createAdminSuccessResponse({
        entities: entities || [],
        available_types: uniqueTypes,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      console.error('List entities error:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to list entities', 500);
    }
  }
);

/**
 * DELETE /api/admin/organizations/[orgId]/entities - Bulk delete entities
 */
export const DELETE = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    // Only owners and admins can delete
    if (ctx.role === 'viewer') {
      return createAdminErrorResponse('FORBIDDEN', 'Viewers cannot delete entities', 403);
    }

    const body = await request.json();
    const entityIds: string[] = body.entity_ids;

    if (!entityIds || !Array.isArray(entityIds) || entityIds.length === 0) {
      return createAdminErrorResponse('INVALID_REQUEST', 'entity_ids array is required', 400);
    }

    try {
      // Delete entities
      const { error } = await supabaseAdmin
        .from('entities')
        .delete()
        .eq('workspace', orgId)
        .in('id', entityIds);

      if (error) {
        console.error('Error deleting entities:', error);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete entities', 500);
      }

      return createAdminSuccessResponse({
        deleted_count: entityIds.length,
        message: `Successfully deleted ${entityIds.length} entities`,
      });
    } catch (error) {
      console.error('Delete entities error:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete entities', 500);
    }
  },
  { requiredRoles: ['owner', 'admin'] }
);
