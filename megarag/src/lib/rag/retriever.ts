import { supabaseAdmin } from '@/lib/supabase/server';
import { generateEmbedding } from '@/lib/gemini/embeddings';
import type {
  QueryMode,
  ChunkWithScore,
  EntityWithScore,
  RelationWithScore,
  RetrievalResult,
} from '@/types';

const DEFAULT_TOP_K = 10;
const DEFAULT_THRESHOLD = 0.3;

/**
 * Search chunks using vector similarity
 */
export async function searchChunks(
  queryEmbedding: number[],
  workspace: string = 'default',
  topK: number = DEFAULT_TOP_K,
  threshold: number = DEFAULT_THRESHOLD
): Promise<ChunkWithScore[]> {
  const { data, error } = await supabaseAdmin.rpc('search_chunks', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error('Error searching chunks:', error);
    return [];
  }

  return data || [];
}

/**
 * Search entities using vector similarity
 */
export async function searchEntities(
  queryEmbedding: number[],
  workspace: string = 'default',
  topK: number = DEFAULT_TOP_K,
  threshold: number = DEFAULT_THRESHOLD
): Promise<EntityWithScore[]> {
  const { data, error } = await supabaseAdmin.rpc('search_entities', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error('Error searching entities:', error);
    return [];
  }

  return data || [];
}

/**
 * Search relations using vector similarity
 */
export async function searchRelations(
  queryEmbedding: number[],
  workspace: string = 'default',
  topK: number = DEFAULT_TOP_K,
  threshold: number = DEFAULT_THRESHOLD
): Promise<RelationWithScore[]> {
  const { data, error } = await supabaseAdmin.rpc('search_relations', {
    query_embedding: queryEmbedding,
    match_threshold: threshold,
    match_count: topK,
  });

  if (error) {
    console.error('Error searching relations:', error);
    return [];
  }

  return data || [];
}

/**
 * Get chunks by entity source chunk IDs
 */
async function getChunksByIds(chunkIds: string[]): Promise<ChunkWithScore[]> {
  if (chunkIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from('chunks')
    .select('*')
    .in('id', chunkIds);

  if (error) {
    console.error('Error fetching chunks by IDs:', error);
    return [];
  }

  // Add default similarity score for entity-linked chunks
  return (data || []).map(chunk => ({
    ...chunk,
    similarity: 0.8, // Default score for entity-linked chunks
  }));
}

/**
 * Get entity names by IDs
 */
async function getEntityNames(entityIds: string[]): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('entities')
    .select('id, entity_name')
    .in('id', entityIds);

  if (error) {
    console.error('Error fetching entity names:', error);
    return new Map();
  }

  const nameMap = new Map<string, string>();
  for (const entity of data || []) {
    nameMap.set(entity.id, entity.entity_name);
  }
  return nameMap;
}

/**
 * Naive mode: Vector search on chunks only
 */
async function retrieveNaive(
  queryEmbedding: number[],
  workspace: string,
  topK: number
): Promise<RetrievalResult> {
  const chunks = await searchChunks(queryEmbedding, workspace, topK);

  return {
    chunks,
    entities: [],
    relations: [],
    context: buildContext(chunks, [], []),
  };
}

/**
 * Local mode: Search entities → get related chunks
 */
async function retrieveLocal(
  queryEmbedding: number[],
  workspace: string,
  topK: number
): Promise<RetrievalResult> {
  // Search for relevant entities
  const entities = await searchEntities(queryEmbedding, workspace, topK);

  // Get all source chunk IDs from entities
  const chunkIds = new Set<string>();
  for (const entity of entities) {
    const sourceIds = entity.source_chunk_ids as string[];
    if (sourceIds) {
      sourceIds.forEach(id => chunkIds.add(id));
    }
  }

  // Fetch the related chunks
  const chunks = await getChunksByIds(Array.from(chunkIds));

  return {
    chunks,
    entities,
    relations: [],
    context: buildContext(chunks, entities, []),
  };
}

/**
 * Global mode: Search relations → get connected entities and chunks
 */
async function retrieveGlobal(
  queryEmbedding: number[],
  workspace: string,
  topK: number
): Promise<RetrievalResult> {
  // Search for relevant relations
  const relations = await searchRelations(queryEmbedding, workspace, topK);

  // Get all entity IDs from relations
  const entityIds = new Set<string>();
  const chunkIds = new Set<string>();

  for (const relation of relations) {
    entityIds.add(relation.source_entity_id);
    entityIds.add(relation.target_entity_id);
    const sourceIds = relation.source_chunk_ids as string[];
    if (sourceIds) {
      sourceIds.forEach(id => chunkIds.add(id));
    }
  }

  // Get entity names for context
  const entityNames = await getEntityNames(Array.from(entityIds));

  // Fetch related chunks
  const chunks = await getChunksByIds(Array.from(chunkIds));

  // Create entity placeholders with names
  const entities: EntityWithScore[] = Array.from(entityIds).map(id => ({
    id,
    workspace,
    entity_name: entityNames.get(id) || 'Unknown',
    entity_type: '',
    description: null,
    content_vector: null,
    source_chunk_ids: [],
    created_at: '',
    similarity: 0.7,
  }));

  return {
    chunks,
    entities,
    relations,
    context: buildContext(chunks, entities, relations),
  };
}

/**
 * Hybrid mode: Combine local (entities) + global (relations)
 */
async function retrieveHybrid(
  queryEmbedding: number[],
  workspace: string,
  topK: number
): Promise<RetrievalResult> {
  // Run local and global in parallel
  const [localResult, globalResult] = await Promise.all([
    retrieveLocal(queryEmbedding, workspace, Math.ceil(topK / 2)),
    retrieveGlobal(queryEmbedding, workspace, Math.ceil(topK / 2)),
  ]);

  // Merge and deduplicate chunks
  const chunkMap = new Map<string, ChunkWithScore>();
  for (const chunk of [...localResult.chunks, ...globalResult.chunks]) {
    if (!chunkMap.has(chunk.id) || chunk.similarity > chunkMap.get(chunk.id)!.similarity) {
      chunkMap.set(chunk.id, chunk);
    }
  }

  // Merge and deduplicate entities
  const entityMap = new Map<string, EntityWithScore>();
  for (const entity of [...localResult.entities, ...globalResult.entities]) {
    if (!entityMap.has(entity.id) || entity.similarity > entityMap.get(entity.id)!.similarity) {
      entityMap.set(entity.id, entity);
    }
  }

  const chunks = Array.from(chunkMap.values()).sort((a, b) => b.similarity - a.similarity);
  const entities = Array.from(entityMap.values()).sort((a, b) => b.similarity - a.similarity);
  const relations = globalResult.relations;

  return {
    chunks,
    entities,
    relations,
    context: buildContext(chunks, entities, relations),
  };
}

/**
 * Mix mode: Full hybrid - chunks + entities + relations
 */
async function retrieveMix(
  queryEmbedding: number[],
  workspace: string,
  topK: number
): Promise<RetrievalResult> {
  // Run all searches in parallel
  const [chunks, entities, relations] = await Promise.all([
    searchChunks(queryEmbedding, workspace, topK),
    searchEntities(queryEmbedding, workspace, Math.ceil(topK / 2)),
    searchRelations(queryEmbedding, workspace, Math.ceil(topK / 2)),
  ]);

  // Also get chunks linked to found entities
  const entityChunkIds = new Set<string>();
  for (const entity of entities) {
    const sourceIds = entity.source_chunk_ids as string[];
    if (sourceIds) {
      sourceIds.forEach(id => entityChunkIds.add(id));
    }
  }

  // Get relation-linked chunks
  for (const relation of relations) {
    const sourceIds = relation.source_chunk_ids as string[];
    if (sourceIds) {
      sourceIds.forEach(id => entityChunkIds.add(id));
    }
  }

  // Fetch additional chunks from entities/relations
  const additionalChunks = await getChunksByIds(
    Array.from(entityChunkIds).filter(id => !chunks.find(c => c.id === id))
  );

  // Merge chunks, keeping highest similarity
  const chunkMap = new Map<string, ChunkWithScore>();
  for (const chunk of [...chunks, ...additionalChunks]) {
    if (!chunkMap.has(chunk.id) || chunk.similarity > chunkMap.get(chunk.id)!.similarity) {
      chunkMap.set(chunk.id, chunk);
    }
  }

  const mergedChunks = Array.from(chunkMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);

  return {
    chunks: mergedChunks,
    entities,
    relations,
    context: buildContext(mergedChunks, entities, relations),
  };
}

/**
 * Build context string from retrieved results
 */
function buildContext(
  chunks: ChunkWithScore[],
  entities: EntityWithScore[],
  relations: RelationWithScore[]
): string {
  const parts: string[] = [];

  // Add entity context
  if (entities.length > 0) {
    parts.push('### Relevant Entities');
    for (const entity of entities) {
      parts.push(`- **${entity.entity_name}** (${entity.entity_type}): ${entity.description || 'No description'}`);
    }
    parts.push('');
  }

  // Add relation context
  if (relations.length > 0) {
    parts.push('### Relationships');
    for (const relation of relations) {
      parts.push(`- ${relation.source_entity_id} → ${relation.relation_type} → ${relation.target_entity_id}: ${relation.description || ''}`);
    }
    parts.push('');
  }

  // Add chunk context
  if (chunks.length > 0) {
    parts.push('### Source Documents');
    chunks.forEach((chunk, index) => {
      parts.push(`[Source ${index + 1}] (similarity: ${chunk.similarity.toFixed(3)})`);
      parts.push(chunk.content);
      parts.push('');
    });
  }

  return parts.join('\n');
}

/**
 * Main retrieval function - routes to appropriate mode
 */
export async function retrieve(
  query: string,
  mode: QueryMode = 'mix',
  workspace: string = 'default',
  topK: number = DEFAULT_TOP_K
): Promise<RetrievalResult> {
  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(query);

  switch (mode) {
    case 'naive':
      return retrieveNaive(queryEmbedding, workspace, topK);
    case 'local':
      return retrieveLocal(queryEmbedding, workspace, topK);
    case 'global':
      return retrieveGlobal(queryEmbedding, workspace, topK);
    case 'hybrid':
      return retrieveHybrid(queryEmbedding, workspace, topK);
    case 'mix':
    default:
      return retrieveMix(queryEmbedding, workspace, topK);
  }
}

/**
 * Get document info for source references
 */
export async function getDocumentInfo(documentIds: string[]): Promise<Map<string, { fileName: string; fileType: string }>> {
  if (documentIds.length === 0) return new Map();

  const { data, error } = await supabaseAdmin
    .from('documents')
    .select('id, file_name, file_type')
    .in('id', documentIds);

  if (error) {
    console.error('Error fetching document info:', error);
    return new Map();
  }

  const docMap = new Map<string, { fileName: string; fileType: string }>();
  for (const doc of data || []) {
    docMap.set(doc.id, { fileName: doc.file_name, fileType: doc.file_type });
  }
  return docMap;
}
