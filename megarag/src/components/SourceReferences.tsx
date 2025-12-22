'use client';

import { useState } from 'react';
import {
  FileText,
  Image,
  Video,
  Volume2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SourceReferencesProps, ChunkType } from '@/types';

/**
 * Get icon for chunk type
 */
function getChunkTypeIcon(chunkType?: ChunkType) {
  switch (chunkType) {
    case 'image':
      return <Image className="h-4 w-4" />;
    case 'video_segment':
      return <Video className="h-4 w-4" />;
    case 'audio':
      return <Volume2 className="h-4 w-4" />;
    case 'table':
      return <FileText className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

/**
 * Get label for chunk type
 */
function getChunkTypeLabel(chunkType?: ChunkType): string {
  switch (chunkType) {
    case 'image':
      return 'Image';
    case 'video_segment':
      return 'Video';
    case 'audio':
      return 'Audio';
    case 'table':
      return 'Table';
    case 'equation':
      return 'Equation';
    default:
      return 'Text';
  }
}

/**
 * Get color class for similarity score
 */
function getSimilarityColor(similarity: number): string {
  if (similarity >= 0.8) return 'text-green-600 dark:text-green-400';
  if (similarity >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-orange-600 dark:text-orange-400';
}

/**
 * SourceReferences component - displays detailed source citations
 */
export function SourceReferences({ sources, onSourceClick }: SourceReferencesProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());

  if (!sources || sources.length === 0) {
    return null;
  }

  const toggleSource = (sourceId: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Sources ({sources.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source, index) => {
          const isExpanded = expandedSources.has(source.id);
          const similarityPercent = Math.round(source.similarity * 100);

          return (
            <Collapsible
              key={source.id}
              open={isExpanded}
              onOpenChange={() => toggleSource(source.id)}
            >
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors text-left">
                    {/* Source number */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </div>

                    {/* Source info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {getChunkTypeIcon(source.chunk_type)}
                        <span className="font-medium truncate">
                          {source.document_name || 'Unknown Document'}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {getChunkTypeLabel(source.chunk_type)}
                        </Badge>
                      </div>
                      {source.document_type && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          .{source.document_type}
                        </div>
                      )}
                    </div>

                    {/* Similarity score */}
                    <div className={cn('text-sm font-medium', getSimilarityColor(source.similarity))}>
                      {similarityPercent}%
                    </div>

                    {/* Expand indicator */}
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="px-3 pb-3 pt-0">
                    <div className="bg-muted/30 rounded p-3 text-sm">
                      <p className="whitespace-pre-wrap break-words text-muted-foreground">
                        {source.content}
                      </p>
                    </div>

                    {onSourceClick && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={() => onSourceClick(source.document_id)}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        View Document
                      </Button>
                    )}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
      </CardContent>
    </Card>
  );
}
