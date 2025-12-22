'use client';

import { useState } from 'react';
import { FileText, FileImage, FileVideo, FileAudio, File, Trash2, Clock, CheckCircle, AlertCircle, Loader2, Pencil, FileSpreadsheet, Presentation, BookOpen, Square, CheckSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
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
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
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

  const handleConfirmDelete = async () => {
    if (!documentToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/documents?id=${documentToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      onDelete?.(documentToDelete.id);
    } catch (error) {
      console.error('Error deleting document:', error);
    } finally {
      setIsDeleting(false);
      setDeleteDialogOpen(false);
      setDocumentToDelete(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);
    try {
      // Delete all selected documents
      const deletePromises = Array.from(selectedIds).map(id =>
        fetch(`/api/documents?id=${id}`, { method: 'DELETE' })
      );

      await Promise.all(deletePromises);

      // Notify parent of all deletions
      if (onDeleteMultiple) {
        onDeleteMultiple(Array.from(selectedIds));
      } else {
        // Fallback: call onDelete for each
        selectedIds.forEach(id => onDelete?.(id));
      }

      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error deleting documents:', error);
    } finally {
      setIsDeleting(false);
      setBulkDeleteDialogOpen(false);
    }
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
      {/* Selection toolbar */}
      {documents.length > 0 && (
        <div className="flex items-center justify-between mb-3 pb-3 border-b">
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.size === documents.length}
              onCheckedChange={selectAll}
              aria-label="Select all"
            />
            <span className="text-sm text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected`
                : 'Select all'}
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

      <div className="space-y-2">
        {documents.map(doc => {
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
              Are you sure you want to delete &quot;{documentToDelete?.file_name}&quot;? This will also remove all associated chunks and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
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
              Are you sure you want to delete {selectedIds.size} {selectedIds.size === 1 ? 'document' : 'documents'}? This will also remove all associated chunks and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'file' : 'files'}`
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default DocumentList;
