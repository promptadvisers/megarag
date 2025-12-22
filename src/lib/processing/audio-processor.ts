import { v4 as uuidv4 } from 'uuid';
import {
  uploadFileToGemini,
  deleteGeminiFile,
  generateContentWithFile,
} from '@/lib/gemini/client';
import { estimateTokenCount } from './text-processor';
import type { ChunkInsert } from '@/types';

const AUDIO_SEGMENT_SECONDS = parseInt(process.env.AUDIO_SEGMENT_SECONDS || '60');

/**
 * Prompt for full audio transcription and analysis
 */
const AUDIO_TRANSCRIPTION_PROMPT = `Analyze this audio file and provide:

1. **Full Transcription**: Transcribe all spoken content verbatim. Include speaker labels if multiple speakers are present (e.g., "Speaker 1:", "Speaker 2:").

2. **Summary**: Provide a 2-3 sentence summary of the main topics discussed.

3. **Key Points**: List the main points or takeaways.

4. **Timestamps**: If notable, provide approximate timestamps for topic changes (format: MM:SS - Topic).

Format the transcription clearly with proper punctuation and paragraph breaks. The transcription should be complete and accurate.`;

/**
 * Prompt for audio segment analysis
 */
const AUDIO_SEGMENT_PROMPT = `For the audio segment from {start_time} to {end_time}:

1. Transcribe all spoken content verbatim
2. Note any significant sounds or background audio
3. Identify speakers if multiple are present

Format as a clean transcription with speaker labels where applicable.`;

interface AudioAnalysis {
  transcription: string;
  summary: string;
  duration: number;
  segments: Array<{
    startTime: number;
    endTime: number;
    content: string;
  }>;
}

/**
 * Extract duration from audio analysis
 */
function extractDuration(analysis: string): number {
  // Try to find duration mention
  const hourMatch = analysis.match(/(\d+)\s*(?:hours?|hr)/i);
  const minuteMatch = analysis.match(/(\d+)\s*(?:minutes?|min)/i);
  const secondMatch = analysis.match(/(\d+)\s*(?:seconds?|sec)/i);

  let duration = 0;
  if (hourMatch) duration += parseInt(hourMatch[1]) * 3600;
  if (minuteMatch) duration += parseInt(minuteMatch[1]) * 60;
  if (secondMatch) duration += parseInt(secondMatch[1]);

  // Default to 5 minutes if not found
  return duration > 0 ? duration : 300;
}

/**
 * Parse timestamps and topics from analysis
 */
function parseTimestamps(analysis: string): Array<{ time: number; topic: string }> {
  const timestamps: Array<{ time: number; topic: string }> = [];

  // Match patterns like "00:30 - Topic" or "1:30 - Topic"
  const timestampRegex = /(\d{1,2}):(\d{2})\s*[-–]\s*([^\n]+)/g;
  let match;

  while ((match = timestampRegex.exec(analysis)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const topic = match[3].trim();
    timestamps.push({
      time: minutes * 60 + seconds,
      topic,
    });
  }

  return timestamps;
}

/**
 * Split transcription into chunks by paragraphs or sentences
 */
function splitTranscription(
  transcription: string,
  maxTokens: number = 800
): Array<{ content: string; tokens: number }> {
  const chunks: Array<{ content: string; tokens: number }> = [];

  // Split by double newlines (paragraphs) first
  const paragraphs = transcription.split(/\n\n+/);

  let currentChunk = '';
  let currentTokens = 0;

  for (const paragraph of paragraphs) {
    const paragraphTokens = estimateTokenCount(paragraph);

    if (currentTokens + paragraphTokens > maxTokens && currentChunk) {
      chunks.push({
        content: currentChunk.trim(),
        tokens: currentTokens,
      });
      currentChunk = '';
      currentTokens = 0;
    }

    // If single paragraph is too large, split by sentences
    if (paragraphTokens > maxTokens) {
      const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
      for (const sentence of sentences) {
        const sentenceTokens = estimateTokenCount(sentence);
        if (currentTokens + sentenceTokens > maxTokens && currentChunk) {
          chunks.push({
            content: currentChunk.trim(),
            tokens: currentTokens,
          });
          currentChunk = '';
          currentTokens = 0;
        }
        currentChunk += sentence + ' ';
        currentTokens += sentenceTokens;
      }
    } else {
      currentChunk += paragraph + '\n\n';
      currentTokens += paragraphTokens;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      tokens: currentTokens,
    });
  }

  return chunks;
}

/**
 * Process an audio file into chunks with transcription
 */
export async function processAudioFile(
  audioBuffer: ArrayBuffer,
  mimeType: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];
  let geminiFileName: string | null = null;

  try {
    // Upload audio to Gemini File API
    const buffer = Buffer.from(audioBuffer);
    const { uri, name } = await uploadFileToGemini(
      buffer,
      mimeType,
      `audio-${documentId}`
    );
    geminiFileName = name;

    // Get full transcription and analysis
    const fullAnalysis = await generateContentWithFile(
      AUDIO_TRANSCRIPTION_PROMPT,
      uri,
      mimeType
    );

    // Extract transcription from analysis
    // The transcription usually follows "Full Transcription:" or similar header
    let transcription = fullAnalysis;
    const transcriptionMatch = fullAnalysis.match(/(?:Transcription|Transcript)[:\s]*\n([\s\S]+?)(?:\n\n\*\*|$)/i);
    if (transcriptionMatch) {
      transcription = transcriptionMatch[1];
    }

    // Create overview chunk with summary
    const summaryMatch = fullAnalysis.match(/(?:Summary)[:\s]*\n?([\s\S]+?)(?:\n\n\*\*|\n\n\d|$)/i);
    const summary = summaryMatch ? summaryMatch[1].trim() : 'Audio content analyzed.';

    chunks.push({
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: `Audio Summary:\n\n${summary}`,
      tokens: estimateTokenCount(summary),
      chunk_type: 'audio',
      timestamp_start: 0,
      timestamp_end: 0,
      metadata: {
        isOverview: true,
        mimeType,
        fullAnalysis: fullAnalysis.substring(0, 2000), // Store first 2000 chars of full analysis
      },
    });

    // Check if we have timestamps from the analysis
    const timestamps = parseTimestamps(fullAnalysis);

    if (timestamps.length > 1) {
      // Create chunks based on topic timestamps
      const duration = extractDuration(fullAnalysis);

      for (let i = 0; i < timestamps.length; i++) {
        const startTime = timestamps[i].time;
        const endTime = timestamps[i + 1]?.time || duration;
        const topic = timestamps[i].topic;

        // Get segment-specific transcription
        const segmentPrompt = `For the audio segment from ${formatSeconds(startTime)} to ${formatSeconds(endTime)}, which covers: "${topic}"

Provide:
1. Complete transcription of this segment
2. Key points discussed

Format as clean text suitable for search.`;

        try {
          const segmentContent = await generateContentWithFile(
            segmentPrompt,
            uri,
            mimeType
          );

          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `[${formatSeconds(startTime)} - ${formatSeconds(endTime)}] ${topic}\n\n${segmentContent}`,
            tokens: estimateTokenCount(segmentContent),
            chunk_type: 'audio',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              topic,
            },
          });
        } catch (error) {
          console.error(`Error analyzing audio segment at ${startTime}:`, error);
          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `[${formatSeconds(startTime)} - ${formatSeconds(endTime)}] ${topic}`,
            tokens: estimateTokenCount(topic),
            chunk_type: 'audio',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              topic,
            },
          });
        }
      }
    } else {
      // Split the full transcription into chunks
      const transcriptionChunks = splitTranscription(transcription);

      for (let i = 0; i < transcriptionChunks.length; i++) {
        const chunk = transcriptionChunks[i];

        chunks.push({
          id: uuidv4(),
          workspace,
          document_id: documentId,
          chunk_order_index: i + 1,
          content: chunk.content,
          tokens: chunk.tokens,
          chunk_type: 'audio',
          metadata: {
            mimeType,
            chunkIndex: i,
            totalChunks: transcriptionChunks.length,
          },
        });
      }
    }

    return chunks;
  } catch (error) {
    console.error('Error processing audio:', error);

    // Return error chunk
    return [{
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: 'Audio could not be processed.',
      tokens: 5,
      chunk_type: 'audio',
      metadata: {
        mimeType,
        processingError: error instanceof Error ? error.message : 'Unknown error',
      },
    }];
  } finally {
    // Clean up uploaded file from Gemini
    if (geminiFileName) {
      try {
        await deleteGeminiFile(geminiFileName);
      } catch (error) {
        console.error('Error deleting Gemini file:', error);
      }
    }
  }
}

/**
 * Format seconds into MM:SS format
 */
function formatSeconds(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if a file is an audio type
 */
export function isAudioType(fileType: string): boolean {
  return ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac'].includes(fileType.toLowerCase());
}
