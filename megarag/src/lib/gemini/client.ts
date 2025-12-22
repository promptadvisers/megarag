import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { AVAILABLE_MODELS } from './models';
import {
  getGeminiClient,
  getModelFromClient,
} from './factory';

// Re-export for convenience
export { AVAILABLE_MODELS } from './models';
export type { GeminiModelId } from './models';
export { getGeminiClient, getDefaultClient, clearClientCache, FileState } from './factory';

// Default model for processing (not user-configurable)
const DEFAULT_PROCESSING_MODEL = 'gemini-2.0-flash';

// Default API key from environment
const defaultApiKey = process.env.GOOGLE_AI_API_KEY;

if (!defaultApiKey) {
  console.warn('GOOGLE_AI_API_KEY not set - Gemini features will not work without per-tenant keys');
}

// Default instances for backward compatibility
const genAI = defaultApiKey ? new GoogleGenerativeAI(defaultApiKey) : null;
const fileManager = defaultApiKey ? new GoogleAIFileManager(defaultApiKey) : null;

// Default models for backward compatibility
export const geminiFlash: GenerativeModel | null = genAI
  ? genAI.getGenerativeModel({
      model: DEFAULT_PROCESSING_MODEL,
      generationConfig: {
        temperature: 0.1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
      },
    })
  : null;

export const geminiEmbedding: GenerativeModel | null = genAI
  ? genAI.getGenerativeModel({
      model: 'text-embedding-004',
    })
  : null;

/**
 * Get a Gemini model by ID for chat responses
 * @param modelId - Model ID to use
 * @param apiKey - Optional API key (uses default if not provided)
 */
export function getModel(modelId: string, apiKey?: string): GenerativeModel | null {
  const key = apiKey || defaultApiKey;
  if (!key) return null;

  const client = getGeminiClient(key);
  return getModelFromClient(client, modelId);
}

/**
 * Generate content with a specific model
 * @param prompt - The prompt to send
 * @param modelId - Model ID to use
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateContentWithModel(
  prompt: string,
  modelId: string = 'gemini-2.5-flash',
  apiKey?: string
): Promise<string> {
  const model = getModel(modelId, apiKey);
  if (!model) {
    throw new Error('Gemini model not initialized - no API key available');
  }

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate embeddings for text
 * @param text - Text to embed
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateEmbedding(text: string, apiKey?: string): Promise<number[]> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini embedding model not initialized - no API key available');
  }

  const client = getGeminiClient(key);
  const result = await client.embedding.embedContent(text);
  return result.embedding.values;
}

/**
 * Generate embeddings for multiple texts in batch
 * @param texts - Texts to embed
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey?: string
): Promise<number[][]> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini embedding model not initialized - no API key available');
  }

  const client = getGeminiClient(key);
  const embeddings: number[][] = [];

  // Process in batches of 100 to avoid rate limits
  const batchSize = 100;
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (text) => {
        const result = await client.embedding.embedContent(text);
        return result.embedding.values;
      })
    );
    embeddings.push(...results);
  }

  return embeddings;
}

/**
 * Generate text content using Flash model
 * @param prompt - The prompt to send
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateContent(prompt: string, apiKey?: string): Promise<string> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini Flash model not initialized - no API key available');
  }

  const client = getGeminiClient(key);
  const result = await client.flash.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate content with inline media (images, video, audio)
 * @param prompt - The prompt to send
 * @param mediaData - Array of media objects with mimeType and base64 data
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateContentWithMedia(
  prompt: string,
  mediaData: { mimeType: string; data: string }[],
  apiKey?: string
): Promise<string> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini Flash model not initialized - no API key available');
  }

  const client = getGeminiClient(key);

  const parts = [
    ...mediaData.map((media) => ({
      inlineData: {
        mimeType: media.mimeType,
        data: media.data,
      },
    })),
    { text: prompt },
  ];

  const result = await client.flash.generateContent(parts);
  return result.response.text();
}

/**
 * Upload a file to Gemini's File API for processing
 * @param buffer - File buffer
 * @param mimeType - MIME type of the file
 * @param displayName - Display name for the file
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function uploadFileToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string,
  apiKey?: string
): Promise<{ uri: string; name: string }> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini File Manager not initialized - no API key available');
  }

  const client = getGeminiClient(key);

  // Write buffer to temp file (required by the SDK)
  const fs = await import('fs');
  const path = await import('path');
  const os = await import('os');

  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `gemini-upload-${Date.now()}-${displayName}`);

  try {
    fs.writeFileSync(tempPath, buffer);
    console.log(`[Gemini] Uploading file: ${displayName}, size: ${buffer.length} bytes, mimeType: ${mimeType}`);

    const uploadResult = await client.fileManager.uploadFile(tempPath, {
      mimeType,
      displayName,
    });

    // Wait for file to be processed
    let file = uploadResult.file;
    console.log(`[Gemini] File uploaded, name: ${file.name}, state: ${file.state}`);

    while (file.state === FileState.PROCESSING) {
      console.log(`[Gemini] File still processing, waiting...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const getFileResult = await client.fileManager.getFile(file.name);
      file = getFileResult;
    }

    if (file.state === FileState.FAILED) {
      console.error(`[Gemini] File processing failed for: ${displayName}`);
      throw new Error('File processing failed');
    }

    console.log(`[Gemini] File ready, uri: ${file.uri}, state: ${file.state}`);
    return { uri: file.uri, name: file.name };
  } finally {
    // Clean up temp file
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Delete a file from Gemini's File API
 * @param fileName - Name of the file to delete
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function deleteGeminiFile(fileName: string, apiKey?: string): Promise<void> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini File Manager not initialized - no API key available');
  }

  const client = getGeminiClient(key);
  await client.fileManager.deleteFile(fileName);
}

/**
 * Generate content with a file uploaded to Gemini
 * @param prompt - The prompt to send
 * @param fileUri - URI of the uploaded file
 * @param mimeType - MIME type of the file
 * @param apiKey - Optional API key (uses default if not provided)
 */
export async function generateContentWithFile(
  prompt: string,
  fileUri: string,
  mimeType: string,
  apiKey?: string
): Promise<string> {
  const key = apiKey || defaultApiKey;
  if (!key) {
    throw new Error('Gemini Flash model not initialized - no API key available');
  }

  const client = getGeminiClient(key);

  // Put text prompt first, then file data
  const result = await client.flash.generateContent([
    { text: prompt },
    {
      fileData: {
        mimeType,
        fileUri,
      },
    },
  ]);

  return result.response.text();
}

// Export default instances for backward compatibility
export { genAI, fileManager };
