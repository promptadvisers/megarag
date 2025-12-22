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

// PATCH: Update a document (rename)
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, file_name } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    if (!file_name || typeof file_name !== 'string' || !file_name.trim()) {
      return NextResponse.json(
        { error: 'Valid file name is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from('documents')
      .update({
        file_name: file_name.trim(),
        updated_at: new Date().toISOString()
      })
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

    // Delete chunks associated with this document (cascade should handle this, but explicit is better)
    const { error: chunksError } = await supabaseAdmin
      .from('chunks')
      .delete()
      .eq('document_id', documentId);

    if (chunksError) {
      console.error('Delete chunks error:', chunksError);
      // Continue anyway, as the main document delete might cascade
    }

    // Delete the document record (this should cascade to chunks, entities, relations)
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

    // Delete the file from storage
    if (document?.file_path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from('documents')
        .remove([document.file_path]);

      if (storageError) {
        console.error('Storage delete error:', storageError);
        // Don't fail the request, just log the error
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Document deleted successfully',
    });
  } catch (error) {
    console.error('DELETE document error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
