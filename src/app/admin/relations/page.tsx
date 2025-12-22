'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  GitBranch,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  Filter,
  ArrowRight,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';

interface Relation {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  source_entity_name: string;
  target_entity_name: string;
  source_entity_type: string;
  target_entity_type: string;
  relation_type: string;
  description: string | null;
  source_chunk_ids: string[];
  created_at: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

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

const relationTypeColors: Record<string, { bg: string; text: string }> = {
  WORKS_AT: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  LOCATED_IN: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  PART_OF: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
  RELATED_TO: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' },
  OWNS: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300' },
  CREATED: { bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-700 dark:text-pink-300' },
  FOUNDED: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300' },
  LEADS: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-300' },
  MANAGES: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
  ACQUIRED: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
  USES: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-700 dark:text-teal-300' },
  CONTAINS: { bg: 'bg-violet-100 dark:bg-violet-900/30', text: 'text-violet-700 dark:text-violet-300' },
};

export default function AdminRelationsPage() {
  const [relations, setRelations] = useState<Relation[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchRelations = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '25',
      });
      if (typeFilter !== 'all') {
        params.set('type', typeFilter);
      }
      if (search) {
        params.set('search', search);
      }

      const res = await fetch(`/api/admin/relations?${params}`);
      const data = await res.json();

      if (data.success) {
        setRelations(data.data.relations);
        setAvailableTypes(data.data.available_types);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch relations:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, typeFilter, search]);

  useEffect(() => {
    fetchRelations();
  }, [fetchRelations]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(relations.map((r) => r.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelect = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds);
    if (checked) {
      newSet.add(id);
    } else {
      newSet.delete(id);
    }
    setSelectedIds(newSet);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/relations`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ relation_ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setRelations((prev) => prev.filter((r) => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getEntityBadge = (name: string, type: string) => {
    const color = entityTypeColors[type] || 'bg-gray-500';
    return (
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color}`} />
        <span className="font-medium">{name}</span>
        <span className="text-xs text-muted-foreground">({type})</span>
      </div>
    );
  };

  const getRelationBadge = (type: string) => {
    const colors = relationTypeColors[type] || { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-700 dark:text-gray-300' };
    return (
      <Badge variant="outline" className={`${colors.bg} ${colors.text} border-0 font-medium`}>
        {type.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Relations</h1>
          <p className="text-muted-foreground">
            View and manage relationships between entities
          </p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={isDeleting}>
                  {isDeleting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete ({selectedIds.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Relations</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedIds.size} relations? This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleBulkDelete}
                    className="bg-destructive text-destructive-foreground"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button onClick={fetchRelations} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search entities or descriptions..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {availableTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Relations List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Relations</CardTitle>
              <CardDescription>{pagination?.total || 0} relations total</CardDescription>
            </div>
            {relations.length > 0 && (
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedIds.size === relations.length && relations.length > 0}
                  onCheckedChange={handleSelectAll}
                />
                <span className="text-sm text-muted-foreground">Select all</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : relations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <GitBranch className="h-12 w-12 mb-2" />
              <p>No relations found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {relations.map((relation) => (
                <div
                  key={relation.id}
                  className={`border rounded-lg p-4 transition-all hover:shadow-md ${
                    selectedIds.has(relation.id) ? 'border-primary bg-primary/5' : ''
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <Checkbox
                      checked={selectedIds.has(relation.id)}
                      onCheckedChange={(checked) =>
                        handleSelect(relation.id, checked as boolean)
                      }
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      {/* Relation visualization */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {getEntityBadge(relation.source_entity_name, relation.source_entity_type)}
                        <div className="flex items-center gap-2">
                          <div className="h-px w-8 bg-border" />
                          {getRelationBadge(relation.relation_type)}
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                          <div className="h-px w-8 bg-border" />
                        </div>
                        {getEntityBadge(relation.target_entity_name, relation.target_entity_type)}
                      </div>

                      {/* Description */}
                      {relation.description && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                          {relation.description}
                        </p>
                      )}

                      {/* Expandable details */}
                      {expandedId === relation.id && (
                        <div className="mt-3 pt-3 border-t space-y-2 text-sm">
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Created:</span>
                            <span>{new Date(relation.created_at).toLocaleString()}</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="text-muted-foreground">Source chunks:</span>
                            <span>{relation.source_chunk_ids?.length || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === relation.id ? null : relation.id)}
                    >
                      {expandedId === relation.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination && pagination.total_pages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {pagination.page} of {pagination.total_pages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={currentPage === pagination.total_pages}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
