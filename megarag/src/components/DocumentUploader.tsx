'use client';

import { useCallback, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FileImage, FileVideo, FileAudio, File, X, CheckCircle, AlertCircle, Loader2, RotateCcw, StopCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import type { DocumentUploaderProps } from '@/types';

// Supported file types and their MIME types
const ACCEPTED_FILE_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'text/plain': ['.txt'],
  'text/markdown': ['.md'],
  'video/mp4': ['.mp4'],
  'audio/mpeg': ['.mp3'],
  'audio/wav': ['.wav'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
};

// Concurrency limit for parallel uploads
const MAX_CONCURRENT_UPLOADS = 3;

interface FileUpload {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error' | 'cancelled';
  error?: string;
  documentId?: string;
  xhr?: XMLHttpRequest;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return FileImage;
  if (fileType.startsWith('video/')) return FileVideo;
  if (fileType.startsWith('audio/')) return FileAudio;
  if (fileType.includes('pdf') || fileType.includes('document') || fileType.includes('text')) return FileText;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function DocumentUploader({
  onUploadComplete,
  onUploadError,
  maxFileSizeMB = 100
}: DocumentUploaderProps) {
  const [uploads, setUploads] = useState<FileUpload[]>([]);
  const uploadQueueRef = useRef<FileUpload[]>([]);
  const activeUploadsRef = useRef<number>(0);
  const isCancelledRef = useRef<boolean>(false);

  // Upload a single file with XHR for progress tracking
  const uploadFileWithProgress = (fileUpload: FileUpload): Promise<void> => {
    return new Promise((resolve) => {
      const formData = new FormData();
      formData.append('file', fileUpload.file);

      const xhr = new XMLHttpRequest();

      // Store XHR reference for cancellation
      setUploads(prev => prev.map(u =>
        u.id === fileUpload.id ? { ...u, status: 'uploading' as const, progress: 0, xhr } : u
      ));

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploads(prev => prev.map(u =>
            u.id === fileUpload.id ? { ...u, progress } : u
          ));
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploads(prev => prev.map(u =>
              u.id === fileUpload.id
                ? { ...u, status: 'success' as const, progress: 100, documentId: data.documentId, xhr: undefined }
                : u
            ));
            onUploadComplete?.(data.documentId);
          } catch {
            setUploads(prev => prev.map(u =>
              u.id === fileUpload.id
                ? { ...u, status: 'error' as const, error: 'Invalid response', xhr: undefined }
                : u
            ));
          }
        } else {
          let errorMessage = 'Upload failed';
          try {
            const errorData = JSON.parse(xhr.responseText);
            errorMessage = errorData.error || errorMessage;
          } catch { /* ignore */ }
          setUploads(prev => prev.map(u =>
            u.id === fileUpload.id
              ? { ...u, status: 'error' as const, error: errorMessage, xhr: undefined }
              : u
          ));
          onUploadError?.(new Error(errorMessage));
        }
        resolve();
      };

      xhr.onerror = () => {
        setUploads(prev => prev.map(u =>
          u.id === fileUpload.id
            ? { ...u, status: 'error' as const, error: 'Network error', xhr: undefined }
            : u
        ));
        onUploadError?.(new Error('Network error'));
        resolve();
      };

      xhr.onabort = () => {
        setUploads(prev => prev.map(u =>
          u.id === fileUpload.id
            ? { ...u, status: 'cancelled' as const, progress: 0, xhr: undefined }
            : u
        ));
        resolve();
      };

      xhr.open('POST', '/api/upload');
      xhr.send(formData);
    });
  };

  // Process upload queue with concurrency limit
  const processQueue = async () => {
    while (uploadQueueRef.current.length > 0 && activeUploadsRef.current < MAX_CONCURRENT_UPLOADS) {
      if (isCancelledRef.current) break;

      const fileUpload = uploadQueueRef.current.shift();
      if (!fileUpload) break;

      // Check if this upload was cancelled before starting
      const currentUpload = uploads.find(u => u.id === fileUpload.id);
      if (currentUpload?.status === 'cancelled') continue;

      activeUploadsRef.current++;

      uploadFileWithProgress(fileUpload).finally(() => {
        activeUploadsRef.current--;
        processQueue();
      });
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const maxSize = maxFileSizeMB * 1024 * 1024;
    isCancelledRef.current = false;

    const newUploads: FileUpload[] = acceptedFiles
      .filter(file => {
        if (file.size > maxSize) {
          onUploadError?.(new Error(`File ${file.name} exceeds ${maxFileSizeMB}MB limit`));
          return false;
        }
        return true;
      })
      .map(file => ({
        file,
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        progress: 0,
        status: 'pending' as const,
      }));

    if (newUploads.length === 0) return;

    setUploads(prev => [...prev, ...newUploads]);

    // Add to queue and start processing
    uploadQueueRef.current.push(...newUploads);
    processQueue();
  }, [maxFileSizeMB, onUploadComplete, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
  });

  const removeUpload = (id: string) => {
    // Cancel if uploading
    const upload = uploads.find(u => u.id === id);
    if (upload?.xhr) {
      upload.xhr.abort();
    }
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status !== 'success'));
  };

  const retryUpload = (fileUpload: FileUpload) => {
    // Reset status and re-queue
    setUploads(prev => prev.map(u =>
      u.id === fileUpload.id ? { ...u, status: 'pending' as const, progress: 0, error: undefined } : u
    ));
    uploadQueueRef.current.push({ ...fileUpload, status: 'pending', progress: 0, error: undefined });
    processQueue();
  };

  const retryAllFailed = () => {
    const failedUploads = uploads.filter(u => u.status === 'error');
    failedUploads.forEach(upload => {
      setUploads(prev => prev.map(u =>
        u.id === upload.id ? { ...u, status: 'pending' as const, progress: 0, error: undefined } : u
      ));
      uploadQueueRef.current.push({ ...upload, status: 'pending', progress: 0, error: undefined });
    });
    processQueue();
  };

  const cancelAllUploads = () => {
    isCancelledRef.current = true;
    uploadQueueRef.current = [];

    // Abort all active XHR requests
    uploads.forEach(upload => {
      if (upload.xhr) {
        upload.xhr.abort();
      }
    });

    // Mark pending as cancelled
    setUploads(prev => prev.map(u =>
      u.status === 'pending' || u.status === 'uploading'
        ? { ...u, status: 'cancelled' as const, progress: 0, xhr: undefined }
        : u
    ));
  };

  // Calculate aggregate stats
  const stats = {
    total: uploads.length,
    pending: uploads.filter(u => u.status === 'pending').length,
    uploading: uploads.filter(u => u.status === 'uploading').length,
    success: uploads.filter(u => u.status === 'success').length,
    error: uploads.filter(u => u.status === 'error').length,
    cancelled: uploads.filter(u => u.status === 'cancelled').length,
  };
  const isUploading = stats.pending > 0 || stats.uploading > 0;
  const overallProgress = stats.total > 0
    ? Math.round((stats.success / stats.total) * 100 +
        uploads.filter(u => u.status === 'uploading').reduce((acc, u) => acc + u.progress, 0) / stats.total)
    : 0;

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50'
          }
        `}
      >
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg font-medium">Drop files here...</p>
        ) : (
          <>
            <p className="text-lg font-medium mb-1">Drag & drop files here</p>
            <p className="text-sm text-muted-foreground mb-2">or click to browse</p>
            <p className="text-xs text-muted-foreground">
              Supports: PDF, DOCX, PPTX, XLSX, TXT, MD, MP4, MP3, WAV, JPG, PNG, GIF, WebP
            </p>
            <p className="text-xs text-muted-foreground">Max file size: {maxFileSizeMB}MB</p>
          </>
        )}
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div className="space-y-3">
          {/* Summary bar */}
          <Card className="p-3 bg-muted/50">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">
                    {isUploading
                      ? `Uploading ${stats.uploading} of ${stats.total} files...`
                      : `${stats.success} of ${stats.total} uploaded`}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {overallProgress}%
                  </span>
                </div>
                <Progress value={overallProgress} className="h-2" />
                {(stats.error > 0 || stats.cancelled > 0) && (
                  <div className="flex gap-3 mt-1 text-xs">
                    {stats.error > 0 && (
                      <span className="text-destructive">{stats.error} failed</span>
                    )}
                    {stats.cancelled > 0 && (
                      <span className="text-muted-foreground">{stats.cancelled} cancelled</span>
                    )}
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {isUploading && (
                  <Button variant="outline" size="sm" onClick={cancelAllUploads}>
                    <StopCircle className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                )}
                {stats.error > 0 && !isUploading && (
                  <Button variant="outline" size="sm" onClick={retryAllFailed}>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Retry failed
                  </Button>
                )}
                {stats.success > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCompleted}>
                    Clear completed
                  </Button>
                )}
              </div>
            </div>
          </Card>

          {/* File list */}
          <div className="space-y-2">
            {uploads.map(upload => {
              const FileIcon = getFileIcon(upload.file.type);

              return (
                <Card key={upload.id} className="p-3">
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-8 w-8 text-muted-foreground flex-shrink-0" />

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{upload.file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(upload.file.size)}
                        {upload.status === 'uploading' && ` • ${upload.progress}%`}
                      </p>

                      {upload.status === 'uploading' && (
                        <Progress value={upload.progress} className="h-1 mt-2" />
                      )}

                      {upload.status === 'error' && (
                        <p className="text-xs text-destructive mt-1">{upload.error}</p>
                      )}

                      {upload.status === 'cancelled' && (
                        <p className="text-xs text-muted-foreground mt-1">Cancelled</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {upload.status === 'pending' && (
                        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                      )}
                      {upload.status === 'uploading' && (
                        <Loader2 className="h-5 w-5 text-primary animate-spin" />
                      )}
                      {upload.status === 'success' && (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      )}
                      {upload.status === 'error' && (
                        <>
                          <AlertCircle className="h-5 w-5 text-destructive" />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => retryUpload(upload)}
                            title="Retry upload"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                      {upload.status === 'cancelled' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => retryUpload(upload)}
                          title="Retry upload"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => removeUpload(upload.id)}
                        title="Remove"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentUploader;
