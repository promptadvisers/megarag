import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { ProcessingStatus } from '@/types';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      );
    }

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select('status, chunks_count, error_message')
      .eq('id', documentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching document status:', error);
      return NextResponse.json(
        { error: 'Failed to fetch document status' },
        { status: 500 }
      );
    }

    // Calculate progress based on status
    let progress = 0;
    switch (document.status) {
      case 'pending':
        progress = 0;
        break;
      case 'processing':
        progress = 50; // Could be more granular with actual progress tracking
        break;
      case 'processed':
        progress = 100;
        break;
      case 'failed':
        progress = 0;
        break;
    }

    const status: ProcessingStatus = {
      status: document.status,
      progress,
      error: document.error_message || undefined,
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
