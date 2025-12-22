'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, FileImage, FileVideo, FileAudio, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
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

interface FileUpload {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  documentId?: string;
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

  const uploadFile = async (fileUpload: FileUpload) => {
    const formData = new FormData();
    formData.append('file', fileUpload.file);

    try {
      // Update status to uploading
      setUploads(prev => prev.map(u =>
        u.id === fileUpload.id ? { ...u, status: 'uploading' as const, progress: 0 } : u
      ));

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const data = await response.json();

      // Update status to success
      setUploads(prev => prev.map(u =>
        u.id === fileUpload.id
          ? { ...u, status: 'success' as const, progress: 100, documentId: data.documentId }
          : u
      ));

      onUploadComplete?.(data.documentId);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';

      // Update status to error
      setUploads(prev => prev.map(u =>
        u.id === fileUpload.id ? { ...u, status: 'error' as const, error: errorMessage } : u
      ));

      onUploadError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const maxSize = maxFileSizeMB * 1024 * 1024;

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

    setUploads(prev => [...prev, ...newUploads]);

    // Start uploading each file
    newUploads.forEach(upload => {
      uploadFile(upload);
    });
  }, [maxFileSizeMB, onUploadComplete, onUploadError]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_FILE_TYPES,
    multiple: true,
  });

  const removeUpload = (id: string) => {
    setUploads(prev => prev.filter(u => u.id !== id));
  };

  const clearCompleted = () => {
    setUploads(prev => prev.filter(u => u.status !== 'success'));
  };

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
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Uploads</h3>
            {uploads.some(u => u.status === 'success') && (
              <Button variant="ghost" size="sm" onClick={clearCompleted}>
                Clear completed
              </Button>
            )}
          </div>

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
                    </p>

                    {upload.status === 'uploading' && (
                      <Progress value={upload.progress} className="h-1 mt-2" />
                    )}

                    {upload.status === 'error' && (
                      <p className="text-xs text-destructive mt-1">{upload.error}</p>
                    )}
                  </div>

                  <div className="flex-shrink-0">
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
                      <AlertCircle className="h-5 w-5 text-destructive" />
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 flex-shrink-0"
                    onClick={() => removeUpload(upload.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DocumentUploader;
