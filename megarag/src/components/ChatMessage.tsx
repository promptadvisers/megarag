'use client';

import { useState } from 'react';
import { User, Bot, FileText, Image, Video, Volume2, Copy, Check } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { ChatMessageProps, ChunkType } from '@/types';

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore errors
    }
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      className={cn('h-7 w-7', className)}
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-500" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </Button>
  );
}

/**
 * Get icon for chunk type
 */
function getChunkTypeIcon(chunkType?: ChunkType) {
  switch (chunkType) {
    case 'image':
      return <Image className="h-3 w-3" />;
    case 'video_segment':
      return <Video className="h-3 w-3" />;
    case 'audio':
      return <Volume2 className="h-3 w-3" />;
    default:
      return <FileText className="h-3 w-3" />;
  }
}

/**
 * ChatMessage component - displays a single chat message
 */
export function ChatMessage({ role, content, sources, timestamp }: ChatMessageProps) {
  const isUser = role === 'user';

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg group',
        isUser ? 'bg-muted/50' : 'bg-background'
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center',
          isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Message content */}
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">
              {isUser ? 'You' : 'Assistant'}
            </span>
            {timestamp && (
              <span className="text-xs text-muted-foreground">
                {timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <CopyButton text={content} className="opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        {/* Message text */}
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-muted prose-pre:border prose-code:before:content-none prose-code:after:content-none">
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Style code blocks
                pre: ({ children }) => (
                  <pre className="overflow-x-auto rounded-lg p-4 text-sm">{children}</pre>
                ),
                code: ({ className, children, ...props }) => {
                  const isInline = !className;
                  return isInline ? (
                    <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className={className} {...props}>{children}</code>
                  );
                },
                // Style lists
                ul: ({ children }) => (
                  <ul className="list-disc pl-4 space-y-1">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="list-decimal pl-4 space-y-1">{children}</ol>
                ),
                // Style tables
                table: ({ children }) => (
                  <div className="overflow-x-auto my-4">
                    <table className="min-w-full border-collapse border border-border">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => (
                  <th className="border border-border bg-muted px-3 py-2 text-left font-semibold">
                    {children}
                  </th>
                ),
                td: ({ children }) => (
                  <td className="border border-border px-3 py-2">{children}</td>
                ),
                // Style blockquotes
                blockquote: ({ children }) => (
                  <blockquote className="border-l-4 border-primary/50 pl-4 italic text-muted-foreground">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>

        {/* Inline source references for assistant messages */}
        {!isUser && sources && sources.length > 0 && (
          <div className="mt-3 pt-3 border-t">
            <div className="text-xs font-medium text-muted-foreground mb-2">
              Sources ({sources.length})
            </div>
            <div className="flex flex-wrap gap-2">
              {sources.slice(0, 5).map((source, index) => (
                <div
                  key={source.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs group/source"
                  title={source.content}
                >
                  {getChunkTypeIcon(source.chunk_type)}
                  <span className="font-medium">[{index + 1}]</span>
                  <span className="truncate max-w-[150px]">
                    {source.document_name || 'Unknown'}
                  </span>
                  <span className="text-muted-foreground">
                    ({Math.round(source.similarity * 100)}%)
                  </span>
                  <CopyButton
                    text={source.content}
                    className="h-5 w-5 ml-1 opacity-0 group-hover/source:opacity-100"
                  />
                </div>
              ))}
              {sources.length > 5 && (
                <span className="text-xs text-muted-foreground">
                  +{sources.length - 5} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
