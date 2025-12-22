'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileText,
  Layers,
  Users,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Search,
  Database,
  Hash,
  Clock,
  FileType,
  Loader2,
  GripVertical,
  RefreshCw,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

interface Document {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  metadata?: Record<string, unknown>;
}

interface Chunk {
  id: string;
  document_id: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface Entity {
  id: string;
  name: string;
  entity_type: string;
  description?: string;
  source_chunk_ids?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  source_entity_name: string;
  target_entity_name: string;
  relation_type: string;
  description?: string;
  weight?: number;
  source_chunk_ids?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface DocumentDetails {
  document: Document;
  chunks: Chunk[];
  entities: Entity[];
  relations: Relation[];
  stats: {
    totalChunks: number;
    totalEntities: number;
    totalRelations: number;
    entityTypes: Record<string, number>;
    relationTypes: Record<string, number>;
    avgChunkLength: number;
  };
}

const ENTITY_TYPE_COLORS: Record<string, string> = {
  PERSON: 'bg-blue-500',
  ORGANIZATION: 'bg-purple-500',
  LOCATION: 'bg-green-500',
  EVENT: 'bg-yellow-500',
  CONCEPT: 'bg-pink-500',
  TECHNOLOGY: 'bg-cyan-500',
  PRODUCT: 'bg-orange-500',
  DATE: 'bg-red-500',
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString();
}

export function DataExplorer() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [details, setDetails] = useState<DocumentDetails | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch documents list
  const fetchDocuments = useCallback(async (showRefreshing = false) => {
    if (showRefreshing) setIsRefreshing(true);
    try {
      const response = await fetch('/api/documents?limit=100');
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents || []);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    } finally {
      setIsLoadingDocs(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Fetch document details when selected
  useEffect(() => {
    if (!selectedDocId) {
      setDetails(null);
      return;
    }

    const fetchDetails = async () => {
      setIsLoadingDetails(true);
      try {
        const response = await fetch(`/api/documents/${selectedDocId}/details`);
        if (response.ok) {
          const data = await response.json();
          setDetails(data);
        }
      } catch (err) {
        console.error('Error fetching document details:', err);
      } finally {
        setIsLoadingDetails(false);
      }
    };
    fetchDetails();
  }, [selectedDocId]);

  const toggleChunk = (chunkId: string) => {
    setExpandedChunks((prev) => {
      const next = new Set(prev);
      if (next.has(chunkId)) {
        next.delete(chunkId);
      } else {
        next.add(chunkId);
      }
      return next;
    });
  };

  const completedDocs = documents.filter((d) => d.status === 'completed' || d.status === 'processed');

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(288); // 288px = w-72
  const isResizing = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const startResizing = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
  }, []);

  const stopResizing = useCallback(() => {
    isResizing.current = false;
  }, []);

  const resize = useCallback((e: MouseEvent) => {
    if (isResizing.current && sidebarRef.current) {
      const newWidth = e.clientX - sidebarRef.current.getBoundingClientRect().left;
      if (newWidth >= 200 && newWidth <= 600) {
        setSidebarWidth(newWidth);
      }
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div className="flex h-full">
      {/* Document List Sidebar - Resizable */}
      <div
        ref={sidebarRef}
        style={{ width: sidebarWidth }}
        className="relative flex-shrink-0 border-r flex flex-col bg-muted/30"
      >
        <div className="p-3 border-b">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Database className="h-4 w-4" />
            <span>Indexed Documents</span>
            <Badge variant="secondary" className="ml-auto">
              {completedDocs.length}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => fetchDocuments(true)}
              disabled={isRefreshing}
              title="Refresh"
            >
              <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingDocs ? (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : completedDocs.length === 0 ? (
              <div className="text-center p-4 text-sm text-muted-foreground">
                No indexed documents yet
              </div>
            ) : (
              completedDocs.map((doc) => (
                <button
                  key={doc.id}
                  onClick={() => setSelectedDocId(doc.id)}
                  className={cn(
                    'w-full text-left p-2 rounded-lg transition-colors',
                    selectedDocId === doc.id
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span className="text-sm font-medium break-words">
                      {doc.file_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-[10px] px-1">
                      {doc.file_type}
                    </Badge>
                    <span>{formatBytes(doc.file_size)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Resize Handle */}
        <div
          onMouseDown={startResizing}
          className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/20 active:bg-primary/30 group flex items-center justify-center"
        >
          <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-6 w-6 text-muted-foreground" />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!selectedDocId ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Search className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">Select a document to explore</p>
              <p className="text-sm mt-1">
                View chunks, entities, and relationships
              </p>
            </div>
          </div>
        ) : isLoadingDetails ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : details ? (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col">
            <div className="border-b px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold truncate">
                  {details.document.file_name}
                </h2>
                <Badge>{details.document.status}</Badge>
              </div>
              <TabsList>
                <TabsTrigger value="overview">
                  <Database className="h-4 w-4 mr-1" />
                  Overview
                </TabsTrigger>
                <TabsTrigger value="chunks">
                  <Layers className="h-4 w-4 mr-1" />
                  Chunks ({details.stats.totalChunks})
                </TabsTrigger>
                <TabsTrigger value="entities">
                  <Users className="h-4 w-4 mr-1" />
                  Entities ({details.stats.totalEntities})
                </TabsTrigger>
                <TabsTrigger value="relations">
                  <GitBranch className="h-4 w-4 mr-1" />
                  Relations ({details.stats.totalRelations})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Overview Tab */}
            <TabsContent value="overview" className="flex-1 p-4 overflow-auto">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Layers className="h-4 w-4" />
                      Chunks
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {details.stats.totalChunks}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Avg {details.stats.avgChunkLength} chars
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Entities
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {details.stats.totalEntities}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Object.keys(details.stats.entityTypes).length} types
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <GitBranch className="h-4 w-4" />
                      Relations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {details.stats.totalRelations}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {Object.keys(details.stats.relationTypes).length} types
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <FileType className="h-4 w-4" />
                      File Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatBytes(details.document.file_size)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {details.document.file_type.toUpperCase()}
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Entity Types Breakdown */}
              {Object.keys(details.stats.entityTypes).length > 0 && (
                <Card className="mb-4">
                  <CardHeader>
                    <CardTitle className="text-sm">Entity Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(details.stats.entityTypes).map(
                        ([type, count]) => (
                          <Badge
                            key={type}
                            variant="secondary"
                            className="gap-1"
                          >
                            <span
                              className={cn(
                                'w-2 h-2 rounded-full',
                                ENTITY_TYPE_COLORS[type] || 'bg-gray-500'
                              )}
                            />
                            {type}: {count}
                          </Badge>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Relation Types Breakdown */}
              {Object.keys(details.stats.relationTypes).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Relation Types</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(details.stats.relationTypes).map(
                        ([type, count]) => (
                          <Badge key={type} variant="outline">
                            {type}: {count}
                          </Badge>
                        )
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Document Metadata */}
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-sm">Document Metadata</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <span className="text-muted-foreground">ID:</span>
                      <code className="ml-2 text-xs bg-muted px-1 rounded">
                        {details.document.id}
                      </code>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <span className="ml-2">
                        {formatDate(details.document.created_at)}
                      </span>
                    </div>
                  </div>
                  {details.document.metadata && (
                    <pre className="mt-3 p-2 bg-muted rounded text-xs overflow-auto">
                      {JSON.stringify(details.document.metadata, null, 2)}
                    </pre>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Chunks Tab */}
            <TabsContent value="chunks" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {details.chunks.map((chunk) => (
                    <Collapsible
                      key={chunk.id}
                      open={expandedChunks.has(chunk.id)}
                      onOpenChange={() => toggleChunk(chunk.id)}
                    >
                      <Card>
                        <CollapsibleTrigger asChild>
                          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors py-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {expandedChunks.has(chunk.id) ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                                <Badge variant="outline">
                                  <Hash className="h-3 w-3 mr-1" />
                                  Chunk {chunk.chunk_index}
                                </Badge>
                                <span className="text-sm text-muted-foreground">
                                  {chunk.content.length} chars
                                </span>
                              </div>
                              <code className="text-xs text-muted-foreground">
                                {chunk.id.slice(0, 8)}...
                              </code>
                            </div>
                            {!expandedChunks.has(chunk.id) && (
                              <p className="text-sm text-muted-foreground truncate mt-1 ml-7">
                                {chunk.content.slice(0, 150)}...
                              </p>
                            )}
                          </CardHeader>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <CardContent className="pt-0">
                            <div className="bg-muted/50 p-3 rounded-lg text-sm whitespace-pre-wrap font-mono">
                              {chunk.content}
                            </div>
                            {chunk.metadata && Object.keys(chunk.metadata).length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-muted-foreground mb-1">
                                  Metadata:
                                </p>
                                <pre className="p-2 bg-muted rounded text-xs overflow-auto">
                                  {JSON.stringify(chunk.metadata, null, 2)}
                                </pre>
                              </div>
                            )}
                          </CardContent>
                        </CollapsibleContent>
                      </Card>
                    </Collapsible>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Entities Tab */}
            <TabsContent value="entities" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4">
                  {Object.entries(details.stats.entityTypes).map(
                    ([type]) => {
                      const typeEntities = details.entities.filter(
                        (e) => e.entity_type === type
                      );
                      return (
                        <div key={type} className="mb-6">
                          <div className="flex items-center gap-2 mb-3">
                            <span
                              className={cn(
                                'w-3 h-3 rounded-full',
                                ENTITY_TYPE_COLORS[type] || 'bg-gray-500'
                              )}
                            />
                            <h3 className="font-semibold">{type}</h3>
                            <Badge variant="secondary">
                              {typeEntities.length}
                            </Badge>
                          </div>
                          <div className="grid gap-2 md:grid-cols-2">
                            {typeEntities.map((entity) => (
                              <Card key={entity.id} className="p-3">
                                <div className="flex items-start justify-between">
                                  <div>
                                    <p className="font-medium">{entity.name}</p>
                                    {entity.description && (
                                      <p className="text-sm text-muted-foreground mt-1">
                                        {entity.description}
                                      </p>
                                    )}
                                  </div>
                                  <code className="text-xs text-muted-foreground">
                                    {entity.id.slice(0, 8)}
                                  </code>
                                </div>
                                {entity.source_chunk_ids &&
                                  entity.source_chunk_ids.length > 0 && (
                                    <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Layers className="h-3 w-3" />
                                      <span>
                                        Found in {entity.source_chunk_ids.length}{' '}
                                        chunk(s)
                                      </span>
                                    </div>
                                  )}
                              </Card>
                            ))}
                          </div>
                        </div>
                      );
                    }
                  )}
                  {details.entities.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No entities extracted from this document</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* Relations Tab */}
            <TabsContent value="relations" className="flex-1 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {details.relations.map((relation) => (
                    <Card key={relation.id} className="p-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="secondary">
                          {relation.source_entity_name}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm">
                          <span className="text-muted-foreground">—</span>
                          <Badge variant="outline">
                            {relation.relation_type}
                          </Badge>
                          <span className="text-muted-foreground">→</span>
                        </div>
                        <Badge variant="secondary">
                          {relation.target_entity_name}
                        </Badge>
                        {relation.weight && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            weight: {relation.weight.toFixed(2)}
                          </span>
                        )}
                      </div>
                      {relation.description && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {relation.description}
                        </p>
                      )}
                    </Card>
                  ))}
                  {details.relations.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <GitBranch className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>No relations extracted from this document</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        ) : null}
      </div>
    </div>
  );
}
