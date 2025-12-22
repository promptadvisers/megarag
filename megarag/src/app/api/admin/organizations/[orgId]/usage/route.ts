import { NextRequest } from 'next/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import { getUsageSummary, getRecentUsage, getCurrentMonthUsage } from '@/lib/usage/tracker';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

/**
 * GET /api/admin/organizations/[orgId]/usage - Get usage statistics
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // 'month', 'week', 'custom'
    const startDateStr = searchParams.get('start_date');
    const endDateStr = searchParams.get('end_date');

    try {
      let usage;

      if (period === 'custom' && startDateStr && endDateStr) {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        usage = await getUsageSummary(orgId, startDate, endDate);
      } else if (period === 'week') {
        usage = await getRecentUsage(orgId, 7);
      } else {
        // Default to current month
        usage = await getCurrentMonthUsage(orgId);
      }

      return createAdminSuccessResponse({
        period,
        usage,
      });
    } catch (error) {
      console.error('Error fetching usage:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch usage statistics', 500);
    }
  }
);
