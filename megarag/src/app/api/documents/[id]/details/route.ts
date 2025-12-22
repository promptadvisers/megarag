import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

/**
 * GET /api/documents/[id]/details - Get full document details with chunks, entities, relations
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Get document
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('id', id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    // Get chunks for this document (column is chunk_order_index, not chunk_index)
    const { data: chunks, error: chunksError } = await supabaseAdmin
      .from('chunks')
      .select('id, document_id, chunk_order_index, content, chunk_type, tokens, page_idx, timestamp_start, timestamp_end, metadata, created_at')
      .eq('document_id', id)
      .order('chunk_order_index', { ascending: true });

    if (chunksError) {
      console.error('Error fetching chunks:', chunksError);
    }

    // Get chunk IDs for this document to find related entities
    const chunkIds = (chunks || []).map(c => c.id);

    // Get entities that reference any of these chunks
    // Entities don't have document_id - they link via source_chunk_ids
    let entities: Array<{
      id: string;
      entity_name: string;
      entity_type: string;
      description: string | null;
      source_chunk_ids: string[];
      created_at: string;
    }> = [];

    if (chunkIds.length > 0) {
      const { data: entitiesData, error: entitiesError } = await supabaseAdmin
        .from('entities')
        .select('id, entity_name, entity_type, description, source_chunk_ids, created_at');

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
      } else if (entitiesData) {
        // Filter to entities that have at least one chunk from this document
        entities = entitiesData.filter(e => {
          const sourceIds = e.source_chunk_ids || [];
          return sourceIds.some((chunkId: string) => chunkIds.includes(chunkId));
        });
      }
    }

    // Get entity IDs for finding relations
    const entityIds = entities.map(e => e.id);

    // Get relations between these entities
    let relations: Array<{
      id: string;
      source_entity_id: string;
      target_entity_id: string;
      relation_type: string;
      description: string | null;
      source_chunk_ids: string[];
      created_at: string;
    }> = [];

    if (entityIds.length > 0) {
      const { data: relationsData, error: relationsError } = await supabaseAdmin
        .from('relations')
        .select('id, source_entity_id, target_entity_id, relation_type, description, source_chunk_ids, created_at')
        .or(`source_entity_id.in.(${entityIds.join(',')}),target_entity_id.in.(${entityIds.join(',')})`);

      if (relationsError) {
        console.error('Error fetching relations:', relationsError);
      } else if (relationsData) {
        relations = relationsData;
      }
    }

    // Build entity lookup for relation display (use entity_name not name)
    const entityMap = new Map(
      entities.map(e => [e.id, e])
    );

    // Enrich relations with entity names
    const enrichedRelations = relations.map(r => ({
      ...r,
      source_entity_name: entityMap.get(r.source_entity_id)?.entity_name || 'Unknown',
      target_entity_name: entityMap.get(r.target_entity_id)?.entity_name || 'Unknown',
    }));

    // Transform chunks to use chunk_index for frontend compatibility
    const transformedChunks = (chunks || []).map(c => ({
      ...c,
      chunk_index: c.chunk_order_index,
    }));

    // Transform entities to use name for frontend compatibility
    const transformedEntities = entities.map(e => ({
      ...e,
      name: e.entity_name,
    }));

    // Calculate stats
    const stats = {
      totalChunks: transformedChunks.length,
      totalEntities: transformedEntities.length,
      totalRelations: enrichedRelations.length,
      entityTypes: {} as Record<string, number>,
      relationTypes: {} as Record<string, number>,
      avgChunkLength: 0,
    };

    // Count entity types
    transformedEntities.forEach(e => {
      stats.entityTypes[e.entity_type] = (stats.entityTypes[e.entity_type] || 0) + 1;
    });

    // Count relation types
    enrichedRelations.forEach(r => {
      stats.relationTypes[r.relation_type] = (stats.relationTypes[r.relation_type] || 0) + 1;
    });

    // Calculate average chunk length
    if (transformedChunks.length > 0) {
      const totalLength = transformedChunks.reduce((sum, c) => sum + (c.content?.length || 0), 0);
      stats.avgChunkLength = Math.round(totalLength / transformedChunks.length);
    }

    return NextResponse.json({
      document,
      chunks: transformedChunks,
      entities: transformedEntities,
      relations: enrichedRelations,
      stats,
    });
  } catch (error) {
    console.error('Get document details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
