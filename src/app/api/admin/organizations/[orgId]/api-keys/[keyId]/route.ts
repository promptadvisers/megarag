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
  keyId: string;
}

/**
 * DELETE /api/admin/organizations/[orgId]/api-keys/[keyId] - Delete/revoke API key
 */
export const DELETE = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;
    const keyId = params?.keyId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    if (!keyId) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Key ID required', 400);
    }

    // Only owners and admins can delete keys
    if (ctx.role === 'viewer') {
      return createAdminErrorResponse('FORBIDDEN', 'Viewers cannot delete API keys', 403);
    }

    // Verify key belongs to org
    const { data: key, error: fetchError } = await supabaseAdmin
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !key) {
      return createAdminErrorResponse('NOT_FOUND', 'API key not found', 404);
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .delete()
      .eq('id', keyId);

    if (error) {
      console.error('Error deleting API key:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to delete API key', 500);
    }

    return createAdminSuccessResponse({
      deleted: true,
      key_id: keyId,
    });
  },
  { requiredRoles: ['owner', 'admin'] }
);

/**
 * PATCH /api/admin/organizations/[orgId]/api-keys/[keyId] - Update API key (revoke/activate)
 */
export const PATCH = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;
    const keyId = params?.keyId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    if (!keyId) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Key ID required', 400);
    }

    if (ctx.role === 'viewer') {
      return createAdminErrorResponse('FORBIDDEN', 'Viewers cannot modify API keys', 403);
    }

    const body = await request.json();

    // Verify key belongs to org
    const { data: key, error: fetchError } = await supabaseAdmin
      .from('api_keys')
      .select('id')
      .eq('id', keyId)
      .eq('org_id', orgId)
      .single();

    if (fetchError || !key) {
      return createAdminErrorResponse('NOT_FOUND', 'API key not found', 404);
    }

    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) {
      updateData.name = body.name;
    }

    if (body.is_active !== undefined) {
      updateData.is_active = body.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      return createAdminErrorResponse('INVALID_REQUEST', 'No valid fields to update', 400);
    }

    const { error } = await supabaseAdmin
      .from('api_keys')
      .update(updateData)
      .eq('id', keyId);

    if (error) {
      console.error('Error updating API key:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to update API key', 500);
    }

    return createAdminSuccessResponse({
      message: 'API key updated successfully',
    });
  },
  { requiredRoles: ['owner', 'admin'] }
);
