import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { GoogleAIFileManager, FileState } from '@google/generative-ai/server';
import { AVAILABLE_MODELS } from './models';

// Default model for processing (not user-configurable)
const DEFAULT_PROCESSING_MODEL = 'gemini-2.0-flash';

/**
 * Gemini client instance with all needed models and managers
 */
export interface GeminiClientInstance {
  genAI: GoogleGenerativeAI;
  flash: GenerativeModel;
  embedding: GenerativeModel;
  fileManager: GoogleAIFileManager;
}

/**
 * Create a new Gemini client instance with a specific API key
 */
export function createGeminiClient(apiKey: string): GeminiClientInstance {
  if (!apiKey) {
    throw new Error('API key is required to create Gemini client');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const fileManager = new GoogleAIFileManager(apiKey);

  const flash = genAI.getGenerativeModel({
    model: DEFAULT_PROCESSING_MODEL,
    generationConfig: {
      temperature: 0.1,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });

  const embedding = genAI.getGenerativeModel({
    model: 'text-embedding-004',
  });

  return { genAI, flash, embedding, fileManager };
}

/**
 * Get a specific model from a client instance
 */
export function getModelFromClient(
  client: GeminiClientInstance,
  modelId: string
): GenerativeModel {
  const validModelId = modelId in AVAILABLE_MODELS ? modelId : 'gemini-2.5-flash';

  return client.genAI.getGenerativeModel({
    model: validModelId,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  });
}

/**
 * LRU Cache for Gemini client instances
 * Prevents recreating clients for every request
 */
class GeminiClientCache {
  private cache: Map<string, { client: GeminiClientInstance; timestamp: number }>;
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 100, ttlMinutes: number = 5) {
    this.cache = new Map();
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;
  }

  /**
   * Get a cached client or create a new one
   */
  get(apiKey: string): GeminiClientInstance {
    // Use hash of API key as cache key for security
    const cacheKey = this.hashKey(apiKey);
    const now = Date.now();

    const cached = this.cache.get(cacheKey);
    if (cached && now - cached.timestamp < this.ttlMs) {
      // Move to end (most recently used)
      this.cache.delete(cacheKey);
      this.cache.set(cacheKey, cached);
      return cached.client;
    }

    // Create new client
    const client = createGeminiClient(apiKey);

    // Evict oldest entries if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(cacheKey, { client, timestamp: now });
    return client;
  }

  /**
   * Clear expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.ttlMs) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear all cached clients
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Simple hash for cache key
   */
  private hashKey(key: string): string {
    let hash = 0;
    for (let i = 0; i < key.length; i++) {
      const char = key.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

// Global cache instance
const clientCache = new GeminiClientCache();

/**
 * Get a cached Gemini client for an API key
 */
export function getGeminiClient(apiKey: string): GeminiClientInstance {
  return clientCache.get(apiKey);
}

/**
 * Clear the client cache (useful for testing or key rotation)
 */
export function clearClientCache(): void {
  clientCache.clear();
}

/**
 * Get the default API key from environment
 */
export function getDefaultApiKey(): string | null {
  return process.env.GOOGLE_AI_API_KEY || null;
}

/**
 * Get the default client using env API key
 * Throws if GOOGLE_AI_API_KEY not set
 */
export function getDefaultClient(): GeminiClientInstance {
  const apiKey = getDefaultApiKey();
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY not set - Gemini features will not work');
  }
  return getGeminiClient(apiKey);
}

// Re-export FileState for convenience
export { FileState };
