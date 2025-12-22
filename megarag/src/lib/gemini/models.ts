/**
 * Available Gemini models for chat
 * This file is separated from client.ts to allow importing in client components
 */
export const AVAILABLE_MODELS = {
  'gemini-2.5-flash': {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Fast and efficient, great for most tasks',
  },
  'gemini-2.5-flash-lite': {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash Lite',
    description: 'Fastest option, optimized for high throughput',
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Most capable, best for complex reasoning',
  },
  'gemini-3-flash-preview': {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash (Preview)',
    description: 'Next-gen flash model, experimental',
  },
  'gemini-3-pro-preview': {
    id: 'gemini-3-pro-preview',
    name: 'Gemini 3 Pro (Preview)',
    description: 'Next-gen pro model, experimental',
  },
} as const;

export type GeminiModelId = keyof typeof AVAILABLE_MODELS;

export const DEFAULT_MODEL: GeminiModelId = 'gemini-2.5-flash';
