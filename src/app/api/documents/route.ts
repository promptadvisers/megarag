import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { Document } from '@/types';

// GET: List all documents with optional pagination
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status');
    const workspace = searchParams.get('workspace') || 'default';

    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact' })
      .eq('workspace', workspace)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status if provided
    if (status) {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Database query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      documents: data as Document[],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error) {
    console.error('GET documents error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PATCH: Update a document (rename, update metadata)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, file_name, description, tags, category, customMetadata } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // Check if any update field is provided
    const hasFileName = file_name && typeof file_name === 'string' && file_name.trim();
    const hasMetadataUpdate = description !== undefined || tags !== undefined ||
                              category !== undefined || customMetadata !== undefined;

    if (!hasFileName && !hasMetadataUpdate) {
      return NextResponse.json(
        { error: 'At least one field to update is required (file_name, description, tags, category, or customMetadata)' },
        { status: 400 }
      );
    }

    // Get current document to merge metadata
    const { data: currentDoc, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('metadata')
      .eq('id', id)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      }
      throw fetchError;
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString()
    };

    if (hasFileName) {
      updateData.file_name = file_name.trim();
    }

    // Merge metadata updates
    if (hasMetadataUpdate) {
      const existingMetadata = (currentDoc?.metadata as Record<string, unknown>) || {};
      const updatedMetadata = { ...existingMetadata };

      if (description !== undefined) {
        if (description === null || description === '') {
          delete updatedMetadata.description;
        } else {
          updatedMetadata.description = description;
        }
      }

      if (tags !== undefined) {
        if (tags === null || (Array.isArray(tags) && tags.length === 0)) {
          delete updatedMetadata.tags;
        } else {
          updatedMetadata.tags = Array.isArray(tags) ? tags : [tags];
        }
      }

      if (category !== undefined) {
        if (category === null || category === '') {
          delete updatedMetadata.category;
        } else {
          updatedMetadata.category = category;
        }
      }

      if (customMetadata !== undefined && typeof customMetadata === 'object') {
        // Merge custom metadata, null values remove keys
        for (const [key, value] of Object.entries(customMetadata as Record<string, unknown>)) {
          if (value === null) {
            delete updatedMetadata[key];
          } else {
            updatedMetadata[key] = value;
          }
        }
      }

      updateData.metadata = updatedMetadata;
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Update document error:', error);
      return NextResponse.json(
        { error: 'Failed to update document' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document: data,
    });
  } catch (error) {
    console.error('PATCH document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE: Remove a document and all associated data
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const documentId = searchParams.get('id');

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    // First, get the document to find the file path
    const { data: document, error: fetchError } = await supabaseAdmin
      .from('documents')
      .select('file_path')
      .eq('id', documentId)
      .single();

    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      console.error('Fetch document error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch document' },
        { status: 500 }
      );
    }

    // Store file path before deletion
    const filePath = document?.file_path;

    // Delete the document record first
    // CASCADE constraints will automatically delete:
    // - chunks (via document_id foreign key)
    // - entities are NOT cascaded (they may be shared across documents)
    // - relations are NOT cascaded (they reference entities, not documents)
    const { error: deleteError } = await supabaseAdmin
      .from('documents')
      .delete()
      .eq('id', documentId);

    if (deleteError) {
      console.error('Delete document error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete document' },
        { status: 500 }
      );
    }

    // Delete the file from storage after DB deletion succeeds
    // This order ensures we don't have orphaned DB records if storage fails
    // (An orphaned file in storage is less problematic than orphaned data)
    let storageWarning: string | undefined;
    if (filePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([filePath]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        storageWarning = 'Document record deleted but file cleanup failed. The file may remain in storage.';
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
      ...(storageWarning && { warning: storageWarning }),
    });
  } catch (error) {
    console.error('DELETE document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
