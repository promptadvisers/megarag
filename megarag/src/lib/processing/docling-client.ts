import type { ContentItem } from '@/types';

const DOCLING_SERVICE_URL = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';

interface DoclingResponse {
  success: boolean;
  filename: string;
  content_list: Array<{
    type: 'text' | 'table' | 'image';
    content: string;
    page_idx: number;
    metadata: Record<string, unknown>;
  }>;
  total_items: number;
}

/**
 * Check if Docling service is available
 */
export async function isDoclingAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${DOCLING_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Parse a document using the Docling service
 * Returns a list of content items (text, tables, images)
 */
export async function parseDocument(file: File | Blob, filename: string): Promise<ContentItem[]> {
  const formData = new FormData();
  formData.append('file', file, filename);

  const response = await fetch(`${DOCLING_SERVICE_URL}/parse`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Document parsing service unavailable. Please ensure the PDF processing service is running.');
    }
    throw new Error(`Document parsing failed (${response.status}). Please try again.`);
  }

  const data: DoclingResponse = await response.json();

  if (!data.success) {
    throw new Error('Document parsing failed. The file may be corrupted or unsupported.');
  }

  // Convert Docling response to our ContentItem format
  const contentItems: ContentItem[] = data.content_list.map(item => ({
    type: item.type === 'image' ? 'image' : item.type === 'table' ? 'table' : 'text',
    content: item.content,
    page_idx: item.page_idx,
    metadata: item.metadata,
  }));

  return contentItems;
}

/**
 * Parse a document from a buffer/ArrayBuffer
 */
export async function parseDocumentFromBuffer(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<ContentItem[]> {
  const blob = new Blob([buffer], { type: mimeType });
  return parseDocument(blob, filename);
}

/**
 * Get Docling service status
 */
export async function getDoclingStatus(): Promise<{
  available: boolean;
  url: string;
  error?: string;
}> {
  try {
    const response = await fetch(`${DOCLING_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });

    if (response.ok) {
      return {
        available: true,
        url: DOCLING_SERVICE_URL,
      };
    }

    return {
      available: false,
      url: DOCLING_SERVICE_URL,
      error: `Service returned status ${response.status}`,
    };
  } catch (error) {
    return {
      available: false,
      url: DOCLING_SERVICE_URL,
      error: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}
