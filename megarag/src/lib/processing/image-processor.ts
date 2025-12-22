import { v4 as uuidv4 } from 'uuid';
import { describeImage } from './content-describer';
import { estimateTokenCount } from './text-processor';
import type { ChunkInsert } from '@/types';

/**
 * Process a standalone image file into a chunk with description
 */
export async function processStandaloneImage(
  imageBuffer: ArrayBuffer,
  mimeType: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ChunkInsert[]> {
  try {
    // Convert buffer to base64
    const base64 = Buffer.from(imageBuffer).toString('base64');

    // Generate description using Gemini Vision
    const description = await describeImage(base64);

    if (!description || description.trim() === '') {
      throw new Error('Could not generate image description');
    }

    const chunk: ChunkInsert = {
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: description,
      tokens: estimateTokenCount(description),
      chunk_type: 'image',
      metadata: {
        mimeType,
        hasImageData: true,
        isStandaloneImage: true,
      },
    };

    return [chunk];
  } catch (error) {
    console.error('Error processing standalone image:', error);

    // Return a placeholder chunk on error
    return [{
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: 'Image could not be analyzed.',
      tokens: 5,
      chunk_type: 'image',
      metadata: {
        mimeType,
        processingError: error instanceof Error ? error.message : 'Unknown error',
      },
    }];
  }
}

/**
 * Process multiple images in batch
 */
export async function processImagesBatch(
  images: Array<{ buffer: ArrayBuffer; mimeType: string }>,
  documentId: string,
  workspace: string = 'default',
  startIndex: number = 0
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];

  for (let i = 0; i < images.length; i++) {
    const { buffer, mimeType } = images[i];

    try {
      const base64 = Buffer.from(buffer).toString('base64');
      const description = await describeImage(base64);

      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: startIndex + i,
        content: description,
        tokens: estimateTokenCount(description),
        chunk_type: 'image',
        metadata: {
          mimeType,
          imageIndex: i,
        },
      });
    } catch (error) {
      console.error(`Error processing image ${i}:`, error);
      chunks.push({
        id: uuidv4(),
        workspace,
        document_id: documentId,
        chunk_order_index: startIndex + i,
        content: `Image ${i + 1} could not be analyzed.`,
        tokens: 6,
        chunk_type: 'image',
        metadata: {
          mimeType,
          imageIndex: i,
          processingError: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    }
  }

  return chunks;
}
