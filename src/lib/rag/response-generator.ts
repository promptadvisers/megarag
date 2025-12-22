import { generateContent, generateContentWithModel } from '@/lib/gemini/client';
import { retrieve, getDocumentInfo } from './retriever';
import { DEFAULT_SYSTEM_PROMPT } from './constants';
import type { QueryMode, QueryResponse, RetrievalResult, ChunkWithScore } from '@/types';

// Re-export for convenience
export { DEFAULT_SYSTEM_PROMPT } from './constants';

/**
 * Chat settings interface
 */
export interface ChatSettings {
  systemPrompt?: string | null;
  model?: string | null;
  geminiApiKey?: string | null;
}

/**
 * Build the user prompt with context and query
 */
function buildUserPrompt(
  query: string,
  retrievalResult: RetrievalResult
): string {
  const parts: string[] = [];

  parts.push('## Context\n');

  // Add entity context if available
  if (retrievalResult.entities.length > 0) {
    parts.push('### Relevant Entities');
    for (const entity of retrievalResult.entities) {
      const description = entity.description || 'No description available';
      parts.push(`- **${entity.entity_name}** (${entity.entity_type || 'Unknown type'}): ${description}`);
    }
    parts.push('');
  }

  // Add relation context if available
  if (retrievalResult.relations.length > 0) {
    parts.push('### Relationships');
    for (const relation of retrievalResult.relations) {
      const description = relation.description || '';
      parts.push(`- ${relation.source_entity_id} → [${relation.relation_type}] → ${relation.target_entity_id}${description ? ': ' + description : ''}`);
    }
    parts.push('');
  }

  // Add source documents
  if (retrievalResult.chunks.length > 0) {
    parts.push('### Source Documents');
    retrievalResult.chunks.forEach((chunk, index) => {
      parts.push(`\n[Source ${index + 1}]`);
      parts.push(chunk.content);
    });
    parts.push('');
  }

  parts.push('---\n');
  parts.push('## Question');
  parts.push(query);
  parts.push('\n---\n');
  parts.push('Provide a comprehensive answer based on the context above. Cite sources as [Source 1], [Source 2], etc.');

  return parts.join('\n');
}

/**
 * Format sources for the response
 */
async function formatSources(
  chunks: ChunkWithScore[]
): Promise<QueryResponse['sources']> {
  // Get unique document IDs
  const documentIds = [...new Set(chunks.map(c => c.document_id))];

  // Fetch document info
  const docInfo = await getDocumentInfo(documentIds);

  return chunks.map(chunk => {
    const doc = docInfo.get(chunk.document_id);
    return {
      id: chunk.id,
      content: chunk.content.slice(0, 500) + (chunk.content.length > 500 ? '...' : ''),
      document_id: chunk.document_id,
      document_name: doc?.fileName || 'Unknown Document',
      document_type: doc?.fileType || 'unknown',
      similarity: chunk.similarity,
      chunk_type: chunk.chunk_type,
    };
  });
}

/**
 * Generate a response to a query using RAG
 */
export async function generateResponse(
  query: string,
  mode: QueryMode = 'mix',
  workspace: string = 'default',
  topK: number = 10,
  settings?: ChatSettings
): Promise<QueryResponse> {
  // Retrieve relevant context
  const retrievalResult = await retrieve(query, mode, workspace, topK);

  // Check if we have any context
  if (retrievalResult.chunks.length === 0 && retrievalResult.entities.length === 0) {
    return {
      response: "I couldn't find any relevant information in the documents to answer your question. Please make sure documents have been uploaded and processed.",
      sources: [],
      entities: [],
    };
  }

  // Use custom system prompt or default
  const systemPrompt = settings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const modelId = settings?.model || 'gemini-2.5-flash';

  // Build the prompt
  const userPrompt = buildUserPrompt(query, retrievalResult);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  // Generate response using Gemini with selected model
  let response: string;
  try {
    response = await generateContentWithModel(fullPrompt, modelId, settings?.geminiApiKey || undefined);
  } catch (error) {
    console.error('Error generating response:', error);
    response = "I encountered an error while generating a response. Please try again.";
  }

  // Format sources
  const sources = await formatSources(retrievalResult.chunks);

  // Extract entity info for response
  const entities = retrievalResult.entities.map(e => ({
    name: e.entity_name,
    type: e.entity_type || 'Unknown',
  }));

  return {
    response,
    sources,
    entities,
  };
}

/**
 * Stream a response to a query using RAG (for future streaming support)
 */
export async function* streamResponse(
  query: string,
  mode: QueryMode = 'mix',
  workspace: string = 'default',
  topK: number = 10,
  settings?: ChatSettings
): AsyncGenerator<{ type: 'context' | 'text' | 'done'; data: unknown }> {
  // Retrieve relevant context
  const retrievalResult = await retrieve(query, mode, workspace, topK);

  // Yield context info first
  yield {
    type: 'context',
    data: {
      chunksFound: retrievalResult.chunks.length,
      entitiesFound: retrievalResult.entities.length,
      relationsFound: retrievalResult.relations.length,
    },
  };

  // Check if we have any context
  if (retrievalResult.chunks.length === 0 && retrievalResult.entities.length === 0) {
    yield {
      type: 'text',
      data: "I couldn't find any relevant information in the documents to answer your question.",
    };
    yield { type: 'done', data: null };
    return;
  }

  // Use custom system prompt or default
  const systemPrompt = settings?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
  const modelId = settings?.model || 'gemini-2.5-flash';

  // Build and generate response
  const userPrompt = buildUserPrompt(query, retrievalResult);
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

  try {
    const response = await generateContentWithModel(fullPrompt, modelId, settings?.geminiApiKey || undefined);
    yield { type: 'text', data: response };
  } catch (error) {
    yield { type: 'text', data: "Error generating response. Please try again." };
  }

  yield { type: 'done', data: null };
}
