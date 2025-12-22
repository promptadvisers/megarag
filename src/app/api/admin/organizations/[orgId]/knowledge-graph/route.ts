import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import {
  withAdminAuth,
  createAdminSuccessResponse,
  createAdminErrorResponse,
} from '@/lib/auth/admin-auth';
import type { AdminContext } from '@/lib/auth/context';

interface RouteParams {
  orgId: string;
}

interface GraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  description?: string;
}

/**
 * GET /api/admin/organizations/[orgId]/knowledge-graph - Get knowledge graph data
 * Returns nodes (entities) and edges (relations) for visualization
 */
export const GET = withAdminAuth<RouteParams>(
  async (request: NextRequest, ctx: AdminContext, params) => {
    const orgId = params?.orgId;

    if (orgId !== ctx.orgId) {
      return createAdminErrorResponse('FORBIDDEN', 'Cannot access other organizations', 403);
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 500);
    const entityType = searchParams.get('entity_type');
    const centerEntity = searchParams.get('center'); // Entity ID to center the graph around

    try {
      let entityIds: string[] = [];

      if (centerEntity) {
        // Get entities connected to the center entity
        const { data: centerRelations } = await supabaseAdmin
          .from('relations')
          .select('source_entity, target_entity')
          .eq('workspace', orgId)
          .or(`source_entity.eq.${centerEntity},target_entity.eq.${centerEntity}`);

        const connectedEntities = new Set<string>([centerEntity]);
        centerRelations?.forEach(r => {
          connectedEntities.add(r.source_entity);
          connectedEntities.add(r.target_entity);
        });
        entityIds = Array.from(connectedEntities).slice(0, limit);
      }

      // Get entities (nodes)
      let entitiesQuery = supabaseAdmin
        .from('entities')
        .select('id, name, entity_type, description')
        .eq('workspace', orgId)
        .limit(limit);

      if (entityType) {
        entitiesQuery = entitiesQuery.eq('entity_type', entityType);
      }

      if (entityIds.length > 0) {
        entitiesQuery = entitiesQuery.in('id', entityIds);
      }

      const { data: entities, error: entitiesError } = await entitiesQuery;

      if (entitiesError) {
        console.error('Error fetching entities:', entitiesError);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch entities', 500);
      }

      // Get entity IDs for relation filtering
      const fetchedEntityIds = entities?.map(e => e.id) || [];

      // Get relations (edges) between these entities
      let relationsQuery = supabaseAdmin
        .from('relations')
        .select('id, source_entity, target_entity, relation_type, description')
        .eq('workspace', orgId);

      if (fetchedEntityIds.length > 0) {
        relationsQuery = relationsQuery
          .in('source_entity', fetchedEntityIds)
          .in('target_entity', fetchedEntityIds);
      }

      const { data: relations, error: relationsError } = await relationsQuery.limit(limit * 2);

      if (relationsError) {
        console.error('Error fetching relations:', relationsError);
        return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch relations', 500);
      }

      // Transform to graph format
      const nodes: GraphNode[] = (entities || []).map(e => ({
        id: e.id,
        name: e.name,
        type: e.entity_type,
        description: e.description,
      }));

      const edges: GraphEdge[] = (relations || []).map(r => ({
        id: r.id,
        source: r.source_entity,
        target: r.target_entity,
        type: r.relation_type,
        description: r.description,
      }));

      // Get available entity types for filtering
      const { data: types } = await supabaseAdmin
        .from('entities')
        .select('entity_type')
        .eq('workspace', orgId);

      const uniqueTypes = [...new Set(types?.map(t => t.entity_type) || [])];

      return createAdminSuccessResponse({
        nodes,
        edges,
        available_entity_types: uniqueTypes,
        meta: {
          node_count: nodes.length,
          edge_count: edges.length,
          limit_applied: limit,
        },
      });
    } catch (error) {
      console.error('Knowledge graph error:', error);
      return createAdminErrorResponse('SERVER_ERROR', 'Failed to fetch knowledge graph', 500);
    }
  }
);
