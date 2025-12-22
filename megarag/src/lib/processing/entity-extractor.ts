import { v4 as uuidv4 } from 'uuid';
import { generateContent } from '@/lib/gemini/client';
import { generateEmbedding } from '@/lib/gemini/embeddings';
import { supabaseAdmin } from '@/lib/supabase/server';
import type { EntityInsert, RelationInsert, ExtractionResult } from '@/types';

/**
 * System prompt for entity and relation extraction
 */
const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are a Knowledge Graph Specialist. Your task is to extract entities and relationships from text.

## Entity Types
- PERSON: Individual people, historical figures, characters
- ORGANIZATION: Companies, institutions, agencies, teams
- LOCATION: Places, cities, countries, addresses
- EVENT: Named events, conferences, incidents
- CONCEPT: Abstract ideas, theories, methodologies
- TECHNOLOGY: Software, hardware, tools, frameworks
- PRODUCT: Physical or digital products
- DATE: Specific dates, time periods

## Output Format
Return a JSON object with two arrays:

{
  "entities": [
    {
      "name": "Entity Name",
      "type": "ENTITY_TYPE",
      "description": "Brief description of the entity in context"
    }
  ],
  "relations": [
    {
      "source": "Source Entity Name",
      "target": "Target Entity Name",
      "type": "RELATIONSHIP_TYPE",
      "description": "Description of how they are related"
    }
  ]
}

## Relationship Types
- WORKS_FOR, FOUNDED, LEADS (person-organization)
- LOCATED_IN, HEADQUARTERS_IN (entity-location)
- CREATED, DEVELOPED, INVENTED (entity-product/technology)
- PARTICIPATED_IN, ORGANIZED (entity-event)
- RELATED_TO, PART_OF, DEPENDS_ON (general)

## Guidelines
1. Only extract clearly mentioned entities, don't infer
2. Use the exact name as it appears in the text
3. Keep descriptions concise (1-2 sentences)
4. Ensure relationship source/target match extracted entity names exactly
5. Skip generic terms that aren't meaningful entities
6. Return valid JSON only, no markdown code blocks`;

/**
 * Extract entities and relations from a chunk of text using Gemini
 */
export async function extractEntitiesFromText(content: string): Promise<ExtractionResult> {
  try {
    const prompt = `${ENTITY_EXTRACTION_SYSTEM_PROMPT}

Extract all entities and relationships from the following text:

---
${content}
---

Return valid JSON only.`;

    const response = await generateContent(prompt);

    // Parse the JSON response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON found in extraction response');
      return { entities: [], relations: [] };
    }

    const result = JSON.parse(jsonMatch[0]) as ExtractionResult;

    // Validate structure
    if (!Array.isArray(result.entities)) {
      result.entities = [];
    }
    if (!Array.isArray(result.relations)) {
      result.relations = [];
    }

    return result;
  } catch (error) {
    console.error('Error extracting entities:', error);
    return { entities: [], relations: [] };
  }
}

/**
 * Normalize entity name for deduplication
 */
function normalizeEntityName(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Deduplicate and merge entities from multiple chunks
 */
export function deduplicateEntities(
  allEntities: Array<{
    name: string;
    type: string;
    description: string;
    sourceChunkId: string;
  }>
): Map<string, { name: string; type: string; descriptions: string[]; sourceChunkIds: string[] }> {
  const entityMap = new Map<string, {
    name: string;
    type: string;
    descriptions: string[];
    sourceChunkIds: string[];
  }>();

  for (const entity of allEntities) {
    const normalizedName = normalizeEntityName(entity.name);

    if (entityMap.has(normalizedName)) {
      const existing = entityMap.get(normalizedName)!;
      // Add unique description
      if (!existing.descriptions.includes(entity.description)) {
        existing.descriptions.push(entity.description);
      }
      // Add unique source chunk
      if (!existing.sourceChunkIds.includes(entity.sourceChunkId)) {
        existing.sourceChunkIds.push(entity.sourceChunkId);
      }
    } else {
      entityMap.set(normalizedName, {
        name: entity.name, // Keep original casing
        type: entity.type,
        descriptions: [entity.description],
        sourceChunkIds: [entity.sourceChunkId],
      });
    }
  }

  return entityMap;
}

/**
 * Merge multiple descriptions into one
 */
function mergeDescriptions(descriptions: string[]): string {
  if (descriptions.length === 1) {
    return descriptions[0];
  }

  // Remove duplicates and join
  const unique = [...new Set(descriptions)];
  if (unique.length === 1) {
    return unique[0];
  }

  // Combine unique descriptions
  return unique.join(' ');
}

/**
 * Process entities for a document - extract, deduplicate, embed, and store
 */
export async function processEntitiesForDocument(
  documentId: string,
  chunks: Array<{ id: string; content: string }>,
  workspace: string = 'default'
): Promise<{ entitiesCreated: number; relationsCreated: number }> {
  // Collect all extracted entities and relations from chunks
  const allExtractedEntities: Array<{
    name: string;
    type: string;
    description: string;
    sourceChunkId: string;
  }> = [];

  const allExtractedRelations: Array<{
    source: string;
    target: string;
    type: string;
    description: string;
    sourceChunkId: string;
  }> = [];

  // Extract from each chunk
  for (const chunk of chunks) {
    // Skip very short chunks
    if (chunk.content.length < 50) continue;

    const extraction = await extractEntitiesFromText(chunk.content);

    for (const entity of extraction.entities) {
      if (entity.name && entity.type) {
        allExtractedEntities.push({
          name: entity.name,
          type: entity.type,
          description: entity.description || '',
          sourceChunkId: chunk.id,
        });
      }
    }

    for (const relation of extraction.relations) {
      if (relation.source && relation.target && relation.type) {
        allExtractedRelations.push({
          source: relation.source,
          target: relation.target,
          type: relation.type,
          description: relation.description || '',
          sourceChunkId: chunk.id,
        });
      }
    }
  }

  if (allExtractedEntities.length === 0) {
    return { entitiesCreated: 0, relationsCreated: 0 };
  }

  // Deduplicate entities
  const deduplicatedEntities = deduplicateEntities(allExtractedEntities);

  // Create entity records with embeddings
  const entityInserts: EntityInsert[] = [];
  const entityNameToId = new Map<string, string>();

  for (const [normalizedName, entityData] of deduplicatedEntities) {
    const entityId = uuidv4();
    const mergedDescription = mergeDescriptions(entityData.descriptions);

    // Generate embedding for entity description
    let embedding: number[] | undefined;
    try {
      const textToEmbed = `${entityData.name}: ${mergedDescription}`;
      embedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      console.error(`Error generating embedding for entity ${entityData.name}:`, error);
    }

    entityInserts.push({
      id: entityId,
      workspace,
      entity_name: entityData.name,
      entity_type: entityData.type,
      description: mergedDescription,
      content_vector: embedding,
      source_chunk_ids: entityData.sourceChunkIds,
    });

    entityNameToId.set(normalizedName, entityId);
  }

  // Store entities
  if (entityInserts.length > 0) {
    const { error: entityError } = await supabaseAdmin
      .from('entities')
      .insert(entityInserts);

    if (entityError) {
      console.error('Error inserting entities:', entityError);
    }
  }

  // Process relations
  const relationInserts: RelationInsert[] = [];
  const seenRelations = new Set<string>();

  for (const relation of allExtractedRelations) {
    const sourceNormalized = normalizeEntityName(relation.source);
    const targetNormalized = normalizeEntityName(relation.target);

    const sourceId = entityNameToId.get(sourceNormalized);
    const targetId = entityNameToId.get(targetNormalized);

    // Skip if entities don't exist
    if (!sourceId || !targetId) continue;

    // Skip duplicate relations
    const relationKey = `${sourceId}-${relation.type}-${targetId}`;
    if (seenRelations.has(relationKey)) continue;
    seenRelations.add(relationKey);

    // Generate embedding for relation
    let embedding: number[] | undefined;
    try {
      const textToEmbed = `${relation.source} ${relation.type} ${relation.target}: ${relation.description}`;
      embedding = await generateEmbedding(textToEmbed);
    } catch (error) {
      console.error('Error generating embedding for relation:', error);
    }

    relationInserts.push({
      id: uuidv4(),
      workspace,
      source_entity_id: sourceId,
      target_entity_id: targetId,
      relation_type: relation.type,
      description: relation.description,
      content_vector: embedding,
      source_chunk_ids: [relation.sourceChunkId],
    });
  }

  // Store relations
  if (relationInserts.length > 0) {
    const { error: relationError } = await supabaseAdmin
      .from('relations')
      .insert(relationInserts);

    if (relationError) {
      console.error('Error inserting relations:', relationError);
    }
  }

  return {
    entitiesCreated: entityInserts.length,
    relationsCreated: relationInserts.length,
  };
}

/**
 * Get entities for a document
 */
export async function getEntitiesForDocument(documentId: string): Promise<EntityInsert[]> {
  // Get chunk IDs for this document
  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from('chunks')
    .select('id')
    .eq('document_id', documentId);

  if (chunksError || !chunks) {
    return [];
  }

  const chunkIds = chunks.map(c => c.id);

  // Find entities that have any of these chunk IDs in source_chunk_ids
  const { data: entities, error: entitiesError } = await supabaseAdmin
    .from('entities')
    .select('*');

  if (entitiesError || !entities) {
    return [];
  }

  // Filter entities that have at least one matching chunk ID
  return entities.filter(entity => {
    const sourceChunkIds = entity.source_chunk_ids as string[];
    return sourceChunkIds.some(id => chunkIds.includes(id));
  });
}

/**
 * Delete entities and relations for a document
 */
export async function deleteEntitiesForDocument(documentId: string): Promise<void> {
  // Get chunk IDs for this document
  const { data: chunks, error: chunksError } = await supabaseAdmin
    .from('chunks')
    .select('id')
    .eq('document_id', documentId);

  if (chunksError || !chunks) {
    return;
  }

  const chunkIds = chunks.map(c => c.id);

  // Get all entities
  const { data: entities } = await supabaseAdmin
    .from('entities')
    .select('id, source_chunk_ids');

  if (!entities) return;

  // Find entities to delete or update
  for (const entity of entities) {
    const sourceChunkIds = entity.source_chunk_ids as string[];
    const remainingChunkIds = sourceChunkIds.filter(id => !chunkIds.includes(id));

    if (remainingChunkIds.length === 0) {
      // Delete entity completely
      await supabaseAdmin
        .from('entities')
        .delete()
        .eq('id', entity.id);

      // Delete associated relations
      await supabaseAdmin
        .from('relations')
        .delete()
        .or(`source_entity_id.eq.${entity.id},target_entity_id.eq.${entity.id}`);
    } else if (remainingChunkIds.length < sourceChunkIds.length) {
      // Update source_chunk_ids
      await supabaseAdmin
        .from('entities')
        .update({ source_chunk_ids: remainingChunkIds })
        .eq('id', entity.id);
    }
  }
}
