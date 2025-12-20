import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { hashApiKey, isValidApiKeyFormat } from '@/lib/crypto/api-keys';
import { safeDecrypt } from '@/lib/crypto/encryption';
import type { AuthContext, ApiError, ApiErrorCode } from './context';

/**
 * Extract bearer token from Authorization header
 */
function extractBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1];
}

/**
 * Create an error response
 */
export function createErrorResponse(
  code: ApiErrorCode,
  message: string,
  status: number,
  details?: Record<string, unknown>
): NextResponse {
  const requestId = uuidv4();

  return NextResponse.json(
    {
      success: false,
      error: { code, message, details },
      meta: { request_id: requestId },
    },
    { status }
  );
}

/**
 * Create a success response
 */
export function createSuccessResponse<T>(
  data: T,
  usage?: { input_tokens: number; output_tokens: number }
): NextResponse {
  const requestId = uuidv4();

  return NextResponse.json({
    success: true,
    data,
    meta: {
      request_id: requestId,
      ...(usage && { usage }),
    },
  });
}

/**
 * Validate API key and return auth context
 */
export async function validateApiKey(
  authHeader: string | null
): Promise<{ context: AuthContext } | { error: ApiError; status: number }> {
  // Extract token
  const token = extractBearerToken(authHeader);

  if (!token) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing or invalid Authorization header. Use: Bearer <api_key>',
      },
      status: 401,
    };
  }

  // Validate format
  if (!isValidApiKeyFormat(token)) {
    return {
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid API key format',
      },
      status: 401,
    };
  }

  // Hash and lookup
  const keyHash = hashApiKey(token);

  try {
    const { data, error } = await supabaseAdmin.rpc('validate_api_key', {
      p_key_hash: keyHash,
    });

    if (error) {
      console.error('API key validation error:', error);
      return {
        error: {
          code: 'SERVER_ERROR',
          message: 'Failed to validate API key',
        },
        status: 500,
      };
    }

    if (!data || data.length === 0) {
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'Invalid API key',
        },
        status: 401,
      };
    }

    const keyData = data[0];

    // Check if key is valid (active and not expired)
    if (!keyData.is_valid) {
      return {
        error: {
          code: 'UNAUTHORIZED',
          message: 'API key is inactive or expired',
        },
        status: 401,
      };
    }

    // Decrypt Gemini API key if present
    const geminiApiKey = safeDecrypt(keyData.gemini_api_key_encrypted);

    const context: AuthContext = {
      orgId: keyData.org_id,
      orgName: keyData.org_name,
      orgSlug: keyData.org_slug,
      geminiApiKey,
      apiKeyId: keyData.api_key_id,
      scopes: keyData.scopes || ['read', 'write'],
    };

    return { context };
  } catch (error) {
    console.error('API key validation error:', error);
    return {
      error: {
        code: 'SERVER_ERROR',
        message: 'Failed to validate API key',
      },
      status: 500,
    };
  }
}

/**
 * Check if context has required scope
 */
export function hasScope(context: AuthContext, requiredScope: string): boolean {
  return context.scopes.includes(requiredScope) || context.scopes.includes('*');
}

/**
 * Type for authenticated route handler
 */
type AuthenticatedHandler<P = unknown> = (
  request: NextRequest,
  context: AuthContext,
  params?: P
) => Promise<NextResponse>;

/**
 * Higher-order function to wrap API routes with authentication
 */
export function withApiAuth<P = unknown>(
  handler: AuthenticatedHandler<P>,
  options?: {
    requiredScopes?: string[];
    requireGeminiKey?: boolean;
  }
): (request: NextRequest, params?: { params: Promise<P> }) => Promise<NextResponse> {
  return async (request: NextRequest, routeParams?: { params: Promise<P> }) => {
    // Validate API key
    const authResult = await validateApiKey(request.headers.get('authorization'));

    if ('error' in authResult) {
      return createErrorResponse(
        authResult.error.code,
        authResult.error.message,
        authResult.status,
        authResult.error.details
      );
    }

    const { context } = authResult;

    // Check required scopes
    if (options?.requiredScopes) {
      for (const scope of options.requiredScopes) {
        if (!hasScope(context, scope)) {
          return createErrorResponse(
            'FORBIDDEN',
            `Missing required scope: ${scope}`,
            403
          );
        }
      }
    }

    // Check Gemini key requirement
    if (options?.requireGeminiKey && !context.geminiApiKey) {
      return createErrorResponse(
        'GEMINI_KEY_MISSING',
        'This organization has not configured a Gemini API key. Configure it in the admin panel.',
        400
      );
    }

    // Await params if provided
    const params = routeParams?.params ? await routeParams.params : undefined;

    // Call the handler
    try {
      return await handler(request, context, params as P);
    } catch (error) {
      console.error('API handler error:', error);
      return createErrorResponse(
        'SERVER_ERROR',
        error instanceof Error ? error.message : 'Internal server error',
        500
      );
    }
  };
}

/**
 * Fallback for routes that use default API key (for internal/dashboard use)
 */
export function getDefaultApiKey(): string | null {
  return process.env.GOOGLE_AI_API_KEY || null;
}

/**
 * Get the effective Gemini API key (org key or fallback to default)
 */
export function getEffectiveGeminiKey(context: AuthContext): string | null {
  return context.geminiApiKey || getDefaultApiKey();
}
