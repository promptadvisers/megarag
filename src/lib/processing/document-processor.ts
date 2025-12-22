import { v4 as uuidv4 } from 'uuid';
import { parseDocumentWithGemini, isGeminiParsingAvailable } from './gemini-document-parser';
import { chunkText, estimateTokenCount } from './text-processor';
import { describeTable, describeImage } from './content-describer';
import type { ChunkInsert, ContentItem } from '@/types';

const CHUNK_SIZE_TOKENS = parseInt(process.env.CHUNK_SIZE_TOKENS || '800');
const CHUNK_OVERLAP_TOKENS = parseInt(process.env.CHUNK_OVERLAP_TOKENS || '100');

interface ProcessedContent {
  chunks: ChunkInsert[];
  hasImages: boolean;
  hasTables: boolean;
}

/**
 * Process text content items into chunks
 */
async function processTextContent(
  items: ContentItem[],
  documentId: string,
  workspace: string,
  startIndex: number
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];
  let chunkIndex = startIndex;

  for (const item of items) {
    if (!item.content || !item.content.trim()) continue;

    // Chunk the text content
    const textChunks = chunkText(item.content, CHUNK_SIZE_TOKENS, CHUNK_OVERLAP_TOKENS);

    for (const textChunk of textChunks) {
      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: chunkIndex++,
        content: textChunk.content,
        tokens: textChunk.tokenCount,
        chunk_type: 'text',
        page_idx: item.page_idx,
        metadata: {
          ...item.metadata,
          startIndex: textChunk.startIndex,
          endIndex: textChunk.endIndex,
        },
      });
    }
  }

  return chunks;
}

/**
 * Process table content items into chunks with descriptions
 */
async function processTableContent(
  items: ContentItem[],
  documentId: string,
  workspace: string,
  startIndex: number
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];
  let chunkIndex = startIndex;

  for (const item of items) {
    if (!item.content) continue;

    try {
      // Generate a description of the table using Gemini
      const description = await describeTable(item.content);

      // Create a chunk with both the table and its description
      const combinedContent = `Table Description: ${description}\n\nTable Content:\n${item.content}`;

      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: chunkIndex++,
        content: combinedContent,
        tokens: estimateTokenCount(combinedContent),
        chunk_type: 'table',
        page_idx: item.page_idx,
        metadata: {
          ...item.metadata,
          tableMarkdown: item.content,
          description,
        },
      });
    } catch (error) {
      console.error('Error processing table:', error);
      // Fall back to just the table content without description
      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: chunkIndex++,
        content: item.content,
        tokens: estimateTokenCount(item.content),
        chunk_type: 'table',
        page_idx: item.page_idx,
        metadata: item.metadata,
      });
    }
  }

  return chunks;
}

/**
 * Process image content items into chunks with descriptions
 */
async function processImageContent(
  items: ContentItem[],
  documentId: string,
  workspace: string,
  startIndex: number
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];
  let chunkIndex = startIndex;

  for (const item of items) {
    try {
      // Get base64 image data if available
      const imageData = item.metadata?.image_data as string | undefined;

      if (!imageData) {
        // Skip images without data
        console.log('Skipping image without data');
        continue;
      }

      // Generate a description of the image using Gemini Vision
      const description = await describeImage(imageData);

      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: chunkIndex++,
        content: description,
        tokens: estimateTokenCount(description),
        chunk_type: 'image',
        page_idx: item.page_idx,
        metadata: {
          ...item.metadata,
          hasImageData: true,
          description,
        },
      });
    } catch (error) {
      console.error('Error processing image:', error);
      // Create a placeholder chunk for failed images
      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: chunkIndex++,
        content: '[Image could not be processed]',
        tokens: 5,
        chunk_type: 'image',
        page_idx: item.page_idx,
        metadata: {
          ...item.metadata,
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return chunks;
}

/**
 * Process a document file (PDF, DOCX, PPTX, XLSX) into chunks
 * Uses Gemini's native document understanding
 */
export async function processDocumentFile(
  fileBuffer: ArrayBuffer,
  filename: string,
  mimeType: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ProcessedContent> {
  // Check if Gemini is available
  if (!isGeminiParsingAvailable()) {
    throw new Error(
      'Document processing requires GOOGLE_AI_API_KEY to be set. ' +
      'Please add it to your environment variables.'
    );
  }

  // Parse the document using Gemini
  const contentItems = await parseDocumentWithGemini(fileBuffer, filename, mimeType);

  if (contentItems.length === 0) {
    throw new Error('No content extracted from document');
  }

  // Separate content by type
  const textItems = contentItems.filter(item => item.type === 'text');
  const tableItems = contentItems.filter(item => item.type === 'table');
  const imageItems = contentItems.filter(item => item.type === 'image');

  // Process each content type
  const allChunks: ChunkInsert[] = [];
  let currentIndex = 0;

  // Process text first
  const textChunks = await processTextContent(textItems, documentId, workspace, currentIndex);
  allChunks.push(...textChunks);
  currentIndex += textChunks.length;

  // Process tables
  const tableChunks = await processTableContent(tableItems, documentId, workspace, currentIndex);
  allChunks.push(...tableChunks);
  currentIndex += tableChunks.length;

  // Process images
  const imageChunks = await processImageContent(imageItems, documentId, workspace, currentIndex);
  allChunks.push(...imageChunks);

  return {
    chunks: allChunks,
    hasImages: imageItems.length > 0,
    hasTables: tableItems.length > 0,
  };
}

/**
 * Check if a file type is a document type that can be processed
 */
export function isDocumentType(fileType: string): boolean {
  return ['pdf', 'docx', 'pptx', 'xlsx'].includes(fileType.toLowerCase());
}
