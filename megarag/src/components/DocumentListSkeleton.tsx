'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

/**
 * Skeleton loading state for document list
 */
export function DocumentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              {/* Icon skeleton */}
              <Skeleton className="h-10 w-10 rounded" />

              {/* Content skeleton */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-[200px]" />
                <Skeleton className="h-3 w-[150px]" />
              </div>

              {/* Status skeleton */}
              <Skeleton className="h-6 w-20 rounded-full" />

              {/* Actions skeleton */}
              <Skeleton className="h-8 w-8 rounded" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton loading state for statistics cards
 */
export function StatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <Skeleton className="h-4 w-[100px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-[60px]" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * Skeleton loading state for chat messages
 */
export function ChatMessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <div className={`flex gap-3 p-4 ${isUser ? 'bg-muted/50' : ''}`}>
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-[100px]" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-[80%]" />
        {!isUser && (
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Skeleton className="h-6 w-24 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        )}
      </div>
    </div>
  );
}
