// Main router
export { processDocument, isFileTypeSupported, canProcessNow } from './router';

// Text processing
export { processTextFile, processMarkdownFile, chunkText, estimateTokenCount } from './text-processor';

// Document processing (PDF, Office)
export { processDocumentFile, isDocumentType } from './document-processor';

// Image processing
export { processStandaloneImage, processImagesBatch } from './image-processor';

// Video processing
export { processVideoFile, isVideoType } from './video-processor';

// Audio processing
export { processAudioFile, isAudioType } from './audio-processor';

// Content description
export { describeTable, describeImage, describeEquation } from './content-describer';

// Entity extraction (Knowledge Graph)
export {
  extractEntitiesFromText,
  processEntitiesForDocument,
  getEntitiesForDocument,
  deleteEntitiesForDocument,
} from './entity-extractor';

// Document parsing (Gemini-based)
export { parseDocumentWithGemini, isGeminiParsingAvailable } from './gemini-document-parser';
