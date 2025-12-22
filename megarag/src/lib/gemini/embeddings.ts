import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_AI_API_KEY;

if (!apiKey) {
  console.warn('GOOGLE_AI_API_KEY not set - embedding generation will not work');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// Gemini text-embedding-004 produces 768-dimensional vectors
export const EMBEDDING_DIMENSION = 768;

// Batch size for embedding generation (to avoid rate limits)
const EMBEDDING_BATCH_SIZE = 100;

// Rate limiting: max requests per minute
const MAX_REQUESTS_PER_MINUTE = 1500; // Gemini's default limit
const REQUEST_DELAY_MS = Math.ceil(60000 / MAX_REQUESTS_PER_MINUTE);

/**
 * Sleep for a specified number of milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });

  try {
    const result = await model.embedContent(text);
    return result.embedding.values;
  } catch (error) {
    console.error('Error generating embedding:', error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple texts in batches
 * Returns array of embeddings in the same order as input texts
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  onProgress?: (completed: number, total: number) => void
): Promise<number[][]> {
  if (!genAI) {
    throw new Error('Gemini API key not configured');
  }

  if (texts.length === 0) {
    return [];
  }

  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const embeddings: number[][] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);

    // Process each text in the batch
    const batchPromises = batch.map(async (text, batchIndex) => {
      // Add small delay to avoid rate limiting
      if (batchIndex > 0) {
        await sleep(REQUEST_DELAY_MS);
      }

      try {
        const result = await model.embedContent(text);
        return result.embedding.values;
      } catch (error) {
        console.error(`Error generating embedding for text at index ${i + batchIndex}:`, error);
        // Return null embedding on error (will be filtered later)
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);

    for (const result of batchResults) {
      if (result) {
        embeddings.push(result);
        completed++;
        onProgress?.(completed, texts.length);
      } else {
        // Push empty array for failed embeddings to maintain order
        embeddings.push([]);
        completed++;
        onProgress?.(completed, texts.length);
      }
    }

    // Add delay between batches
    if (i + EMBEDDING_BATCH_SIZE < texts.length) {
      await sleep(100); // 100ms between batches
    }
  }

  return embeddings;
}

/**
 * Generate embeddings for chunks and update them in place
 * Returns the chunks with embeddings added
 */
export async function addEmbeddingsToChunks<T extends { content: string; content_vector?: number[] }>(
  chunks: T[],
  onProgress?: (completed: number, total: number) => void
): Promise<T[]> {
  const texts = chunks.map(chunk => chunk.content);
  const embeddings = await generateEmbeddingsBatch(texts, onProgress);

  return chunks.map((chunk, index) => ({
    ...chunk,
    content_vector: embeddings[index].length > 0 ? embeddings[index] : undefined,
  }));
}

/**
 * Validate that an embedding has the correct dimension
 */
export function isValidEmbedding(embedding: number[] | null | undefined): boolean {
  return Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSION;
}
