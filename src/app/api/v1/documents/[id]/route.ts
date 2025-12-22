import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest } from '@/lib/usage/tracker';
import type { AuthContext } from '@/lib/auth/context';

interface RouteParams {
  id: string;
}

/**
 * GET /api/v1/documents/[id] - Get document details
 */
export const GET = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const documentId = params?.id;
    if (!documentId) {
      return createErrorResponse('INVALID_REQUEST', 'Document ID required', 400);
    }

    try {
      // Get document
      const { data: document, error } = await supabaseAdmin
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .eq('workspace', ctx.orgId)
        .single();

      if (error || !document) {
        return createErrorResponse('NOT_FOUND', 'Document not found', 404);
      }

      // Get chunks count
      const { count: chunksCount } = await supabaseAdmin
        .from('chunks')
        .select('*', { count: 'exact', head: true })
        .eq('document_id', documentId);

      // Get entities count
      const { count: entitiesCount } = await supabaseAdmin
        .from('entities')
        .select('*', { count: 'exact', head: true })
        .contains('source_chunk_ids', [documentId]);

      return createSuccessResponse({
        document: {
          ...document,
          stats: {
            chunks_count: chunksCount || 0,
            entities_count: entitiesCount || 0,
          },
        },
      });
    } catch (error) {
      console.error('Get document error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to get document', 500);
    }
  },
  { requiredScopes: ['read'] }
);

/**
 * DELETE /api/v1/documents/[id] - Delete document and all associated data
 */
export const DELETE = withApiAuth<RouteParams>(
  async (request: NextRequest, ctx: AuthContext, params) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const documentId = params?.id;
    if (!documentId) {
      return createErrorResponse('INVALID_REQUEST', 'Document ID required', 400);
    }

    try {
      // First verify the document belongs to this org
      const { data: document, error: fetchError } = await supabaseAdmin
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .eq('workspace', ctx.orgId)
        .single();

      if (fetchError || !document) {
        return createErrorResponse('NOT_FOUND', 'Document not found', 404);
      }

      // Get chunk IDs for this document
      const { data: chunks } = await supabaseAdmin
        .from('chunks')
        .select('id')
        .eq('document_id', documentId);

      const chunkIds = chunks?.map((c) => c.id) || [];

      // Delete relations that reference these chunks
      if (chunkIds.length > 0) {
        await supabaseAdmin
          .from('relations')
          .delete()
          .overlaps('source_chunk_ids', chunkIds);
      }

      // Delete entities that reference these chunks
      if (chunkIds.length > 0) {
        await supabaseAdmin
          .from('entities')
          .delete()
          .overlaps('source_chunk_ids', chunkIds);
      }

      // Delete chunks
      await supabaseAdmin.from('chunks').delete().eq('document_id', documentId);

      // Delete the document
      const { error: deleteError } = await supabaseAdmin
        .from('documents')
        .delete()
        .eq('id', documentId);

      if (deleteError) {
        console.error('Delete document error:', deleteError);
        return createErrorResponse('SERVER_ERROR', 'Failed to delete document', 500);
      }

      // Delete from storage
      if (document.file_path) {
        await supabaseAdmin.storage.from('documents').remove([document.file_path]);
      }

      return createSuccessResponse({
        deleted: true,
        document_id: documentId,
      });
    } catch (error) {
      console.error('Delete document error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to delete document', 500);
    }
  },
  { requiredScopes: ['write'] }
);
