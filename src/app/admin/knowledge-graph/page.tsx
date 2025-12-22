'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Network,
  RefreshCw,
  Loader2,
  Filter,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Info,
  MousePointer,
  Move,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';

interface GraphNode {
  id: string;
  name: string;
  type: string;
  description?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  description?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  available_entity_types: string[];
  meta: {
    node_count: number;
    edge_count: number;
    limit_applied: number;
  };
}

const entityTypeColors: Record<string, { fill: string; stroke: string }> = {
  PERSON: { fill: '#3b82f6', stroke: '#1d4ed8' },
  ORGANIZATION: { fill: '#8b5cf6', stroke: '#6d28d9' },
  LOCATION: { fill: '#22c55e', stroke: '#16a34a' },
  DATE: { fill: '#f97316', stroke: '#ea580c' },
  EVENT: { fill: '#ec4899', stroke: '#db2777' },
  CONCEPT: { fill: '#eab308', stroke: '#ca8a04' },
  TECHNOLOGY: { fill: '#06b6d4', stroke: '#0891b2' },
  PRODUCT: { fill: '#ef4444', stroke: '#dc2626' },
};

const defaultColor = { fill: '#6b7280', stroke: '#4b5563' };

export default function AdminKnowledgeGraphPage() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [nodeLimit, setNodeLimit] = useState(100);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isPanning = useRef(false);
  const draggedNode = useRef<GraphNode | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number | null>(null);

  const width = 800;
  const height = 600;
  const centerX = width / 2;
  const centerY = height / 2;

  const fetchGraph = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: nodeLimit.toString(),
      });
      if (typeFilter !== 'all') {
        params.set('entity_type', typeFilter);
      }

      const res = await fetch(`/api/admin/knowledge-graph?${params}`);
      const data = await res.json();

      if (data.success && data.data.nodes.length > 0) {
        // Initialize nodes with positions in a circle
        const nodes: GraphNode[] = data.data.nodes.map((node: GraphNode, i: number) => {
          const angle = (i / data.data.nodes.length) * 2 * Math.PI;
          const radius = Math.min(width, height) * 0.35;
          return {
            ...node,
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            vx: 0,
            vy: 0,
          };
        });

        setGraphData({
          ...data.data,
          nodes,
        });
      } else {
        setGraphData(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch graph:', error);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, nodeLimit]);

  // Force simulation - runs once when data loads, then stops
  const simulationRunRef = useRef(false);
  const alphaRef = useRef(1);

  useEffect(() => {
    if (!graphData || graphData.nodes.length === 0) return;
    if (simulationRunRef.current) return; // Only run once per data load

    simulationRunRef.current = true;
    alphaRef.current = 1;
    let iterationCount = 0;
    const maxIterations = 300; // Hard limit on iterations

    const simulate = () => {
      if (iterationCount >= maxIterations || alphaRef.current < 0.01) {
        // Simulation complete - stop all velocities
        setGraphData((prev) => {
          if (!prev) return null;
          const nodes = prev.nodes.map(n => ({ ...n, vx: 0, vy: 0 }));
          return { ...prev, nodes };
        });
        return;
      }

      iterationCount++;
      alphaRef.current *= 0.97; // Cooling - simulation slows down over time
      const alpha = alphaRef.current;

      const nodes = graphData.nodes.map(n => ({ ...n }));
      const edges = graphData.edges;

      // Apply forces with cooling
      for (let i = 0; i < nodes.length; i++) {
        // Repulsion from other nodes
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const minDist = 60;

          if (dist < minDist * 3) {
            const force = (minDist * minDist) / (dist * dist) * 0.3 * alpha;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;

            if (!draggedNode.current || draggedNode.current.id !== nodes[i].id) {
              nodes[i].vx -= fx;
              nodes[i].vy -= fy;
            }
            if (!draggedNode.current || draggedNode.current.id !== nodes[j].id) {
              nodes[j].vx += fx;
              nodes[j].vy += fy;
            }
          }
        }

        // Gentle center attraction
        const centerDx = centerX - nodes[i].x;
        const centerDy = centerY - nodes[i].y;
        if (!draggedNode.current || draggedNode.current.id !== nodes[i].id) {
          nodes[i].vx += centerDx * 0.0005 * alpha;
          nodes[i].vy += centerDy * 0.0005 * alpha;
        }
      }

      // Spring force for edges
      edges.forEach((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const dx = targetNode.x - sourceNode.x;
          const dy = targetNode.y - sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 100;
          const force = (dist - targetDist) * 0.01 * alpha;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;

          if (!draggedNode.current || draggedNode.current.id !== sourceNode.id) {
            sourceNode.vx += fx;
            sourceNode.vy += fy;
          }
          if (!draggedNode.current || draggedNode.current.id !== targetNode.id) {
            targetNode.vx -= fx;
            targetNode.vy -= fy;
          }
        }
      });

      // Apply velocity with strong damping
      nodes.forEach((node) => {
        if (!draggedNode.current || draggedNode.current.id !== node.id) {
          node.vx *= 0.6; // Strong damping
          node.vy *= 0.6;
          node.x += node.vx;
          node.y += node.vy;

          // Keep nodes in bounds
          node.x = Math.max(40, Math.min(width - 40, node.x));
          node.y = Math.max(40, Math.min(height - 40, node.y));
        }
      });

      setGraphData((prev) => prev ? { ...prev, nodes } : null);
      animationRef.current = requestAnimationFrame(simulate);
    };

    animationRef.current = requestAnimationFrame(simulate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [graphData?.edges.length, graphData?.nodes.length]);

  // Reset simulation flag when fetching new data
  useEffect(() => {
    simulationRunRef.current = false;
  }, [typeFilter, nodeLimit]);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Track drag start position to distinguish click from drag
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasDragged = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (e.target === svgRef.current) {
      isPanning.current = true;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (isPanning.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastMousePos.current = { x: e.clientX, y: e.clientY };
    } else if (draggedNode.current && graphData) {
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect) {
        // Check if we've moved enough to consider it a drag
        const totalDx = Math.abs(e.clientX - dragStartPos.current.x);
        const totalDy = Math.abs(e.clientY - dragStartPos.current.y);
        if (totalDx > 3 || totalDy > 3) {
          hasDragged.current = true;
        }

        const x = (e.clientX - rect.left - pan.x) / zoom;
        const y = (e.clientY - rect.top - pan.y) / zoom;

        // Clamp to bounds
        const clampedX = Math.max(40, Math.min(width - 40, x));
        const clampedY = Math.max(40, Math.min(height - 40, y));

        // Update node position directly in state for fluid movement
        setGraphData((prev) => {
          if (!prev) return null;
          const draggedId = draggedNode.current?.id;
          const nodes = prev.nodes.map((n) => {
            if (n.id === draggedId) {
              return { ...n, x: clampedX, y: clampedY, vx: 0, vy: 0 };
            }
            // Gently pull connected nodes
            const isConnected = prev.edges.some(
              (edge) =>
                (edge.source === draggedId && edge.target === n.id) ||
                (edge.target === draggedId && edge.source === n.id)
            );
            if (isConnected && draggedId) {
              const draggedN = prev.nodes.find((node) => node.id === draggedId);
              if (draggedN) {
                const dx = clampedX - n.x;
                const dy = clampedY - n.y;
                const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                const targetDist = 100;
                if (dist > targetDist) {
                  const pull = 0.05;
                  return {
                    ...n,
                    x: n.x + dx * pull,
                    y: n.y + dy * pull,
                    vx: 0,
                    vy: 0,
                  };
                }
              }
            }
            return n;
          });
          return { ...prev, nodes };
        });
      }
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    draggedNode.current = null;
  };

  const handleNodeMouseDown = (e: React.MouseEvent, node: GraphNode) => {
    e.stopPropagation();
    e.preventDefault();
    draggedNode.current = node;
    isDragging.current = true;
    hasDragged.current = false;
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleNodeClick = (node: GraphNode) => {
    // Only handle click if we didn't drag
    if (!hasDragged.current) {
      setSelectedNode(selectedNode?.id === node.id ? null : node);
    }
    isDragging.current = false;
    hasDragged.current = false;
  };

  const handleZoomIn = () => setZoom((z) => Math.min(z * 1.2, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z / 1.2, 0.3));
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSelectedNode(null);
  };

  const getNodeConnections = (nodeId: string) => {
    if (!graphData) return [];
    return graphData.edges.filter((e) => e.source === nodeId || e.target === nodeId);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Graph</h1>
          <p className="text-muted-foreground">
            Visualize entities and their relationships
          </p>
        </div>
        <Button onClick={fetchGraph} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-center">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Entity Types</SelectItem>
                {graphData?.available_entity_types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Nodes:</span>
              <Slider
                value={[nodeLimit]}
                onValueChange={([v]) => setNodeLimit(v)}
                min={10}
                max={200}
                step={10}
                className="w-[150px]"
              />
              <span className="text-sm w-10">{nodeLimit}</span>
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="icon" onClick={handleZoomOut}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleZoomIn}>
                <ZoomIn className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" onClick={handleReset}>
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr,320px]">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center justify-between">
              <span>Graph View</span>
              {graphData && (
                <div className="flex gap-2 text-sm font-normal">
                  <Badge variant="outline">{graphData.meta.node_count} nodes</Badge>
                  <Badge variant="outline">{graphData.meta.edge_count} edges</Badge>
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !graphData || graphData.nodes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground bg-muted/20 rounded-lg">
                <Network className="h-16 w-16 mb-4 opacity-50" />
                <p className="text-lg font-medium">No graph data available</p>
                <p className="text-sm">Upload documents to build the knowledge graph</p>
              </div>
            ) : (
              <div
                ref={containerRef}
                className="relative h-[600px] bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 rounded-lg overflow-hidden border"
              >
                <svg
                  ref={svgRef}
                  width="100%"
                  height="100%"
                  viewBox={`0 0 ${width} ${height}`}
                  className="cursor-grab active:cursor-grabbing"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  <defs>
                    <marker
                      id="arrowhead"
                      markerWidth="10"
                      markerHeight="7"
                      refX="9"
                      refY="3.5"
                      orient="auto"
                    >
                      <polygon
                        points="0 0, 10 3.5, 0 7"
                        fill="#475569"
                      />
                    </marker>
                    {Object.entries(entityTypeColors).map(([type, colors]) => (
                      <radialGradient key={type} id={`gradient-${type}`}>
                        <stop offset="0%" stopColor={colors.fill} />
                        <stop offset="100%" stopColor={colors.stroke} />
                      </radialGradient>
                    ))}
                    <radialGradient id="gradient-default">
                      <stop offset="0%" stopColor={defaultColor.fill} />
                      <stop offset="100%" stopColor={defaultColor.stroke} />
                    </radialGradient>
                    <filter id="glow">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                      <feMerge>
                        <feMergeNode in="coloredBlur"/>
                        <feMergeNode in="SourceGraphic"/>
                      </feMerge>
                    </filter>
                  </defs>

                  <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
                    {/* Edges */}
                    {graphData.edges.map((edge) => {
                      const sourceNode = graphData.nodes.find((n) => n.id === edge.source);
                      const targetNode = graphData.nodes.find((n) => n.id === edge.target);
                      if (!sourceNode || !targetNode) return null;

                      const dx = targetNode.x - sourceNode.x;
                      const dy = targetNode.y - sourceNode.y;
                      const dist = Math.sqrt(dx * dx + dy * dy);
                      const nodeRadius = 20;

                      // Shorten line to stop at node edge
                      const startX = sourceNode.x + (dx / dist) * nodeRadius;
                      const startY = sourceNode.y + (dy / dist) * nodeRadius;
                      const endX = targetNode.x - (dx / dist) * (nodeRadius + 5);
                      const endY = targetNode.y - (dy / dist) * (nodeRadius + 5);

                      const isHighlighted =
                        selectedNode?.id === edge.source ||
                        selectedNode?.id === edge.target ||
                        hoveredNode?.id === edge.source ||
                        hoveredNode?.id === edge.target;

                      return (
                        <g key={edge.id}>
                          <line
                            x1={startX}
                            y1={startY}
                            x2={endX}
                            y2={endY}
                            stroke={isHighlighted ? '#94a3b8' : '#334155'}
                            strokeWidth={isHighlighted ? 2 : 1}
                            markerEnd="url(#arrowhead)"
                            className="transition-all duration-200"
                          />
                          {isHighlighted && (
                            <text
                              x={(startX + endX) / 2}
                              y={(startY + endY) / 2 - 8}
                              textAnchor="middle"
                              fill="#94a3b8"
                              fontSize="9"
                              className="pointer-events-none"
                            >
                              {edge.type.replace(/_/g, ' ')}
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Nodes */}
                    {graphData.nodes.map((node) => {
                      const colors = entityTypeColors[node.type] || defaultColor;
                      const isSelected = selectedNode?.id === node.id;
                      const isHovered = hoveredNode?.id === node.id;
                      const isDragged = draggedNode.current?.id === node.id;
                      const isConnected = selectedNode && getNodeConnections(selectedNode.id).some(
                        (e) => e.source === node.id || e.target === node.id
                      );
                      const radius = isSelected || isHovered ? 24 : 20;

                      return (
                        <g
                          key={node.id}
                          transform={`translate(${node.x}, ${node.y})`}
                          className={`cursor-grab active:cursor-grabbing ${isDragged ? 'cursor-grabbing' : ''}`}
                          style={{
                            transition: isDragged ? 'none' : 'transform 0.05s ease-out',
                          }}
                          onMouseDown={(e) => handleNodeMouseDown(e, node)}
                          onClick={() => handleNodeClick(node)}
                          onMouseEnter={() => setHoveredNode(node)}
                          onMouseLeave={() => setHoveredNode(null)}
                        >
                          {/* Glow effect for selected/hovered */}
                          {(isSelected || isHovered) && (
                            <circle
                              cx={0}
                              cy={0}
                              r={radius + 8}
                              fill={colors.fill}
                              opacity={0.3}
                              className="animate-pulse"
                            />
                          )}

                          {/* Node circle */}
                          <circle
                            cx={0}
                            cy={0}
                            r={radius}
                            fill={`url(#gradient-${entityTypeColors[node.type] ? node.type : 'default'})`}
                            stroke={isSelected ? '#fff' : isConnected ? colors.stroke : 'transparent'}
                            strokeWidth={isSelected ? 3 : isConnected ? 2 : 0}
                            filter={isSelected || isHovered ? 'url(#glow)' : undefined}
                          />

                          {/* Node label */}
                          <text
                            x={0}
                            y={radius + 14}
                            textAnchor="middle"
                            fill="#e2e8f0"
                            fontSize="11"
                            fontWeight={isSelected ? 'bold' : 'normal'}
                            className="pointer-events-none select-none"
                          >
                            {node.name.length > 12 ? node.name.substring(0, 12) + '...' : node.name}
                          </text>

                          {/* Type icon letter */}
                          <text
                            x={0}
                            y={5}
                            textAnchor="middle"
                            fill="#fff"
                            fontSize="14"
                            fontWeight="bold"
                            className="pointer-events-none select-none"
                          >
                            {node.type[0]}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                </svg>

                {/* Zoom indicator */}
                <div className="absolute bottom-3 left-3 text-xs text-slate-500 bg-slate-900/80 px-2 py-1 rounded">
                  {Math.round(zoom * 100)}%
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {/* Legend */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Legend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(entityTypeColors).map(([type, colors]) => (
                  <div key={type} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ background: `linear-gradient(135deg, ${colors.fill}, ${colors.stroke})` }}
                    />
                    <span className="text-xs">{type}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Node Details */}
          {selectedNode && (
            <Card className="border-primary/50">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Node Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Name</p>
                  <p className="font-medium mt-1">{selectedNode.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
                  <Badge
                    className="mt-1"
                    style={{
                      backgroundColor: entityTypeColors[selectedNode.type]?.fill || defaultColor.fill,
                      color: '#fff'
                    }}
                  >
                    {selectedNode.type}
                  </Badge>
                </div>
                {selectedNode.description && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">Description</p>
                    <p className="text-sm mt-1 text-muted-foreground">{selectedNode.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Connections</p>
                  <div className="mt-2 space-y-1 max-h-[150px] overflow-y-auto">
                    {getNodeConnections(selectedNode.id).map((edge) => {
                      const otherNodeId = edge.source === selectedNode.id ? edge.target : edge.source;
                      const otherNode = graphData?.nodes.find((n) => n.id === otherNodeId);
                      const isSource = edge.source === selectedNode.id;
                      return (
                        <div
                          key={edge.id}
                          className="text-xs flex items-center gap-1 p-1.5 rounded bg-muted/50"
                        >
                          {isSource ? (
                            <>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-[10px] px-1">{edge.type.replace(/_/g, ' ')}</Badge>
                              <span className="text-muted-foreground">→</span>
                              <span className="font-medium truncate">{otherNode?.name}</span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium truncate">{otherNode?.name}</span>
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline" className="text-[10px] px-1">{edge.type.replace(/_/g, ' ')}</Badge>
                              <span className="text-muted-foreground">→</span>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {getNodeConnections(selectedNode.id).length === 0 && (
                      <p className="text-sm text-muted-foreground">No connections</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tips */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Controls</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <div className="flex items-center gap-2">
                <Move className="h-4 w-4" />
                <span>Drag background to pan</span>
              </div>
              <div className="flex items-center gap-2">
                <MousePointer className="h-4 w-4" />
                <span>Drag nodes to reposition</span>
              </div>
              <div className="flex items-center gap-2">
                <ZoomIn className="h-4 w-4" />
                <span>Use controls to zoom</span>
              </div>
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4" />
                <span>Click nodes for details</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
