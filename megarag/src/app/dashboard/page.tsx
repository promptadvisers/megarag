'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { MessageSquare, RefreshCw, Microscope, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DocumentUploader, DocumentList, ThemeToggle, DocumentListSkeleton, Logo, CommandPalette } from '@/components';
import { toast } from 'sonner';
import type { Document } from '@/types';

export default function DashboardPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDocuments = useCallback(async (showToast = false) => {
    if (showToast) setIsRefreshing(true);
    try {
      const response = await fetch('/api/documents');
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data.documents);
      if (showToast) toast.success('Refreshed');
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  // Auto-poll when there are pending/processing documents
  useEffect(() => {
    const hasPendingDocs = documents.some(
      (d) => d.status === 'pending' || d.status === 'processing'
    );

    if (hasPendingDocs) {
      const interval = setInterval(() => {
        fetchDocuments();
      }, 3000); // Poll every 3 seconds

      return () => clearInterval(interval);
    }
  }, [documents, fetchDocuments]);

  const handleUploadComplete = useCallback((documentId: string) => {
    toast.success('File uploaded successfully');
    // Refresh the document list
    fetchDocuments();
  }, [fetchDocuments]);

  const handleUploadError = useCallback((error: Error) => {
    toast.error(error.message || 'Upload failed');
  }, []);

  const handleDocumentDelete = useCallback((documentId: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    toast.success('Document deleted');
  }, []);

  const handleDocumentDeleteMultiple = useCallback((documentIds: string[]) => {
    setDocuments(prev => prev.filter(doc => !documentIds.includes(doc.id)));
    toast.success(`${documentIds.length} documents deleted`);
  }, []);

  const handleDocumentRename = useCallback((documentId: string, newName: string) => {
    setDocuments(prev => prev.map(doc =>
      doc.id === documentId ? { ...doc, file_name: newName } : doc
    ));
    toast.success('Document renamed');
  }, []);

  // Calculate stats
  const stats = {
    total: documents.length,
    processed: documents.filter(d => d.status === 'processed').length,
    processing: documents.filter(d => d.status === 'processing').length,
    pending: documents.filter(d => d.status === 'pending').length,
    failed: documents.filter(d => d.status === 'failed').length,
  };

  return (
    <div className="min-h-screen bg-background animated-gradient">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Logo size="sm" showText={false} />
              <div>
                <h1 className="text-2xl font-bold">MegaRAG</h1>
                <p className="text-sm text-muted-foreground">
                  Multi-Modal RAG System
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CommandPalette />
              <ThemeToggle />
              <Button variant="outline" size="sm" onClick={() => fetchDocuments(true)} disabled={isRefreshing}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Link href="/dashboard/explorer">
                <Button variant="outline" size="sm">
                  <Microscope className="h-4 w-4 mr-2" />
                  Explorer
                </Button>
              </Link>
              <Link href="/dashboard/chat">
                <Button size="sm">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat
                </Button>
              </Link>
              <Link href="/admin">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Upload */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="hover-lift animate-fade-in">
              <CardHeader>
                <CardTitle>Upload Documents</CardTitle>
                <CardDescription>
                  Drag and drop files or click to browse
                </CardDescription>
              </CardHeader>
              <CardContent>
                <DocumentUploader
                  onUploadComplete={handleUploadComplete}
                  onUploadError={handleUploadError}
                />
              </CardContent>
            </Card>

            {/* Stats Card */}
            <Card className="hover-lift animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-3 bg-muted rounded-lg">
                    <div className="text-2xl font-bold">{stats.total}</div>
                    <div className="text-xs text-muted-foreground">Total</div>
                  </div>
                  <div className="text-center p-3 bg-green-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{stats.processed}</div>
                    <div className="text-xs text-muted-foreground">Ready</div>
                  </div>
                  <div className="text-center p-3 bg-blue-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{stats.processing + stats.pending}</div>
                    <div className="text-xs text-muted-foreground">Processing</div>
                  </div>
                  <div className="text-center p-3 bg-red-500/10 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
                    <div className="text-xs text-muted-foreground">Failed</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Document List */}
          <div className="lg:col-span-2">
            <Card className="animate-fade-in" style={{ animationDelay: '0.15s' }}>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
                <CardDescription>
                  {stats.total === 0
                    ? 'No documents uploaded yet'
                    : `${stats.total} document${stats.total === 1 ? '' : 's'} in your library`
                  }
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <DocumentListSkeleton count={3} />
                ) : (
                  <DocumentList
                    documents={documents}
                    onDelete={handleDocumentDelete}
                    onDeleteMultiple={handleDocumentDeleteMultiple}
                    onRename={handleDocumentRename}
                    isLoading={false}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
