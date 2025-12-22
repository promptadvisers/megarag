import { NextRequest } from 'next/server';
import {
  deleteAdminSession,
  clearSessionCookie,
  createAdminSuccessResponse,
} from '@/lib/auth/admin-auth';

export async function POST(request: NextRequest) {
  await deleteAdminSession(request);
  await clearSessionCookie();

  return createAdminSuccessResponse({ message: 'Logged out successfully' });
}
