import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import { encrypt, safeDecrypt } from '@/lib/crypto/encryption';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

/**
 * GET /api/admin/organizations/[orgId] - Get organization details
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    // Users can only view their own org
    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', orgId)
      .single();

    if (error || !org) {
      return createAdminErrorResponse('NOT_FOUND', 'Organization not found', 404);
    }

    // Remove encrypted key from response
    const { gemini_api_key_encrypted, ...safeOrg } = org;

    return createAdminSuccessResponse({
      organization: {
        ...safeOrg,
        has_gemini_key: !!gemini_api_key_encrypted,
      },
    });
  }
);

/**
 * PATCH /api/admin/organizations/[orgId] - Update organization
 */
export const PATCH = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    // Users can only update their own org
    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot modify other organizations', 403);
    }

    // Only owners can update org settings
    if (ctx.role !== 'owner') {
      return createAdminErrorResponse('FORBIDDEN', 'Only owners can update organization settings', 403);
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.settings !== undefined) {
      updateData.settings = body.settings;
    }

    // Handle Gemini API key update
    if (body.gemini_api_key !== undefined) {
      if (body.gemini_api_key === null || body.gemini_api_key === '') {
        // Clear the key
        updateData.gemini_api_key_encrypted = null;
      } else {
        try {
          updateData.gemini_api_key_encrypted = encrypt(body.gemini_api_key);
        } catch {
          return createAdminErrorResponse(
            'SERVER_ERROR',
            'Failed to encrypt API key. Make sure ENCRYPTION_KEY is set.',
            500
          );
        }
      }
    }

    const { error } = await supabaseAdmin
      .from('organizations')
      .update(updateData)
      .eq('id', orgId);

    if (error) {
      console.error('Error updating organization:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to update organization', 500);
    }

    return createAdminSuccessResponse({
      message: 'Organization updated successfully',
    });
  },
  { requiredRoles: ['owner'] }
);

/**
 * DELETE /api/admin/organizations/[orgId] - Delete organization
 */
export const DELETE = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    // Users can only delete their own org
    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot delete other organizations', 403);
    }

    // Only owners can delete org
    if (ctx.role !== 'owner') {
      return createAdminErrorResponse('FORBIDDEN', 'Only owners can delete organizations', 403);
    }

    // Delete all related data (cascade should handle most, but be explicit)
    // Note: This is a destructive operation!

    const { error } = await supabaseAdmin
      .from('organizations')
      .delete()
      .eq('id', orgId);

    if (error) {
      console.error('Error deleting organization:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete organization', 500);
    }

    return createAdminSuccessResponse({
      message: 'Organization deleted successfully',
    });
  },
  { requiredRoles: ['owner'] }
);
