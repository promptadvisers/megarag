import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { withApiAuth, createSuccessResponse, createErrorResponse } from '@/lib/auth/api-auth';
import { trackApiRequest, trackStorage } from '@/lib/usage/tracker';
import { processDocument } from '@/lib/processing/router';
import { v4 as uuidv4 } from 'uuid';
import type { AuthContext } from '@/lib/auth/context';

// Allowed file types
const ALLOWED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/flac',
  'audio/mp4',
  'audio/aac',
];

// Max file size (100MB)
const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

/**
 * POST /api/v1/documents - Upload a document
 */
export const POST = withApiAuth(
  async (request: NextRequest, ctx: AuthContext) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse('INVALID_REQUEST', 'No file provided', 400);
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return createErrorResponse(
        'INVALID_REQUEST',
        `File type not allowed: ${file.type}`,
        400,
        { allowed_types: ALLOWED_TYPES }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return createErrorResponse(
        'INVALID_REQUEST',
        `File too large. Max size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        400
      );
    }

    const documentId = uuidv4();
    const fileName = file.name;
    const fileType = file.type;
    const fileSize = file.size;

    // Get file extension for storage path
    const extension = fileName.split('.').pop() || '';
    const storagePath = `${ctx.orgId}/${documentId}.${extension}`;

    try {
      // Upload to storage
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabaseAdmin.storage
        .from('documents')
        .upload(storagePath, buffer, {
          contentType: fileType,
          upsert: false,
        });

      if (uploadError) {
        console.error('Storage upload error:', uploadError);
        return createErrorResponse('SERVER_ERROR', 'Failed to upload file', 500);
      }

      // Create document record
      const { error: dbError } = await supabaseAdmin.from('documents').insert({
        id: documentId,
        workspace: ctx.orgId, // Use org_id as workspace
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_path: storagePath,
        status: 'pending',
        metadata: {},
      });

      if (dbError) {
        console.error('Database insert error:', dbError);
        // Clean up uploaded file
        await supabaseAdmin.storage.from('documents').remove([storagePath]);
        return createErrorResponse('SERVER_ERROR', 'Failed to create document record', 500);
      }

      // Track storage usage
      trackStorage(ctx.orgId, fileSize);

      // Start processing in background
      processDocument(documentId, storagePath, fileType, {
        workspace: ctx.orgId,
        geminiApiKey: ctx.geminiApiKey || undefined,
      }).catch((error) => {
        console.error(`Processing failed for ${documentId}:`, error);
      });

      return createSuccessResponse({
        document_id: documentId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        status: 'pending',
        message: 'Document uploaded and processing started',
      });
    } catch (error) {
      console.error('Upload error:', error);
      return createErrorResponse(
        'SERVER_ERROR',
        error instanceof Error ? error.message : 'Upload failed',
        500
      );
    }
  },
  { requiredScopes: ['write'] }
);

/**
 * GET /api/v1/documents - List documents
 */
export const GET = withApiAuth(
  async (request: NextRequest, ctx: AuthContext) => {
    // Track API request
    trackApiRequest(ctx.orgId);

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const status = searchParams.get('status');
    const offset = (page - 1) * limit;

    try {
      // Build query
      let query = supabaseAdmin
        .from('documents')
        .select('*', { count: 'exact' })
        .eq('workspace', ctx.orgId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data: documents, error, count } = await query;

      if (error) {
        console.error('Query error:', error);
        return createErrorResponse('SERVER_ERROR', 'Failed to fetch documents', 500);
      }

      return createSuccessResponse({
        documents: documents || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          total_pages: Math.ceil((count || 0) / limit),
        },
      });
    } catch (error) {
      console.error('List documents error:', error);
      return createErrorResponse('SERVER_ERROR', 'Failed to list documents', 500);
    }
  },
  { requiredScopes: ['read'] }
);
