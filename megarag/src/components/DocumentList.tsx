'use client';

import { useState, useMemo, useRef } from 'react';
import { FileText, FileImage, FileVideo, FileAudio, File, Trash2, Clock, CheckCircle, AlertCircle, Loader2, Pencil, FileSpreadsheet, Presentation, BookOpen, Search, X, Filter, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { Document } from '@/types';

interface DocumentListProps {
  documents: Document[];
  onDelete?: (documentId: string) => void;
  onDeleteMultiple?: (documentIds: string[]) => void;
  onRename?: (documentId: string, newName: string) => void;
  isLoading?: boolean;
}

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();
  if (type.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(type)) return FileImage;
  if (type.includes('video') || ['mp4', 'webm', 'mov', 'avi'].includes(type)) return FileVideo;
  if (type.includes('audio') || ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(type)) return FileAudio;
  if (type === 'pdf') return BookOpen;
  if (type === 'xlsx' || type === 'xls') return FileSpreadsheet;
  if (type === 'pptx' || type === 'ppt') return Presentation;
  if (['docx', 'doc', 'txt', 'md'].includes(type)) return FileText;
  return File;
}

function getStatusIcon(status: Document['status']) {
  switch (status) {
    case 'pending':
      return <Clock className="h-4 w-4 text-muted-foreground" />;
    case 'processing':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'processed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusText(status: Document['status']) {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'processing':
      return 'Processing...';
    case 'processed':
      return 'Ready';
    case 'failed':
      return 'Failed';
    default:
      return status;
  }
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown size';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type StatusFilter = 'all' | 'processed' | 'processing' | 'pending' | 'failed';

export function DocumentList({ documents, onDelete, onDeleteMultiple, onRename, isLoading }: DocumentListProps) {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [documentToDelete, setDocumentToDelete] = useState<Document | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);

  // Rename state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [documentToRename, setDocumentToRename] = useState<Document | null>(null);
  const [newFileName, setNewFileName] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);

  // Pending delete with undo state
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const deleteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const UNDO_DELAY = 5000; // 5 seconds

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  // Filter documents based on search, status, and pending delete
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      // Exclude pending delete documents
      if (pendingDeleteIds.has(doc.id)) return false;

      // Search filter
      const matchesSearch = searchQuery === '' ||
        doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());

      // Status filter
      const matchesStatus = statusFilter === 'all' ||
        doc.status === statusFilter ||
        (statusFilter === 'processing' && (doc.status === 'processing' || doc.status === 'pending'));

      return matchesSearch && matchesStatus;
    });
  }, [documents, searchQuery, statusFilter, pendingDeleteIds]);

  // Count documents by status
  const statusCounts = useMemo(() => ({
    all: documents.length,
    processed: documents.filter(d => d.status === 'processed').length,
    processing: documents.filter(d => d.status === 'processing' || d.status === 'pending').length,
    failed: documents.filter(d => d.status === 'failed').length,
  }), [documents]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredDocuments.map(d => d.id)));
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
  };

  const handleDeleteClick = (doc: Document) => {
    setDocumentToDelete(doc);
    setDeleteDialogOpen(true);
  };

  const handleRenameClick = (doc: Document) => {
    setDocumentToRename(doc);
    setNewFileName(doc.file_name);
    setRenameDialogOpen(true);
  };

  const handleConfirmRename = async () => {
    if (!documentToRename || !newFileName.trim()) return;

    setIsRenaming(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: documentToRename.id,
          file_name: newFileName.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to rename document');
      }

      onRename?.(documentToRename.id, newFileName.trim());
    } catch (error) {
      console.error('Error renaming document:', error);
    } finally {
      setIsRenaming(false);
      setRenameDialogOpen(false);
      setDocumentToRename(null);
      setNewFileName('');
    }
  };

  // Perform actual deletion after undo period
  const executeDelete = async (idsToDelete: string[]) => {
    try {
      const deletePromises = idsToDelete.map(id =>
        fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      );
      await Promise.all(deletePromises);

      // Notify parent
      if (idsToDelete.length === 1) {
        onDelete?.(idsToDelete[0]);
      } else if (onDeleteMultiple) {
        onDeleteMultiple(idsToDelete);
      } else {
        idsToDelete.forEach(id => onDelete?.(id));
      }
    } catch (error) {
      console.error('Error deleting documents:', error);
      toast.error('Failed to delete some documents');
    }
  };

  // Undo deletion
  const undoDelete = (idsToRestore: string[]) => {
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      idsToRestore.forEach(id => next.delete(id));
      return next;
    });
    toast.success(`Restored ${idsToRestore.length === 1 ? 'document' : `${idsToRestore.length} documents`}`);
  };

  // Schedule deletion with undo option
  const scheduleDelete = (idsToDelete: string[]) => {
    // Add to pending delete
    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      idsToDelete.forEach(id => next.add(id));
      return next;
    });

    // Clear selection
    setSelectedIds(new Set());

    // Show toast with undo button
    const toastId = toast(
      `${idsToDelete.length === 1 ? 'Document' : `${idsToDelete.length} documents`} will be deleted`,
      {
        duration: UNDO_DELAY,
        action: {
          label: 'Undo',
          onClick: () => undoDelete(idsToDelete),
        },
        icon: <Undo2 className="h-4 w-4" />,
      }
    );

    // Schedule actual deletion
    deleteTimerRef.current = setTimeout(async () => {
      await executeDelete(idsToDelete);
      // Remove from pending
      setPendingDeleteIds(prev => {
        const next = new Set(prev);
        idsToDelete.forEach(id => next.delete(id));
        return next;
      });
      toast.dismiss(toastId);
    }, UNDO_DELAY);
  };

  const handleConfirmDelete = () => {
    if (!documentToDelete) return;
    setDeleteDialogOpen(false);
    scheduleDelete([documentToDelete.id]);
    setDocumentToDelete(null);
  };

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    setBulkDeleteDialogOpen(false);
    scheduleDelete(Array.from(selectedIds));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12">
        <File className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-1">No documents yet</h3>
        <p className="text-sm text-muted-foreground">
          Upload your first document to get started
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Search and Filter Bar */}
      {documents.length > 0 && (
        <div className="space-y-3 mb-4">
          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-9"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Status filters */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={statusFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('all')}
              className="h-7"
            >
              All
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {statusCounts.all}
              </Badge>
            </Button>
            <Button
              variant={statusFilter === 'processed' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('processed')}
              className="h-7"
            >
              <CheckCircle className="h-3 w-3 mr-1 text-green-500" />
              Ready
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {statusCounts.processed}
              </Badge>
            </Button>
            <Button
              variant={statusFilter === 'processing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter('processing')}
              className="h-7"
            >
              <Loader2 className="h-3 w-3 mr-1 text-blue-500" />
              Processing
              <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                {statusCounts.processing}
              </Badge>
            </Button>
            {statusCounts.failed > 0 && (
              <Button
                variant={statusFilter === 'failed' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('failed')}
                className="h-7"
              >
                <AlertCircle className="h-3 w-3 mr-1 text-red-500" />
                Failed
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5">
                  {statusCounts.failed}
                </Badge>
              </Button>
            )}
            {(searchQuery || statusFilter !== 'all') && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Selection toolbar */}
      {filteredDocuments.length > 0 && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === filteredDocuments.length && filteredDocuments.length > 0}
              onCheckedChange={selectAll}
              aria-label="Select all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : `Select all (${filteredDocuments.length})`}
            </span>
          </div>
          {selectedIds.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setBulkDeleteDialogOpen(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'}
            </Button>
          )}
        </div>
      )}

      {/* No results message */}
      {filteredDocuments.length === 0 && documents.length > 0 && (
        <div className="text-center py-8">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No documents found</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Try adjusting your search or filters
          </p>
          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      )}

      <div className="space-y-2">
        {filteredDocuments.map(doc => {
          const FileIcon = getFileIcon(doc.file_type);
          const isSelected = selectedIds.has(doc.id);

          return (
            <Card
              key={doc.id}
              className={`p-4 transition-colors ${isSelected ? 'ring-2 ring-primary bg-primary/5' : ''}`}
            >
              <div className="flex items-center gap-4">
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleSelect(doc.id)}
                  aria-label={`Select ${doc.file_name}`}
                />

                <FileIcon className="h-10 w-10 text-muted-foreground flex-shrink-0" />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <span className="text-xs text-muted-foreground uppercase px-2 py-0.5 bg-muted rounded">
                      {doc.file_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{formatDate(doc.created_at)}</span>
                    {doc.chunks_count > 0 && (
                      <span>{doc.chunks_count} chunks</span>
                    )}
                  </div>

                  {doc.status === 'failed' && doc.error_message && (
                    <p className="text-xs text-destructive mt-1 truncate">
                      {doc.error_message}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="flex items-center gap-1.5 mr-2">
                    {getStatusIcon(doc.status)}
                    <span className="text-sm">{getStatusText(doc.status)}</span>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => handleRenameClick(doc)}
                    title="Rename"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteClick(doc)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Rename dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Document</DialogTitle>
            <DialogDescription>
              Enter a new name for this document.
            </DialogDescription>
          </DialogHeader>
          <Input
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            placeholder="Document name"
            onKeyDown={(e) => e.key === 'Enter' && handleConfirmRename()}
            autoFocus
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRenameDialogOpen(false)}
              disabled={isRenaming}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmRename}
              disabled={isRenaming || !newFileName.trim()}
            >
              {isRenaming ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Single delete confirmation dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{documentToDelete?.file_name}&quot;? You&apos;ll have 5 seconds to undo this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleConfirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk delete confirmation dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {selectedIds.size} Documents</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedIds.size} {selectedIds.size === 1 ? 'document' : 'documents'}? You&apos;ll have 5 seconds to undo this action.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBulkDelete}>
              Delete {selectedIds.size} {selectedIds.size === 1 ? 'file' : 'files'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentList;
