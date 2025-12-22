import { NextRequest } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
  createAdminUser,
} from '@/lib/auth/admin-auth';
import { encrypt } from '@/lib/crypto/encryption';
import type { AdminContext } from '@/lib/auth/context';

/**
 * GET /api/admin/organizations - List organizations (only for current org)
 */
export const GET = withAdminAuth(
  async (request: NextRequest, ctx: AdminContext) => {
    // For now, just return the current org
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('*')
      .eq('id', ctx.orgId)
      .single();

    if (error || !org) {
      return createAdminErrorResponse('NOT_FOUND', 'Organization not found', 404);
    }

    // Remove encrypted key from response
    const { gemini_api_key_encrypted, ...safeOrg } = org;

    return createAdminSuccessResponse({
      organizations: [{
        ...safeOrg,
        has_gemini_key: !!gemini_api_key_encrypted,
      }],
    });
  }
);

/**
 * POST /api/admin/organizations - Create a new organization (self-registration)
 * Note: This is a public endpoint for creating new orgs
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || !body.slug || !body.admin_email || !body.admin_password) {
      return createAdminErrorResponse(
        'INVALID_REQUEST',
        'name, slug, admin_email, and admin_password are required',
        400
      );
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(body.slug)) {
      return createAdminErrorResponse(
        'INVALID_REQUEST',
        'Slug must only contain lowercase letters, numbers, and hyphens',
        400
      );
    }

    // Check if slug is taken
    const { data: existing } = await supabaseAdmin
      .from('organizations')
      .select('id')
      .eq('slug', body.slug)
      .single();

    if (existing) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Slug is already taken', 400);
    }

    // Check if email is taken
    const { data: existingUser } = await supabaseAdmin
      .from('admin_users')
      .select('id')
      .eq('email', body.admin_email.toLowerCase())
      .single();

    if (existingUser) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Email is already in use', 400);
    }

    const orgId = uuidv4();

    // Encrypt Gemini key if provided
    let encryptedGeminiKey = null;
    if (body.gemini_api_key) {
      try {
        encryptedGeminiKey = encrypt(body.gemini_api_key);
      } catch {
        return createAdminErrorResponse(
          'SERVER_ERROR',
          'Failed to encrypt API key. Make sure ENCRYPTION_KEY is set.',
          500
        );
      }
    }

    // Create organization
    const { error: orgError } = await supabaseAdmin.from('organizations').insert({
      id: orgId,
      name: body.name,
      slug: body.slug,
      gemini_api_key_encrypted: encryptedGeminiKey,
      settings: body.settings || {},
    });

    if (orgError) {
      console.error('Error creating organization:', orgError);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to create organization', 500);
    }

    // Create admin user
    try {
      await createAdminUser(orgId, body.admin_email, body.admin_password, 'owner');
    } catch (error) {
      // Rollback org creation
      await supabaseAdmin.from('organizations').delete().eq('id', orgId);
      console.error('Error creating admin user:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to create admin user', 500);
    }

    return createAdminSuccessResponse({
      organization: {
        id: orgId,
        name: body.name,
        slug: body.slug,
      },
      message: 'Organization created successfully. You can now log in.',
    });
  } catch (error) {
    console.error('Create org error:', error);
    return createAdminErrorResponse('SERVER_ERROR', 'Failed to create organization', 500);
  }
}
