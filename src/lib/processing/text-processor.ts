import { v4 as uuidv4 } from 'uuid';
import type { ChunkInsert } from '@/types';

// Configuration
const CHUNK_SIZE_TOKENS = parseInt(process.env.CHUNK_SIZE_TOKENS || '800');
const CHUNK_OVERLAP_TOKENS = parseInt(process.env.CHUNK_OVERLAP_TOKENS || '100');

// Approximate tokens per character (GPT-style tokenization averages ~4 chars per token)
const CHARS_PER_TOKEN = 4;

interface TextChunk {
  content: string;
  startIndex: number;
  endIndex: number;
  tokenCount: number;
}

/**
 * Estimate token count for a string
 * This is an approximation - actual tokenization may vary by model
 */
export function estimateTokenCount(text: string): number {
  // Simple estimation: ~4 characters per token on average
  // This works reasonably well for English text
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Split text into sentences (basic sentence boundary detection)
 */
function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries while preserving the delimiter
  const sentenceRegex = /[^.!?]*[.!?]+[\s]*/g;
  const sentences: string[] = [];
  let match;
  let lastIndex = 0;

  while ((match = sentenceRegex.exec(text)) !== null) {
    sentences.push(match[0]);
    lastIndex = sentenceRegex.lastIndex;
  }

  // Add any remaining text that doesn't end with punctuation
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) {
      sentences.push(remaining);
    }
  }

  return sentences;
}

/**
 * Split text into paragraphs
 */
function splitIntoParagraphs(text: string): string[] {
  return text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
}

/**
 * Chunk text using token-based splitting with overlap
 * Tries to split at sentence boundaries when possible
 */
export function chunkText(
  text: string,
  chunkSizeTokens: number = CHUNK_SIZE_TOKENS,
  overlapTokens: number = CHUNK_OVERLAP_TOKENS
): TextChunk[] {
  const chunks: TextChunk[] = [];

  // Normalize whitespace
  const normalizedText = text.replace(/\r\n/g, '\n').trim();

  if (!normalizedText) {
    return [];
  }

  const totalTokens = estimateTokenCount(normalizedText);

  // If text is smaller than chunk size, return as single chunk
  if (totalTokens <= chunkSizeTokens) {
    return [{
      content: normalizedText,
      startIndex: 0,
      endIndex: normalizedText.length,
      tokenCount: totalTokens,
    }];
  }

  // Split into paragraphs first, then sentences
  const paragraphs = splitIntoParagraphs(normalizedText);

  let currentChunk = '';
  let currentTokens = 0;
  let chunkStartIndex = 0;
  let currentIndex = 0;

  for (const paragraph of paragraphs) {
    const sentences = splitIntoSentences(paragraph);

    for (const sentence of sentences) {
      const sentenceTokens = estimateTokenCount(sentence);

      // If adding this sentence would exceed chunk size
      if (currentTokens + sentenceTokens > chunkSizeTokens && currentChunk) {
        // Save current chunk
        chunks.push({
          content: currentChunk.trim(),
          startIndex: chunkStartIndex,
          endIndex: currentIndex,
          tokenCount: currentTokens,
        });

        // Start new chunk with overlap
        // Find overlap content from the end of current chunk
        const overlapChars = overlapTokens * CHARS_PER_TOKEN;
        const overlapStart = Math.max(0, currentChunk.length - overlapChars);
        const overlapContent = currentChunk.slice(overlapStart);

        currentChunk = overlapContent + sentence;
        currentTokens = estimateTokenCount(currentChunk);
        chunkStartIndex = currentIndex - overlapContent.length;
      } else {
        // Add sentence to current chunk
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }

      currentIndex += sentence.length;
    }

    // Add paragraph break
    currentIndex += 2; // Account for \n\n between paragraphs
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      startIndex: chunkStartIndex,
      endIndex: normalizedText.length,
      tokenCount: estimateTokenCount(currentChunk),
    });
  }

  return chunks;
}

/**
 * Process a text file (TXT or MD) into chunks ready for database insertion
 */
export async function processTextFile(
  content: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ChunkInsert[]> {
  const textChunks = chunkText(content);

  const chunks: ChunkInsert[] = textChunks.map((chunk, index) => ({
    id: uuidv4(),
    workspace,
    document_id: documentId,
    chunk_order_index: index,
    content: chunk.content,
    tokens: chunk.tokenCount,
    chunk_type: 'text',
    metadata: {
      startIndex: chunk.startIndex,
      endIndex: chunk.endIndex,
    },
  }));

  return chunks;
}

/**
 * Process markdown file - same as text but preserves markdown structure hints
 */
export async function processMarkdownFile(
  content: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ChunkInsert[]> {
  // For markdown, we could do smarter chunking based on headers
  // For now, use the same text chunking
  const chunks = await processTextFile(content, documentId, workspace);

  // Mark as markdown in metadata
  return chunks.map(chunk => ({
    ...chunk,
    metadata: {
      ...chunk.metadata,
      isMarkdown: true,
    },
  }));
}
