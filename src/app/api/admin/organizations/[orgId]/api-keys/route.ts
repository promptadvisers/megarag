import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import { generateApiKey } from '@/lib/crypto/api-keys';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

/**
 * GET /api/admin/organizations/[orgId]/api-keys - List API keys
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    const { data: keys, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, key_prefix, name, scopes, last_used_at, expires_at, created_at, is_active')
      .eq('org_id', orgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching API keys:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch API keys', 500);
    }

    return createAdminSuccessResponse({ api_keys: keys || [] });
  }
);

/**
 * POST /api/admin/organizations/[orgId]/api-keys - Create new API key
 */
export const POST = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    // Only owners and admins can create keys
    if (ctx.role === 'viewer') {
      return createAdminErrorResponse('FORBIDDEN', 'Viewers cannot create API keys', 403);
    }

    const body = await request.json();

    if (!body.name) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Key name is required', 400);
    }

    // Generate the API key
    const { key, hash, prefix } = generateApiKey();

    // Optional expiration
    let expiresAt = null;
    if (body.expires_in_days && typeof body.expires_in_days === 'number') {
      const expDate = new Date();
      expDate.setDate(expDate.getDate() + body.expires_in_days);
      expiresAt = expDate.toISOString();
    }

    // Scopes (default to read,write)
    const scopes = body.scopes || ['read', 'write'];

    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .insert({
        org_id: orgId,
        key_hash: hash,
        key_prefix: prefix,
        name: body.name,
        scopes,
        expires_at: expiresAt,
      })
      .select('id, key_prefix, name, scopes, expires_at, created_at')
      .single();

    if (error) {
      console.error('Error creating API key:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to create API key', 500);
    }

    // Return the full key only once
    return createAdminSuccessResponse({
      api_key: {
        ...data,
        key, // Full key - only shown once!
      },
      message: 'API key created. Store this key securely - it will not be shown again.',
    });
  },
  { requiredRoles: ['owner', 'admin'] }
);
