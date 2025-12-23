import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '@/lib/supabase/server';
import { processDocument, canProcessNow } from '@/lib/processing';
import type { DocumentInsert, UploadResponse } from '@/types';

// Supported file extensions and their types
const FILE_TYPE_MAP: Record<string, string> = {
  'pdf': 'pdf',
  'docx': 'docx',
  'pptx': 'pptx',
  'xlsx': 'xlsx',
  'txt': 'txt',
  'md': 'md',
  'mp4': 'mp4',
  'mp3': 'mp3',
  'wav': 'wav',
  'jpg': 'jpg',
  'jpeg': 'jpg',
  'png': 'png',
  'gif': 'gif',
  'webp': 'webp',
};

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE_MB || '100') * 1024 * 1024;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    // Get optional user-provided metadata
    const description = formData.get('description') as string | null;
    const tagsRaw = formData.get('tags') as string | null;
    const category = formData.get('category') as string | null;
    const customMetadataRaw = formData.get('customMetadata') as string | null;

    // Parse tags (comma-separated or JSON array)
    let tags: string[] = [];
    if (tagsRaw) {
      try {
        tags = JSON.parse(tagsRaw);
      } catch {
        // Assume comma-separated
        tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
      }
    }

    // Parse custom metadata JSON
    let customMetadata: Record<string, unknown> = {};
    if (customMetadataRaw) {
      try {
        customMetadata = JSON.parse(customMetadataRaw);
      } catch {
        console.warn('Invalid customMetadata JSON, ignoring');
      }
    }

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds ${process.env.MAX_FILE_SIZE_MB || 100}MB limit` },
        { status: 400 }
      );
    }

    // Get file extension and validate
    const originalFileName = file.name;
    const extension = originalFileName.split('.').pop()?.toLowerCase() || '';
    const fileType = FILE_TYPE_MAP[extension];

    if (!fileType) {
      return NextResponse.json(
        { error: `Unsupported file type: .${extension}` },
        { status: 400 }
      );
    }

    // Generate unique document ID
    const documentId = uuidv4();

    // Sanitize filename for storage (replace spaces and special chars)
    const sanitizedFileName = originalFileName
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');
    const storagePath = `uploads/${documentId}/${sanitizedFileName}`;

    // Convert file to buffer for upload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file to Supabase Storage
    const { error: storageError } = await supabaseAdmin.storage
      .from('documents')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (storageError) {
      console.error('Storage upload error:', storageError);
      // Provide more specific error message to user
      let errorMessage = 'Failed to upload file to storage';
      if (storageError.message?.includes('Payload too large')) {
        errorMessage = `File is too large. Maximum size is ${process.env.MAX_FILE_SIZE_MB || 100}MB`;
      } else if (storageError.message?.includes('already exists')) {
        errorMessage = 'A file with this name already exists. Please rename and try again.';
      } else if (storageError.message) {
        errorMessage = `Storage error: ${storageError.message}`;
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 500 }
      );
    }

    // Create document record in database with user metadata
    const documentData: DocumentInsert = {
      id: documentId,
      file_name: originalFileName,
      file_type: fileType,
      file_size: file.size,
      file_path: storagePath,
      status: 'pending',
      metadata: {
        // System metadata
        originalName: originalFileName,
        sanitizedName: sanitizedFileName,
        mimeType: file.type,
        uploadedAt: new Date().toISOString(),
        // User-provided metadata
        ...(description && { description }),
        ...(tags.length > 0 && { tags }),
        ...(category && { category }),
        // Custom user metadata (merged in)
        ...customMetadata,
      },
    };

    const { error: dbError } = await supabaseAdmin
      .from('documents')
      .insert(documentData);

    if (dbError) {
      console.error('Database insert error:', dbError);

      // Try to clean up the uploaded file
      await supabaseAdmin.storage
        .from('documents')
        .remove([storagePath]);

      return NextResponse.json(
        { error: 'Failed to create document record' },
        { status: 500 }
      );
    }

    // Trigger processing if the file type can be processed now
    // Processing runs asynchronously - we don't wait for it to complete
    if (canProcessNow(fileType)) {
      // Fire and forget - processing happens in the background
      processDocument(documentId, storagePath, fileType, 'default')
        .then(result => {
          if (result.success) {
            console.log(`Document ${documentId} processed successfully: ${result.chunksCreated} chunks created`);
          } else {
            console.error(`Document ${documentId} processing failed: ${result.error}`);
          }
        })
        .catch(async (error) => {
          // Ensure document status is updated even on unexpected errors
          console.error(`Document ${documentId} processing error:`, error);
          try {
            await supabaseAdmin
              .from('documents')
              .update({
                status: 'failed',
                error_message: error instanceof Error ? error.message : 'Unexpected processing error',
                updated_at: new Date().toISOString(),
              })
              .eq('id', documentId);
          } catch (updateError) {
            console.error(`Failed to update document ${documentId} status:`, updateError);
          }
        });
    }

    const response: UploadResponse = {
      documentId,
      status: 'pending',
      message: canProcessNow(fileType)
        ? 'File uploaded successfully, processing started'
        : `File uploaded successfully. ${fileType.toUpperCase()} processing will be available in a future update.`,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
