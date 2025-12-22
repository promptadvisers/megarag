import { v4 as uuidv4 } from 'uuid';
import {
  uploadFileToGemini,
  deleteGeminiFile,
  generateContentWithFile,
} from '@/lib/gemini/client';
import { estimateTokenCount } from './text-processor';
import type { ChunkInsert } from '@/types';

const VIDEO_SEGMENT_SECONDS = parseInt(process.env.VIDEO_SEGMENT_SECONDS || '30');

/**
 * Prompt for video segment analysis
 */
const VIDEO_SEGMENT_PROMPT = `Analyze this video segment and provide a detailed description for search and retrieval.

Segment timeframe: {start_time}s - {end_time}s

Describe:
1. **Visual Content**: What is shown in the video frames?
2. **Actions**: What activities or movements occur?
3. **Audio/Speech**: Summarize any spoken content or sounds
4. **Key Moments**: What are the most significant events in this segment?
5. **Context**: How does this segment relate to the overall video?

Format as a searchable paragraph that captures both visual and audio content. Be specific and descriptive.`;

/**
 * Prompt for overall video description
 */
const VIDEO_OVERVIEW_PROMPT = `Analyze this video and provide:

1. **Overall Summary**: What is this video about? (2-3 sentences)
2. **Key Topics**: What main topics or themes are covered?
3. **Timeline**: Provide timestamps for major sections or key moments (format: MM:SS - Description)
4. **Duration**: Estimate the total video duration

Format your response as structured text that can be used for search and retrieval.`;

interface VideoAnalysis {
  overview: string;
  duration: number;
  segments: Array<{
    startTime: number;
    endTime: number;
    description: string;
  }>;
}

/**
 * Extract duration from video analysis or estimate it
 */
function extractDuration(analysis: string): number {
  // Try to find duration mention in the analysis
  const durationMatch = analysis.match(/(\d+)\s*(?:minutes?|min)/i);
  if (durationMatch) {
    return parseInt(durationMatch[1]) * 60;
  }

  const secondsMatch = analysis.match(/(\d+)\s*(?:seconds?|sec)/i);
  if (secondsMatch) {
    return parseInt(secondsMatch[1]);
  }

  // Default to 5 minutes if not found
  return 300;
}

/**
 * Parse timestamps from video overview
 */
function parseTimestamps(analysis: string): Array<{ time: number; description: string }> {
  const timestamps: Array<{ time: number; description: string }> = [];

  // Match patterns like "00:30 - Description" or "1:30 - Description"
  const timestampRegex = /(\d{1,2}):(\d{2})\s*[-–]\s*([^\n]+)/g;
  let match;

  while ((match = timestampRegex.exec(analysis)) !== null) {
    const minutes = parseInt(match[1]);
    const seconds = parseInt(match[2]);
    const description = match[3].trim();
    timestamps.push({
      time: minutes * 60 + seconds,
      description,
    });
  }

  return timestamps;
}

/**
 * Generate segment prompts for specific time ranges
 */
function generateSegmentPrompt(startTime: number, endTime: number): string {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return VIDEO_SEGMENT_PROMPT
    .replace('{start_time}', formatTime(startTime))
    .replace('{end_time}', formatTime(endTime));
}

/**
 * Process a video file into chunks with descriptions
 */
export async function processVideoFile(
  videoBuffer: ArrayBuffer,
  mimeType: string,
  documentId: string,
  workspace: string = 'default'
): Promise<ChunkInsert[]> {
  const chunks: ChunkInsert[] = [];
  let geminiFileName: string | null = null;

  try {
    // Upload video to Gemini File API
    const buffer = Buffer.from(videoBuffer);
    const { uri, name } = await uploadFileToGemini(
      buffer,
      mimeType,
      `video-${documentId}`
    );
    geminiFileName = name;

    // Get video overview and duration estimate
    const overview = await generateContentWithFile(
      VIDEO_OVERVIEW_PROMPT,
      uri,
      mimeType
    );

    // Create overview chunk
    chunks.push({
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: `Video Overview:\n\n${overview}`,
      tokens: estimateTokenCount(overview),
      chunk_type: 'video_segment',
      timestamp_start: 0,
      timestamp_end: 0,
      metadata: {
        isOverview: true,
        mimeType,
      },
    });

    // Extract duration and timestamps
    const duration = extractDuration(overview);
    const keyMoments = parseTimestamps(overview);

    // If we have key moments from the overview, create chunks for those
    if (keyMoments.length > 0) {
      // Use key moments as segments
      for (let i = 0; i < keyMoments.length; i++) {
        const startTime = keyMoments[i].time;
        const endTime = keyMoments[i + 1]?.time || duration;
        const description = keyMoments[i].description;

        // Get more detailed analysis for this segment
        const segmentPrompt = `For the video segment from ${formatSeconds(startTime)} to ${formatSeconds(endTime)}, which covers: "${description}"

Provide a detailed description including:
- What visual elements are present
- Any spoken content or dialogue
- Key actions or events
- Important details for search relevance

Format as a single paragraph.`;

        try {
          const segmentAnalysis = await generateContentWithFile(
            segmentPrompt,
            uri,
            mimeType
          );

          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `[${formatSeconds(startTime)} - ${formatSeconds(endTime)}] ${description}\n\n${segmentAnalysis}`,
            tokens: estimateTokenCount(segmentAnalysis),
            chunk_type: 'video_segment',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              keyMoment: description,
            },
          });
        } catch (error) {
          console.error(`Error analyzing segment at ${startTime}:`, error);
          // Still create chunk with basic info
          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `[${formatSeconds(startTime)} - ${formatSeconds(endTime)}] ${description}`,
            tokens: estimateTokenCount(description),
            chunk_type: 'video_segment',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              keyMoment: description,
            },
          });
        }
      }
    } else {
      // Fall back to fixed-interval segments
      const segmentCount = Math.ceil(duration / VIDEO_SEGMENT_SECONDS);

      for (let i = 0; i < segmentCount; i++) {
        const startTime = i * VIDEO_SEGMENT_SECONDS;
        const endTime = Math.min((i + 1) * VIDEO_SEGMENT_SECONDS, duration);

        try {
          const segmentAnalysis = await generateContentWithFile(
            generateSegmentPrompt(startTime, endTime),
            uri,
            mimeType
          );

          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `[${formatSeconds(startTime)} - ${formatSeconds(endTime)}]\n\n${segmentAnalysis}`,
            tokens: estimateTokenCount(segmentAnalysis),
            chunk_type: 'video_segment',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              segmentIndex: i,
            },
          });
        } catch (error) {
          console.error(`Error analyzing segment ${i}:`, error);
          chunks.push({
            id: uuidv4(),
            workspace,
            document_id: documentId,
            chunk_order_index: i + 1,
            content: `Video segment from ${formatSeconds(startTime)} to ${formatSeconds(endTime)} could not be analyzed.`,
            tokens: 10,
            chunk_type: 'video_segment',
            timestamp_start: startTime,
            timestamp_end: endTime,
            metadata: {
              mimeType,
              segmentIndex: i,
              processingError: error instanceof Error ? error.message : 'Unknown error',
            },
          });
        }
      }
    }

    return chunks;
  } catch (error) {
    console.error('Error processing video:', error);

    // Return error chunk
    return [{
      id: uuidv4(),
      workspace,
      document_id: documentId,
      chunk_order_index: 0,
      content: 'Video could not be processed.',
      tokens: 5,
      chunk_type: 'video_segment',
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
 * Check if a file is a video type
 */
export function isVideoType(fileType: string): boolean {
  return ['mp4', 'webm', 'mov', 'avi'].includes(fileType.toLowerCase());
}
