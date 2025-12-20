import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashSessionToken, verifyPassword, generateSessionToken, hashPassword } from '@/lib/crypto/api-keys';
import type { AdminContext, ApiError, ApiErrorCode } from './context';

const SESSION_COOKIE_NAME = 'mrag_admin_session';
const SESSION_DURATION_DAYS = 7;

/**
 * Create admin error response
 */
export function createAdminErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number
): NextResponse {
  return NextResponse.json({ success: false, error: { code, message } }, { status });
}

/**
 * Create admin success response
 */
export function createAdminSuccessResponse<T>(data: T): NextResponse {
  return NextResponse.json({ success: true, data });
}

/**
 * Validate admin session from cookie
 */
export async function validateAdminSession(
  request: NextRequest
): Promise<{ context: AdminContext } | { error: ApiError; status: number }> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return {
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
      status: 401,
    };
  }

  const tokenHash = hashSessionToken(sessionToken);

  try {
    // Look up session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('admin_sessions')
      .select(`
        id,
        user_id,
        expires_at,
        admin_users (
          id,
          email,
          org_id,
          role
        )
      `)
      .eq('token_hash', tokenHash)
      .single();

    if (sessionError || !session) {
      return {
        error: { code: 'UNAUTHORIZED', message: 'Invalid session' },
        status: 401,
      };
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      // Delete expired session
      await supabaseAdmin.from('admin_sessions').delete().eq('id', session.id);
      return {
        error: { code: 'UNAUTHORIZED', message: 'Session expired' },
        status: 401,
      };
    }

    const user = session.admin_users as unknown as {
      id: string;
      email: string;
      org_id: string;
      role: 'owner' | 'admin' | 'viewer';
    };

    return {
      context: {
        userId: user.id,
        email: user.email,
        orgId: user.org_id,
        role: user.role,
      },
    };
  } catch (error) {
    console.error('Session validation error:', error);
    return {
      error: { code: 'SERVER_ERROR', message: 'Failed to validate session' },
      status: 500,
    };
  }
}

/**
 * Create admin session after login
 */
export async function createAdminSession(userId: string): Promise<string> {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DURATION_DAYS);

  const { error } = await supabaseAdmin.from('admin_sessions').insert({
    user_id: userId,
    token_hash: tokenHash,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    throw new Error('Failed to create session');
  }

  return token;
}

/**
 * Set session cookie
 */
export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_DAYS * 24 * 60 * 60,
    path: '/',
  });
}

/**
 * Clear session cookie
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Delete admin session
 */
export async function deleteAdminSession(request: NextRequest): Promise<void> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    const tokenHash = hashSessionToken(sessionToken);
    await supabaseAdmin.from('admin_sessions').delete().eq('token_hash', tokenHash);
  }
}

/**
 * Type for authenticated admin handler
 */
type AdminHandler<P = unknown> = (
  request: NextRequest,
  context: AdminContext,
  params?: P
) => Promise<NextResponse>;

/**
 * Higher-order function to wrap admin routes with authentication
 */
export function withAdminAuth<P = unknown>(
  handler: AdminHandler<P>,
  options?: {
    requiredRoles?: Array<'owner' | 'admin' | 'viewer'>;
  }
): (request: NextRequest, params?: { params: Promise<P> }) => Promise<NextResponse> {
  return async (request: NextRequest, routeParams?: { params: Promise<P> }) => {
    const authResult = await validateAdminSession(request);

    if ('error' in authResult) {
      return createAdminErrorResponse(
        authResult.error.code,
        authResult.error.message,
        authResult.status
      );
    }

    const { context } = authResult;

    // Check required roles
    if (options?.requiredRoles && !options.requiredRoles.includes(context.role)) {
      return createAdminErrorResponse('FORBIDDEN', 'Insufficient permissions', 403);
    }

    const params = routeParams?.params ? await routeParams.params : undefined;

    try {
      return await handler(request, context, params as P);
    } catch (error) {
      console.error('Admin handler error:', error);
      return createAdminErrorResponse(
        'SERVER_ERROR',
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  };
}

/**
 * Create initial admin user for an organization
 */
export async function createAdminUser(
  orgId: string,
  email: string,
  password: string,
  role: 'owner' | 'admin' | 'viewer' = 'owner'
): Promise<{ userId: string }> {
  const { hash } = hashPassword(password);

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .insert({
      org_id: orgId,
      email,
      password_hash: hash,
      role,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to create admin user: ${error.message}`);
  }

  return { userId: data.id };
}

/**
 * Verify admin login credentials
 */
export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<{ userId: string; orgId: string; role: 'owner' | 'admin' | 'viewer' } | null> {
  const { data: user, error } = await supabaseAdmin
    .from('admin_users')
    .select('id, org_id, password_hash, role')
    .eq('email', email.toLowerCase())
    .single();

  if (error || !user) {
    return null;
  }

  if (!verifyPassword(password, user.password_hash)) {
    return null;
  }

  // Update last login
  await supabaseAdmin
    .from('admin_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);

  return {
    userId: user.id,
    orgId: user.org_id,
    role: user.role as 'owner' | 'admin' | 'viewer',
  };
}
