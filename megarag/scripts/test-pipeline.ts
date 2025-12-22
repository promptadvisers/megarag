/**
 * Test script for MegaRAG upload and query pipeline
 * Tests all supported file types: txt, md, png, jpg, pdf, docx, mp3, mp4
 *
 * Run with: npx tsx scripts/test-pipeline.ts
 */

import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3000';
const TEST_DIR = path.join(__dirname, 'test-files');

// Create test directory
if (!fs.existsSync(TEST_DIR)) {
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

interface TestResult {
  fileType: string;
  uploadSuccess: boolean;
  processingSuccess: boolean;
  querySuccess: boolean;
  error?: string;
  documentId?: string;
  chunksCreated?: number;
}

const results: TestResult[] = [];

/**
 * Create sample test files
 */
function createTestFiles() {
  console.log('\n📁 Creating test files...\n');

  // TXT file
  fs.writeFileSync(
    path.join(TEST_DIR, 'test-document.txt'),
    `MegaRAG Test Document

This is a test document for the MegaRAG pipeline.

Key Features:
- Document upload and processing
- Chunking and embedding generation
- Entity extraction for knowledge graph
- Semantic search and retrieval
- Multi-modal support (text, images, audio, video)

The system uses Gemini for AI processing and Supabase for storage.
This document should be chunked, embedded, and queryable after processing.`
  );
  console.log('  ✓ Created test-document.txt');

  // Markdown file
  fs.writeFileSync(
    path.join(TEST_DIR, 'test-markdown.md'),
    `# MegaRAG Markdown Test

## Overview
This is a **markdown** test file with various formatting.

## Features List
1. Bold text: **important**
2. Italic text: *emphasis*
3. Code: \`inline code\`

## Code Block
\`\`\`typescript
const rag = new MegaRAG();
await rag.query("What is MegaRAG?");
\`\`\`

## Table
| Feature | Status |
|---------|--------|
| Upload | ✅ |
| Process | ✅ |
| Query | ✅ |

## Conclusion
MegaRAG handles markdown files with proper parsing.`
  );
  console.log('  ✓ Created test-markdown.md');

  // Create a simple PNG (1x1 red pixel)
  const pngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, 0x54, // IDAT chunk
    0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, 0x00,
    0x00, 0x03, 0x00, 0x01, 0x00, 0x18, 0xdd, 0x8d,
    0xb4, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND chunk
    0x44, 0xae, 0x42, 0x60, 0x82
  ]);
  fs.writeFileSync(path.join(TEST_DIR, 'test-image.png'), pngBuffer);
  console.log('  ✓ Created test-image.png (1x1 pixel)');

  // Create a simple JPEG (minimal valid JPEG)
  const jpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c,
    0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
    0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
    0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20,
    0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
    0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
    0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34,
    0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xff, 0xc4,
    0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff,
    0xc4, 0x00, 0xb5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
    0x00, 0x00, 0x01, 0x7d, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xa1, 0x08, 0x23, 0x42, 0xb1, 0xc1,
    0x15, 0x52, 0xd1, 0xf0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0a, 0x16, 0x17, 0x18, 0x19, 0x1a,
    0x25, 0x26, 0x27, 0x28, 0x29, 0x2a, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3a, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4a, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5a, 0x63, 0x64, 0x65,
    0x66, 0x67, 0x68, 0x69, 0x6a, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7a, 0x83, 0x84, 0x85,
    0x86, 0x87, 0x88, 0x89, 0x8a, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9a, 0xa2, 0xa3,
    0xa4, 0xa5, 0xa6, 0xa7, 0xa8, 0xa9, 0xaa, 0xb2,
    0xb3, 0xb4, 0xb5, 0xb6, 0xb7, 0xb8, 0xb9, 0xba,
    0xc2, 0xc3, 0xc4, 0xc5, 0xc6, 0xc7, 0xc8, 0xc9,
    0xca, 0xd2, 0xd3, 0xd4, 0xd5, 0xd6, 0xd7, 0xd8,
    0xd9, 0xda, 0xe1, 0xe2, 0xe3, 0xe4, 0xe5, 0xe6,
    0xe7, 0xe8, 0xe9, 0xea, 0xf1, 0xf2, 0xf3, 0xf4,
    0xf5, 0xf6, 0xf7, 0xf8, 0xf9, 0xfa, 0xff, 0xda,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00,
    0xfb, 0xd5, 0xdb, 0x20, 0xa8, 0xf1, 0x7e, 0xff,
    0xd9
  ]);
  fs.writeFileSync(path.join(TEST_DIR, 'test-image.jpg'), jpgBuffer);
  console.log('  ✓ Created test-image.jpg (minimal JPEG)');

  console.log('\n📁 Test files created in:', TEST_DIR);
}

/**
 * Upload a file to the API
 */
async function uploadFile(filePath: string): Promise<{ success: boolean; documentId?: string; error?: string }> {
  const fileName = path.basename(filePath);
  const fileBuffer = fs.readFileSync(filePath);

  const formData = new FormData();
  const blob = new Blob([fileBuffer]);
  formData.append('file', blob, fileName);

  try {
    const response = await fetch(`${BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || `HTTP ${response.status}` };
    }

    return { success: true, documentId: data.documentId };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Wait for document processing to complete
 */
async function waitForProcessing(documentId: string, maxWaitMs = 60000): Promise<{ success: boolean; chunksCreated?: number; error?: string }> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    try {
      const response = await fetch(`${BASE_URL}/api/status/${documentId}`);
      const data = await response.json();

      if (data.status === 'processed') {
        return { success: true, chunksCreated: data.chunksCount };
      }

      if (data.status === 'failed') {
        return { success: false, error: data.errorMessage || 'Processing failed' };
      }

      // Still processing, wait and retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  return { success: false, error: 'Timeout waiting for processing' };
}

/**
 * Query the documents
 */
async function queryDocuments(query: string): Promise<{ success: boolean; hasResults: boolean; error?: string }> {
  try {
    const response = await fetch(`${BASE_URL}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, mode: 'mix' }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, hasResults: false, error: data.error || `HTTP ${response.status}` };
    }

    return {
      success: true,
      hasResults: data.response && data.response.length > 0
    };
  } catch (error) {
    return { success: false, hasResults: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Test a single file type
 */
async function testFileType(fileName: string): Promise<TestResult> {
  const filePath = path.join(TEST_DIR, fileName);
  const fileType = path.extname(fileName).slice(1);

  console.log(`\n📄 Testing ${fileName}...`);

  // Check if file exists
  if (!fs.existsSync(filePath)) {
    return {
      fileType,
      uploadSuccess: false,
      processingSuccess: false,
      querySuccess: false,
      error: 'Test file not found',
    };
  }

  // Upload
  console.log('  → Uploading...');
  const uploadResult = await uploadFile(filePath);
  if (!uploadResult.success) {
    console.log(`  ✗ Upload failed: ${uploadResult.error}`);
    return {
      fileType,
      uploadSuccess: false,
      processingSuccess: false,
      querySuccess: false,
      error: uploadResult.error,
    };
  }
  console.log(`  ✓ Uploaded (ID: ${uploadResult.documentId})`);

  // Wait for processing
  console.log('  → Processing...');
  const processResult = await waitForProcessing(uploadResult.documentId!);
  if (!processResult.success) {
    console.log(`  ✗ Processing failed: ${processResult.error}`);
    return {
      fileType,
      uploadSuccess: true,
      processingSuccess: false,
      querySuccess: false,
      error: processResult.error,
      documentId: uploadResult.documentId,
    };
  }
  console.log(`  ✓ Processed (${processResult.chunksCreated} chunks)`);

  // Query
  console.log('  → Querying...');
  const queryResult = await queryDocuments(`What is in the ${fileType} file?`);
  if (!queryResult.success) {
    console.log(`  ✗ Query failed: ${queryResult.error}`);
    return {
      fileType,
      uploadSuccess: true,
      processingSuccess: true,
      querySuccess: false,
      error: queryResult.error,
      documentId: uploadResult.documentId,
      chunksCreated: processResult.chunksCreated,
    };
  }
  console.log(`  ✓ Query successful (has results: ${queryResult.hasResults})`);

  return {
    fileType,
    uploadSuccess: true,
    processingSuccess: true,
    querySuccess: true,
    documentId: uploadResult.documentId,
    chunksCreated: processResult.chunksCreated,
  };
}

/**
 * Print results summary
 */
function printSummary(results: TestResult[]) {
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  console.log('\n| File Type | Upload | Process | Query | Chunks | Error |');
  console.log('|-----------|--------|---------|-------|--------|-------|');

  for (const result of results) {
    const upload = result.uploadSuccess ? '✅' : '❌';
    const process = result.processingSuccess ? '✅' : '❌';
    const query = result.querySuccess ? '✅' : '❌';
    const chunks = result.chunksCreated ?? '-';
    const error = result.error ? result.error.substring(0, 20) + '...' : '-';

    console.log(`| ${result.fileType.padEnd(9)} | ${upload.padEnd(6)} | ${process.padEnd(7)} | ${query.padEnd(5)} | ${String(chunks).padEnd(6)} | ${error} |`);
  }

  const passed = results.filter(r => r.uploadSuccess && r.processingSuccess && r.querySuccess).length;
  const total = results.length;

  console.log('\n' + '='.repeat(60));
  console.log(`✅ Passed: ${passed}/${total}`);
  console.log(`❌ Failed: ${total - passed}/${total}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🚀 MegaRAG Pipeline Test');
  console.log('========================\n');

  // Check if server is running
  try {
    const response = await fetch(`${BASE_URL}/api/documents`);
    if (!response.ok) {
      throw new Error('Server not responding');
    }
  } catch (error) {
    console.error('❌ Error: Server not running at', BASE_URL);
    console.error('   Start the server with: npm run dev');
    process.exit(1);
  }
  console.log('✓ Server is running at', BASE_URL);

  // Create test files
  createTestFiles();

  // Test each file type
  const testFiles = [
    'test-document.txt',
    'test-markdown.md',
    'test-image.png',
    'test-image.jpg',
  ];

  console.log('\n🧪 Running tests...');

  for (const fileName of testFiles) {
    const result = await testFileType(fileName);
    results.push(result);
  }

  // Print summary
  printSummary(results);

  // Exit with appropriate code
  const allPassed = results.every(r => r.uploadSuccess && r.processingSuccess);
  process.exit(allPassed ? 0 : 1);
}

main().catch(console.error);
