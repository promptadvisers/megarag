import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminCredentials,
  createAdminSession,
  setSessionCookie,
  createAdminErrorResponse,
  createAdminSuccessResponse,
} from '@/lib/auth/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.email || !body.password) {
      return createAdminErrorResponse('INVALID_REQUEST', 'Email and password required', 400);
    }

    const user = await verifyAdminCredentials(body.email, body.password);

    if (!user) {
      return createAdminErrorResponse('UNAUTHORIZED', 'Invalid email or password', 401);
    }

    // Create session
    const token = await createAdminSession(user.userId);

    // Set cookie
    await setSessionCookie(token);

    return createAdminSuccessResponse({
      message: 'Login successful',
      user: {
        id: user.userId,
        org_id: user.orgId,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return createAdminErrorResponse('SERVER_ERROR', 'Login failed', 500);
  }
}
