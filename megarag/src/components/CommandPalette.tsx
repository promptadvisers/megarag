'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  FileText,
  Users,
  Home,
  MessageSquare,
  Database,
  Settings,
  Key,
  GitBranch,
  Loader2,
  Command,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

interface SearchResult {
  documents: Array<{
    id: string;
    file_name: string;
    file_type: string;
    status: string;
  }>;
  entities: Array<{
    id: string;
    name: string;
    entity_type: string;
    description?: string;
  }>;
  navigation: Array<{
    id: string;
    name: string;
    path: string;
    icon: string;
  }>;
}

const iconMap: Record<string, React.ReactNode> = {
  home: <Home className="h-4 w-4" />,
  message: <MessageSquare className="h-4 w-4" />,
  database: <Database className="h-4 w-4" />,
  settings: <Settings className="h-4 w-4" />,
  cog: <Settings className="h-4 w-4" />,
  key: <Key className="h-4 w-4" />,
  'git-branch': <GitBranch className="h-4 w-4" />,
};

const entityTypeColors: Record<string, string> = {
  PERSON: 'bg-blue-500',
  ORGANIZATION: 'bg-purple-500',
  LOCATION: 'bg-green-500',
  DATE: 'bg-orange-500',
  EVENT: 'bg-pink-500',
  CONCEPT: 'bg-yellow-500',
  TECHNOLOGY: 'bg-cyan-500',
  PRODUCT: 'bg-red-500',
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();

  // Keyboard shortcut to open (Cmd+K or Ctrl+K)
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search debounce
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (data.success) {
          setResults(data.data);
          setSelectedIndex(0);
        }
      } catch {
        // Ignore errors
      } finally {
        setIsLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Build flat list of all results for keyboard navigation
  const allItems = results
    ? [
        ...results.navigation.map((n) => ({ type: 'nav' as const, item: n })),
        ...results.documents.map((d) => ({ type: 'doc' as const, item: d })),
        ...results.entities.map((e) => ({ type: 'entity' as const, item: e })),
      ]
    : [];

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, allItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = allItems[selectedIndex];
        if (selected) {
          handleSelect(selected);
        }
      }
    },
    [allItems, selectedIndex]
  );

  const handleSelect = (item: (typeof allItems)[0]) => {
    setOpen(false);
    setQuery('');
    setResults(null);

    if (item.type === 'nav') {
      router.push(item.item.path);
    } else if (item.type === 'doc') {
      router.push(`/dashboard/explorer?doc=${item.item.id}`);
    } else if (item.type === 'entity') {
      router.push(`/dashboard/explorer?entity=${item.item.id}`);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setQuery('');
      setResults(null);
      setSelectedIndex(0);
    }
  };

  return (
    <>
      {/* Trigger button - can be placed in header */}
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground bg-muted/50 hover:bg-muted rounded-md border transition-colors"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-xs">
          <Command className="h-3 w-3" />K
        </kbd>
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="overflow-hidden p-0 max-w-lg">
          <VisuallyHidden>
            <DialogTitle>Search</DialogTitle>
          </VisuallyHidden>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              placeholder="Search documents, entities, or navigate..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex h-12 w-full rounded-md bg-transparent py-3 text-sm outline-none border-0 focus-visible:ring-0 placeholder:text-muted-foreground"
              autoFocus
            />
            {isLoading && <Loader2 className="h-4 w-4 animate-spin opacity-50" />}
          </div>

          <ScrollArea className="max-h-[300px]">
            {!query && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Type to search documents, entities, or navigate...
              </div>
            )}

            {query && !results && !isLoading && (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No results found
              </div>
            )}

            {results && (
              <div className="p-2">
                {/* Navigation Results */}
                {results.navigation.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Navigation
                    </div>
                    {results.navigation.map((nav, idx) => {
                      const globalIdx = idx;
                      return (
                        <button
                          key={nav.id}
                          onClick={() => handleSelect({ type: 'nav', item: nav })}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm ${
                            selectedIndex === globalIdx
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          {iconMap[nav.icon] || <Home className="h-4 w-4" />}
                          <span>{nav.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Document Results */}
                {results.documents.length > 0 && (
                  <div className="mb-2">
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Documents
                    </div>
                    {results.documents.map((doc, idx) => {
                      const globalIdx = results.navigation.length + idx;
                      return (
                        <button
                          key={doc.id}
                          onClick={() => handleSelect({ type: 'doc', item: doc })}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm ${
                            selectedIndex === globalIdx
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate text-left">{doc.file_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {doc.file_type}
                          </Badge>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Entity Results */}
                {results.entities.length > 0 && (
                  <div>
                    <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                      Entities
                    </div>
                    {results.entities.map((entity, idx) => {
                      const globalIdx =
                        results.navigation.length + results.documents.length + idx;
                      const color = entityTypeColors[entity.entity_type] || 'bg-gray-500';
                      return (
                        <button
                          key={entity.id}
                          onClick={() => handleSelect({ type: 'entity', item: entity })}
                          className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm ${
                            selectedIndex === globalIdx
                              ? 'bg-accent text-accent-foreground'
                              : 'hover:bg-muted'
                          }`}
                        >
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span className="flex-1 truncate text-left">{entity.name}</span>
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${color}`} />
                            <span className="text-xs text-muted-foreground">
                              {entity.entity_type}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {results.navigation.length === 0 &&
                  results.documents.length === 0 &&
                  results.entities.length === 0 && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No results found for "{query}"
                    </div>
                  )}
              </div>
            )}
          </ScrollArea>

          <div className="border-t px-3 py-2 text-xs text-muted-foreground flex justify-between">
            <span>
              <kbd className="rounded border px-1">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded border px-1">↵</kbd> Select
            </span>
            <span>
              <kbd className="rounded border px-1">esc</kbd> Close
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CommandPalette;
