/**
 * Gemini-based document parser
 * Replaces external document parsing service with native Gemini File API
 * Supports PDF, DOCX, PPTX, XLSX
 */

import {
  uploadFileToGemini,
  deleteGeminiFile,
  generateContentWithFile,
} from '@/lib/gemini/client';
import type { ContentItem } from '@/types';

const PDF_EXTRACTION_PROMPT = `Analyze this document and extract ALL content. Return a JSON array with the following structure:

[
  {
    "type": "text",
    "content": "The actual text content from this section",
    "page_idx": 0
  },
  {
    "type": "table",
    "content": "| Header1 | Header2 |\\n|---------|---------|\\n| Cell1 | Cell2 |",
    "page_idx": 1
  }
]

Rules:
1. Extract ALL text content, preserving paragraph structure
2. Convert tables to markdown format
3. For images/charts/diagrams, describe them as text with type "text" and prefix with "[Figure: ...]" or "[Chart: ...]"
4. Set page_idx to the actual page number (0-indexed)
5. Maintain the order of content as it appears in the document
6. Be thorough - extract everything, don't summarize
7. Return ONLY valid JSON, no additional text

Extract the document content now:`;

/**
 * Parse a document using Gemini's native PDF understanding
 */
export async function parseDocumentWithGemini(
  buffer: ArrayBuffer,
  filename: string,
  mimeType: string
): Promise<ContentItem[]> {
  let geminiFileName: string | null = null;

  try {
    // Upload document to Gemini File API
    const fileBuffer = Buffer.from(buffer);
    const { uri, name } = await uploadFileToGemini(
      fileBuffer,
      mimeType,
      filename
    );
    geminiFileName = name;

    // Extract content using Gemini
    const response = await generateContentWithFile(
      PDF_EXTRACTION_PROMPT,
      uri,
      mimeType
    );

    // Parse the JSON response
    const contentItems = parseGeminiResponse(response);

    if (contentItems.length === 0) {
      // Fallback: treat entire response as text
      return [{
        type: 'text',
        content: response,
        page_idx: 0,
        metadata: { source: 'gemini_fallback' }
      }];
    }

    return contentItems;
  } finally {
    // Clean up uploaded file
    if (geminiFileName) {
      try {
        await deleteGeminiFile(geminiFileName);
      } catch (error) {
        console.error('Error deleting Gemini file:', error);
      }
    }
  }
}

/**
 * Parse Gemini's response into ContentItem array
 */
function parseGeminiResponse(response: string): ContentItem[] {
  try {
    // Try to extract JSON from the response
    // Gemini might wrap it in markdown code blocks
    let jsonStr = response;

    // Remove markdown code blocks if present
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    // Try to find JSON array in the response
    const arrayMatch = jsonStr.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      jsonStr = arrayMatch[0];
    }

    const parsed = JSON.parse(jsonStr);

    if (!Array.isArray(parsed)) {
      console.warn('Gemini response is not an array, wrapping');
      return [{
        type: 'text',
        content: response,
        page_idx: 0,
        metadata: {}
      }];
    }

    // Validate and normalize each item
    return parsed.map((item: unknown, idx: number) => {
      const rawItem = item as Record<string, unknown>;
      return {
        type: normalizeType(rawItem.type),
        content: String(rawItem.content || ''),
        page_idx: typeof rawItem.page_idx === 'number' ? rawItem.page_idx : idx,
        metadata: rawItem.metadata || {}
      } as ContentItem;
    }).filter(item => item.content && item.content.trim());
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    // Return raw response as single text chunk
    return [{
      type: 'text',
      content: response,
      page_idx: 0,
      metadata: { parseError: true }
    }];
  }
}

/**
 * Normalize content type to valid values
 */
function normalizeType(type: unknown): 'text' | 'table' | 'image' {
  const typeStr = String(type || 'text').toLowerCase();
  if (typeStr === 'table') return 'table';
  if (typeStr === 'image') return 'image';
  return 'text';
}

/**
 * Check if Gemini document parsing is available
 * (Always true if GOOGLE_AI_API_KEY is set)
 */
export function isGeminiParsingAvailable(): boolean {
  return !!process.env.GOOGLE_AI_API_KEY;
}
