'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Trash2,
  RefreshCw,
  Search,
  Loader2,
  Filter,
  Building,
  MapPin,
  Calendar,
  Lightbulb,
  Cpu,
  Package,
  User,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

interface Entity {
  id: string;
  name: string;
  entity_type: string;
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

const entityTypeIcons: Record<string, React.ReactNode> = {
  PERSON: <User className="h-4 w-4" />,
  ORGANIZATION: <Building className="h-4 w-4" />,
  LOCATION: <MapPin className="h-4 w-4" />,
  DATE: <Calendar className="h-4 w-4" />,
  EVENT: <Calendar className="h-4 w-4" />,
  CONCEPT: <Lightbulb className="h-4 w-4" />,
  TECHNOLOGY: <Cpu className="h-4 w-4" />,
  PRODUCT: <Package className="h-4 w-4" />,
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

export default function AdminEntitiesPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntities = useCallback(async () => {
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

      const res = await fetch(`/api/admin/entities?${params}`);
      const data = await res.json();

      if (data.success) {
        setEntities(data.data.entities);
        setAvailableTypes(data.data.available_types);
        setPagination(data.data.pagination);
      }
    } catch (error) {
      console.error('Failed to fetch entities:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, typeFilter, search]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(entities.map((e) => e.id)));
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
      const res = await fetch(`/api/admin/entities`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entity_ids: Array.from(selectedIds) }),
      });

      if (res.ok) {
        setEntities((prev) => prev.filter((e) => !selectedIds.has(e.id)));
        setSelectedIds(new Set());
      }
    } catch (error) {
      console.error('Failed to delete:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    const color = entityTypeColors[type] || 'bg-gray-500';
    const icon = entityTypeIcons[type] || <Users className="h-4 w-4" />;

    return (
      <Badge variant="default" className={`${color} flex items-center gap-1`}>
        {icon}
        {type}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Entities</h1>
          <p className="text-muted-foreground">
            View and manage extracted entities from your documents
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
                  <AlertDialogTitle>Delete Entities</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete {selectedIds.size} entities? This action cannot
                    be undone.
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
          <Button onClick={fetchEntities} variant="outline" size="sm">
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
                  placeholder="Search entities..."
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
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Entities Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Entities</CardTitle>
          <CardDescription>{pagination?.total || 0} entities total</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : entities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Users className="h-12 w-12 mb-2" />
              <p>No entities found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedIds.size === entities.length && entities.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Sources</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entities.map((entity) => (
                  <TableRow key={entity.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(entity.id)}
                        onCheckedChange={(checked) => handleSelect(entity.id, checked as boolean)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{entity.name}</TableCell>
                    <TableCell>{getTypeBadge(entity.entity_type)}</TableCell>
                    <TableCell className="max-w-[300px] truncate text-muted-foreground">
                      {entity.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{entity.source_chunk_ids?.length || 0} chunks</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(entity.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
