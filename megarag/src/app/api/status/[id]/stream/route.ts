import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * SSE endpoint for real-time processing status updates
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: documentId } = await params;

  if (!documentId) {
    return new Response('Document ID is required', { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let lastStatus = '';
      let attempts = 0;
      const maxAttempts = 120; // 2 minutes max (1 second intervals)

      const checkStatus = async () => {
        try {
          const { data: document, error } = await supabaseAdmin
            .from('documents')
            .select('status, chunks_count, error_message')
            .eq('id', documentId)
            .single();

          if (error) {
            sendEvent({ error: 'Document not found', status: 'error' });
            controller.close();
            return;
          }

          // Only send update if status changed
          if (document.status !== lastStatus) {
            lastStatus = document.status;

            let progress = 0;
            switch (document.status) {
              case 'pending':
                progress = 10;
                break;
              case 'processing':
                progress = 50;
                break;
              case 'processed':
                progress = 100;
                break;
              case 'failed':
                progress = 0;
                break;
            }

            sendEvent({
              status: document.status,
              progress,
              chunksCount: document.chunks_count,
              error: document.error_message || undefined,
            });
          }

          // Stop if processing is complete or failed
          if (document.status === 'processed' || document.status === 'failed') {
            controller.close();
            return;
          }

          // Continue polling
          attempts++;
          if (attempts < maxAttempts) {
            setTimeout(checkStatus, 1000);
          } else {
            sendEvent({ status: 'timeout', error: 'Status check timed out' });
            controller.close();
          }
        } catch (err) {
          console.error('SSE status check error:', err);
          sendEvent({ error: 'Internal error', status: 'error' });
          controller.close();
        }
      };

      // Start polling
      await checkStatus();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
