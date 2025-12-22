import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import { getCurrentMonthUsage } from '@/lib/usage/tracker';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

/**
 * GET /api/admin/organizations/[orgId]/stats - Get dashboard statistics
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    try {
      // Get document counts by status
      const { data: documents, error: docError } = await supabaseAdmin
        .from('documents')
        .select('status', { count: 'exact' })
        .eq('workspace', orgId);

      if (docError) throw docError;

      // Count by status
      const docStats = {
        total: documents?.length || 0,
        completed: documents?.filter(d => d.status === 'completed').length || 0,
        processing: documents?.filter(d => d.status === 'processing').length || 0,
        pending: documents?.filter(d => d.status === 'pending').length || 0,
        failed: documents?.filter(d => d.status === 'failed').length || 0,
      };

      // Get chunks count
      const { count: chunksCount } = await supabaseAdmin
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .eq('workspace', orgId);

      // Get entities count
      const { count: entitiesCount } = await supabaseAdmin
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .eq('workspace', orgId);

      // Get relations count
      const { count: relationsCount } = await supabaseAdmin
        .from('relations')
        .select('*', { count: 'exact', head: true })
        .eq('workspace', orgId);

      // Get chat sessions count
      const { count: sessionsCount } = await supabaseAdmin
        .from('chat_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('workspace', orgId);

      // Get API keys count
      const { count: apiKeysCount } = await supabaseAdmin
        .from('api_keys')
        .select('*', { count: 'exact', head: true })
        .eq('org_id', orgId)
        .eq('is_active', true);

      // Get current month usage
      const usage = await getCurrentMonthUsage(orgId);

      // Get recent documents (last 5)
      const { data: recentDocs } = await supabaseAdmin
        .from('documents')
        .select('id, file_name, file_type, status, created_at')
        .eq('workspace', orgId)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get top entity types
      const { data: entityTypes } = await supabaseAdmin
        .from('entities')
        .select('entity_type')
        .eq('workspace', orgId);

      const entityTypeCounts: Record<string, number> = {};
      entityTypes?.forEach(e => {
        entityTypeCounts[e.entity_type] = (entityTypeCounts[e.entity_type] || 0) + 1;
      });

      return createAdminSuccessResponse({
        documents: docStats,
        chunks: chunksCount || 0,
        entities: entitiesCount || 0,
        relations: relationsCount || 0,
        chat_sessions: sessionsCount || 0,
        api_keys: apiKeysCount || 0,
        usage,
        recent_documents: recentDocs || [],
        entity_types: Object.entries(entityTypeCounts)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10),
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch statistics', 500);
    }
  }
);
