import { generateContent, generateContentWithMedia } from '@/lib/gemini/client';

/**
 * Prompt for generating table descriptions
 */
const TABLE_DESCRIPTION_PROMPT = `Analyze this table and provide a comprehensive description.

Table content:
{table_markdown}

Include:
1. **Purpose**: What information does this table convey?
2. **Structure**: How many rows/columns? What are the headers?
3. **Key Data Points**: Highlight the most important values or trends
4. **Insights**: What conclusions can be drawn from this data?
5. **Context**: What questions could this table answer?

Format your response as a descriptive paragraph suitable for semantic search. Be concise but thorough.`;

/**
 * Prompt for generating image descriptions
 */
const IMAGE_DESCRIPTION_PROMPT = `Analyze this image and provide a detailed description for search and retrieval purposes.

Include:
1. **Main Subject**: What is the primary focus of the image?
2. **Visual Elements**: Describe key objects, people, text, colors, layout
3. **Context**: What setting or scenario does this represent?
4. **Technical Details**: If it's a chart/diagram/screenshot, describe the data or information shown
5. **Relevance**: What topics or queries might this image be relevant for?

Format your response as a single paragraph optimized for semantic search. Be descriptive and specific.`;

/**
 * Generate a description for a table using Gemini
 */
export async function describeTable(tableMarkdown: string): Promise<string> {
  try {
    const prompt = TABLE_DESCRIPTION_PROMPT.replace('{table_markdown}', tableMarkdown);
    const description = await generateContent(prompt);
    return description.trim();
  } catch (error) {
    console.error('Error generating table description:', error);
    // Return a basic description on error
    return `Table with data: ${tableMarkdown.slice(0, 200)}${tableMarkdown.length > 200 ? '...' : ''}`;
  }
}

/**
 * Generate a description for an image using Gemini Vision
 */
export async function describeImage(imageBase64: string): Promise<string> {
  try {
    // Determine MIME type from base64 header or default to PNG
    let mimeType = 'image/png';
    if (imageBase64.startsWith('data:')) {
      const match = imageBase64.match(/data:([^;]+);/);
      if (match) {
        mimeType = match[1];
        // Remove data URL prefix if present
        imageBase64 = imageBase64.split(',')[1] || imageBase64;
      }
    }

    const description = await generateContentWithMedia(
      IMAGE_DESCRIPTION_PROMPT,
      [{ mimeType, data: imageBase64 }]
    );

    return description.trim();
  } catch (error) {
    console.error('Error generating image description:', error);
    return 'Image content could not be analyzed.';
  }
}

/**
 * Generate a description for a mathematical equation
 */
export async function describeEquation(equationLatex: string): Promise<string> {
  try {
    const prompt = `Explain this mathematical equation in plain English. What does it represent and what are its components?

Equation: ${equationLatex}

Provide a clear, searchable description that explains the equation's purpose and meaning.`;

    const description = await generateContent(prompt);
    return description.trim();
  } catch (error) {
    console.error('Error generating equation description:', error);
    return `Mathematical equation: ${equationLatex}`;
  }
}
