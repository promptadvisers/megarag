import { supabaseAdmin } from '@/lib/supabase/server';
import { processTextFile, processMarkdownFile } from './text-processor';
import { processDocumentFile, isDocumentType } from './document-processor';
import { processStandaloneImage } from './image-processor';
import { processVideoFile } from './video-processor';
import { processAudioFile } from './audio-processor';
import { processEntitiesForDocument } from './entity-extractor';
import { addEmbeddingsToChunks } from '@/lib/gemini/embeddings';
import type { ChunkInsert, DocumentStatus } from '@/types';

// Enable/disable entity extraction (can be controlled via env)
const ENABLE_ENTITY_EXTRACTION = process.env.ENABLE_ENTITY_EXTRACTION !== 'false';

// File type to processor mapping for simple text files
type ProcessorFunction = (
  content: string,
  documentId: string,
  workspace: string
) => Promise<ChunkInsert[]>;

const TEXT_PROCESSORS: Record<string, ProcessorFunction> = {
  'txt': processTextFile,
  'md': processMarkdownFile,
};

// Document types that require the parsing service
const DOCUMENT_TYPES = ['pdf', 'docx', 'pptx', 'xlsx'];

// Image types
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

// Video types
const VIDEO_TYPES = ['mp4', 'webm', 'mov', 'avi'];

// Audio types
const AUDIO_TYPES = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'];

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
  // Documents
  'pdf': 'application/pdf',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Images
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  // Video
  'mp4': 'video/mp4',
  'webm': 'video/webm',
  'mov': 'video/quicktime',
  'avi': 'video/x-msvideo',
  // Audio
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'flac': 'audio/flac',
  'm4a': 'audio/mp4',
  'aac': 'audio/aac',
};

interface ProcessingResult {
  success: boolean;
  chunksCreated: number;
  entitiesCreated?: number;
  relationsCreated?: number;
  error?: string;
}

/**
 * Processing options for multi-tenancy support
 */
export interface ProcessingOptions {
  workspace: string;
  geminiApiKey?: string;
}

/**
 * Update document status in database
 */
async function updateDocumentStatus(
  documentId: string,
  status: DocumentStatus,
  chunksCount?: number,
  errorMessage?: string
): Promise<void> {
  const updateData: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (chunksCount !== undefined) {
    updateData.chunks_count = chunksCount;
  }

  if (errorMessage) {
    updateData.error_message = errorMessage;
  }

  const { error } = await supabaseAdmin
    .from('documents')
    .update(updateData)
    .eq('id', documentId);

  if (error) {
    console.error('Error updating document status:', error);
  }
}

/**
 * Get file content as text from Supabase storage
 */
async function getFileContentAsText(filePath: string): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  const text = await data.text();
  return text;
}

/**
 * Get file content as ArrayBuffer from Supabase storage
 */
async function getFileContentAsBuffer(filePath: string): Promise<ArrayBuffer> {
  const { data, error } = await supabaseAdmin.storage
    .from('documents')
    .download(filePath);

  if (error) {
    throw new Error(`Failed to download file: ${error.message}`);
  }

  return await data.arrayBuffer();
}

/**
 * Store chunks in database
 */
async function storeChunks(chunks: ChunkInsert[]): Promise<void> {
  if (chunks.length === 0) return;

  const batchSize = 100;

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);

    const { error } = await supabaseAdmin
      .from('chunks')
      .insert(batch);

    if (error) {
      throw new Error(`Failed to insert chunks: ${error.message}`);
    }
  }
}

/**
 * Process a text file (TXT or MD)
 */
async function processText(
  documentId: string,
  filePath: string,
  fileType: string,
  workspace: string
): Promise<ProcessingResult> {
  try {
    const content = await getFileContentAsText(filePath);

    if (!content.trim()) {
      return { success: false, chunksCreated: 0, error: 'File is empty' };
    }

    const processor = TEXT_PROCESSORS[fileType];
    if (!processor) {
      return { success: false, chunksCreated: 0, error: `No processor for: ${fileType}` };
    }

    const chunks = await processor(content, documentId, workspace);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'No chunks created' };
    }

    const chunksWithEmbeddings = await addEmbeddingsToChunks(chunks);
    await storeChunks(chunksWithEmbeddings);

    return { success: true, chunksCreated: chunks.length };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a document file (PDF, DOCX, PPTX, XLSX) using Gemini
 */
async function processDocFile(
  documentId: string,
  filePath: string,
  fileType: string,
  workspace: string
): Promise<ProcessingResult> {
  try {
    const buffer = await getFileContentAsBuffer(filePath);
    const filename = filePath.split('/').pop() || 'document';
    const mimeType = MIME_TYPES[fileType] || 'application/octet-stream';

    const { chunks } = await processDocumentFile(buffer, filename, mimeType, documentId, workspace);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'No content extracted from document' };
    }

    const chunksWithEmbeddings = await addEmbeddingsToChunks(chunks);
    await storeChunks(chunksWithEmbeddings);

    return { success: true, chunksCreated: chunks.length };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a standalone image file
 */
async function processImage(
  documentId: string,
  filePath: string,
  fileType: string,
  workspace: string
): Promise<ProcessingResult> {
  try {
    const buffer = await getFileContentAsBuffer(filePath);
    const mimeType = MIME_TYPES[fileType] || 'image/png';

    const chunks = await processStandaloneImage(buffer, mimeType, documentId, workspace);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'Could not process image' };
    }

    const chunksWithEmbeddings = await addEmbeddingsToChunks(chunks);
    await storeChunks(chunksWithEmbeddings);

    return { success: true, chunksCreated: chunks.length };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process a video file via Gemini native video support
 */
async function processVideo(
  documentId: string,
  filePath: string,
  fileType: string,
  workspace: string
): Promise<ProcessingResult> {
  try {
    const buffer = await getFileContentAsBuffer(filePath);
    const mimeType = MIME_TYPES[fileType] || 'video/mp4';

    const chunks = await processVideoFile(buffer, mimeType, documentId, workspace);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'Could not process video' };
    }

    const chunksWithEmbeddings = await addEmbeddingsToChunks(chunks);
    await storeChunks(chunksWithEmbeddings);

    return { success: true, chunksCreated: chunks.length };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Process an audio file via Gemini native audio support
 */
async function processAudio(
  documentId: string,
  filePath: string,
  fileType: string,
  workspace: string
): Promise<ProcessingResult> {
  try {
    const buffer = await getFileContentAsBuffer(filePath);
    const mimeType = MIME_TYPES[fileType] || 'audio/mpeg';

    const chunks = await processAudioFile(buffer, mimeType, documentId, workspace);

    if (chunks.length === 0) {
      return { success: false, chunksCreated: 0, error: 'Could not process audio' };
    }

    const chunksWithEmbeddings = await addEmbeddingsToChunks(chunks);
    await storeChunks(chunksWithEmbeddings);

    return { success: true, chunksCreated: chunks.length };
  } catch (error) {
    return {
      success: false,
      chunksCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Main processing router - routes files to appropriate processor
 */
export async function processDocument(
  documentId: string,
  filePath: string,
  fileType: string,
  options: ProcessingOptions | string = 'default'
): Promise<ProcessingResult> {
  // Handle backwards compatibility
  const workspace = typeof options === 'string' ? options : options.workspace;
  // Note: geminiApiKey from options can be used in future for per-tenant processing
  // Currently the processors use the default API key, but the infrastructure is in place
  await updateDocumentStatus(documentId, 'processing');

  let result: ProcessingResult;

  try {
    if (fileType in TEXT_PROCESSORS) {
      // Text files (TXT, MD)
      result = await processText(documentId, filePath, fileType, workspace);
    } else if (DOCUMENT_TYPES.includes(fileType)) {
      // Document files (PDF, DOCX, PPTX, XLSX)
      result = await processDocFile(documentId, filePath, fileType, workspace);
    } else if (IMAGE_TYPES.includes(fileType)) {
      // Image files via Gemini Vision
      result = await processImage(documentId, filePath, fileType, workspace);
    } else if (VIDEO_TYPES.includes(fileType)) {
      // Video files via Gemini native video support
      result = await processVideo(documentId, filePath, fileType, workspace);
    } else if (AUDIO_TYPES.includes(fileType)) {
      // Audio files via Gemini native audio support
      result = await processAudio(documentId, filePath, fileType, workspace);
    } else {
      result = {
        success: false,
        chunksCreated: 0,
        error: `Unsupported file type: ${fileType}`,
      };
    }

    // Update document status based on result
    if (result.success) {
      await updateDocumentStatus(documentId, 'processed', result.chunksCreated);

      // Run entity extraction if enabled and we have text content
      if (ENABLE_ENTITY_EXTRACTION && result.chunksCreated > 0) {
        try {
          // Get the stored chunks for entity extraction
          const { data: storedChunks } = await supabaseAdmin
            .from('chunks')
            .select('id, content')
            .eq('document_id', documentId)
            .in('chunk_type', ['text', 'audio', 'video_segment']); // Only text-based chunks

          if (storedChunks && storedChunks.length > 0) {
            const entityResult = await processEntitiesForDocument(
              documentId,
              storedChunks,
              workspace
            );
            result.entitiesCreated = entityResult.entitiesCreated;
            result.relationsCreated = entityResult.relationsCreated;

            console.log(
              `Entity extraction complete: ${entityResult.entitiesCreated} entities, ${entityResult.relationsCreated} relations`
            );
          }
        } catch (entityError) {
          // Log but don't fail the whole processing for entity extraction errors
          console.error('Entity extraction error (non-fatal):', entityError);
        }
      }
    } else {
      await updateDocumentStatus(documentId, 'failed', 0, result.error);
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error';
    await updateDocumentStatus(documentId, 'failed', 0, errorMessage);

    return { success: false, chunksCreated: 0, error: errorMessage };
  }
}

/**
 * Check if a file type is supported for processing
 */
export function isFileTypeSupported(fileType: string): boolean {
  return (
    fileType in TEXT_PROCESSORS ||
    DOCUMENT_TYPES.includes(fileType) ||
    IMAGE_TYPES.includes(fileType) ||
    VIDEO_TYPES.includes(fileType) ||
    AUDIO_TYPES.includes(fileType)
  );
}

/**
 * Check if a file type can be processed now
 */
export function canProcessNow(fileType: string): boolean {
  return (
    fileType in TEXT_PROCESSORS ||
    DOCUMENT_TYPES.includes(fileType) ||
    IMAGE_TYPES.includes(fileType) ||
    VIDEO_TYPES.includes(fileType) ||
    AUDIO_TYPES.includes(fileType)
  );
}
