import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import type { AdminContext } from '@/lib/auth/context';

export const GET = withAdminAuth(
  async (request: NextRequest, ctx: AdminContext) => {
    // Get organization details
    const { data: org, error } = await supabaseAdmin
      .from('organizations')
      .select('id, name, slug')
      .eq('id', ctx.orgId)
      .single();

    if (error || !org) {
      return createAdminErrorResponse('NOT_FOUND', 'Organization not found', 404);
    }

    return createAdminSuccessResponse({
      user: {
        id: ctx.userId,
        email: ctx.email,
        role: ctx.role,
      },
      organization: org,
    });
  }
);
