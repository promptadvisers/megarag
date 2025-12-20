/**
 * Authentication context types for API v1 routes
 */

export interface AuthContext {
  /**
   * Organization ID (used as workspace for data isolation)
   */
  orgId: string;

  /**
   * Organization name
   */
  orgName: string;

  /**
   * URL-friendly organization slug
   */
  orgSlug: string;

  /**
   * Decrypted Gemini API key for this organization
   * Null if org hasn't configured their key yet
   */
  geminiApiKey: string | null;

  /**
   * The API key ID used for this request
   */
  apiKeyId: string;

  /**
   * Scopes/permissions granted to this API key
   */
  scopes: string[];
}

/**
 * Admin session context for admin panel routes
 */
export interface AdminContext {
  /**
   * Admin user ID
   */
  userId: string;

  /**
   * Admin user email
   */
  email: string;

  /**
   * Organization ID this admin belongs to
   */
  orgId: string;

  /**
   * Admin role (owner, admin, viewer)
   */
  role: 'owner' | 'admin' | 'viewer';
}

/**
 * API error codes
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INVALID_REQUEST'
  | 'SERVER_ERROR'
  | 'GEMINI_KEY_MISSING';

/**
 * API error response
 */
export interface ApiError {
  code: ApiErrorCode;
  message: string;
  details?: Record<string, unknown>;
}
