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
 * GET /api/admin/organizations/[orgId]/relations - List relations with filtering
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
    const relationType = searchParams.get('type');
    const search = searchParams.get('search');
    const offset = (page - 1) * limit;

    try {
      let query = supabaseAdmin
        .from('relations')
        .select('*', { count: 'exact' })
        .eq('workspace', orgId)
        .order('created_at', { ascending: false });

      // Filter by type
      if (relationType) {
        query = query.eq('relation_type', relationType);
      }

      // Search by source, target, or description
      if (search) {
        query = query.or(`source_entity.ilike.%${search}%,target_entity.ilike.%${search}%,description.ilike.%${search}%`);
      }

      // Paginate
      query = query.range(offset, offset + limit - 1);

      const { data: relations, error, count } = await query;

      if (error) {
        console.error('Error fetching relations:', error);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch relations', 500);
      }

      // Get relation types for filter dropdown
      const { data: types } = await supabaseAdmin
        .from('relations')
        .select('relation_type')
        .eq('workspace', orgId);

      const uniqueTypes = [...new Set(types?.map(t => t.relation_type) || [])];

      return createAdminSuccessResponse({
        relations: relations || [],
        available_types: uniqueTypes,
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      console.error('List relations error:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to list relations', 500);
    }
  }
);

/**
 * DELETE /api/admin/organizations/[orgId]/relations - Bulk delete relations
 */
export const DELETE = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    // Only owners and admins can delete
    if (ctx.role === 'viewer') {
      return createAdminErrorResponse('FORBIDDEN', 'Viewers cannot delete relations', 403);
    }

    const body = await request.json();
    const relationIds: string[] = body.relation_ids;

    if (!relationIds || !Array.isArray(relationIds) || relationIds.length === 0) {
      return createAdminErrorResponse('INVALID_REQUEST', 'relation_ids array is required', 400);
    }

    try {
      // Delete relations
      const { error } = await supabaseAdmin
        .from('relations')
        .delete()
        .eq('workspace', orgId)
        .in('id', relationIds);

      if (error) {
        console.error('Error deleting relations:', error);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete relations', 500);
      }

      return createAdminSuccessResponse({
        deleted_count: relationIds.length,
        message: `Successfully deleted ${relationIds.length} relations`,
      });
    } catch (error) {
      console.error('Delete relations error:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete relations', 500);
    }
  },
  { requiredRoles: ['owner', 'admin'] }
);
