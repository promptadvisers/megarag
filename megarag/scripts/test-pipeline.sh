#!/bin/bash

# MegaRAG Pipeline Test Script
# Tests upload and processing for all supported file types

BASE_URL="http://localhost:3000"
TEST_DIR="$(dirname "$0")/test-files"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo ""
echo "🚀 MegaRAG Pipeline Test"
echo "========================"
echo ""

# Check if server is running
if ! curl -s "$BASE_URL/api/documents" > /dev/null 2>&1; then
    echo -e "${RED}❌ Error: Server not running at $BASE_URL${NC}"
    echo "   Start the server with: npm run dev"
    exit 1
fi
echo -e "${GREEN}✓ Server is running${NC}"

# Create test directory
mkdir -p "$TEST_DIR"

# Create test files
echo ""
echo "📁 Creating test files..."

# TXT file
cat > "$TEST_DIR/test.txt" << 'EOF'
MegaRAG Test Document

This is a test document for the MegaRAG pipeline.
It contains information about AI and document processing.

Key features:
- Semantic search
- Multi-modal support
- Entity extraction
EOF
echo "  ✓ Created test.txt"

# Markdown file
cat > "$TEST_DIR/test.md" << 'EOF'
# MegaRAG Markdown Test

## Features
- **Bold text** and *italic text*
- Code: `inline code`

## Table
| Feature | Status |
|---------|--------|
| Upload | ✅ |
| Query | ✅ |
EOF
echo "  ✓ Created test.md"

# Function to upload and test a file
test_file() {
    local file=$1
    local filename=$(basename "$file")
    local ext="${filename##*.}"

    echo ""
    echo "📄 Testing $filename..."

    # Upload
    echo "  → Uploading..."
    RESPONSE=$(curl -s -X POST -F "file=@$file" "$BASE_URL/api/upload")
    DOC_ID=$(echo "$RESPONSE" | grep -o '"documentId":"[^"]*"' | cut -d'"' -f4)

    if [ -z "$DOC_ID" ]; then
        echo -e "  ${RED}✗ Upload failed${NC}"
        ERROR=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "    Error: $ERROR"
        return 1
    fi
    echo -e "  ${GREEN}✓ Uploaded (ID: $DOC_ID)${NC}"

    # Wait for processing
    echo "  → Processing..."
    for i in {1..30}; do
        STATUS_RESPONSE=$(curl -s "$BASE_URL/api/status/$DOC_ID")
        STATUS=$(echo "$STATUS_RESPONSE" | grep -o '"status":"[^"]*"' | cut -d'"' -f4)

        if [ "$STATUS" = "processed" ]; then
            CHUNKS=$(echo "$STATUS_RESPONSE" | grep -o '"chunksCount":[0-9]*' | cut -d':' -f2)
            echo -e "  ${GREEN}✓ Processed ($CHUNKS chunks)${NC}"

            # Test query
            echo "  → Querying..."
            QUERY_RESPONSE=$(curl -s -X POST \
                -H "Content-Type: application/json" \
                -d '{"query":"What is in this document?","mode":"mix"}' \
                "$BASE_URL/api/query")

            if echo "$QUERY_RESPONSE" | grep -q '"response"'; then
                echo -e "  ${GREEN}✓ Query successful${NC}"
                return 0
            else
                echo -e "  ${YELLOW}⚠ Query returned no results${NC}"
                return 0
            fi
        fi

        if [ "$STATUS" = "failed" ]; then
            ERROR=$(echo "$STATUS_RESPONSE" | grep -o '"errorMessage":"[^"]*"' | cut -d'"' -f4)
            echo -e "  ${RED}✗ Processing failed: $ERROR${NC}"
            return 1
        fi

        sleep 2
    done

    echo -e "  ${RED}✗ Timeout waiting for processing${NC}"
    return 1
}

# Run tests
PASSED=0
FAILED=0

for file in "$TEST_DIR"/*; do
    if [ -f "$file" ]; then
        if test_file "$file"; then
            ((PASSED++))
        else
            ((FAILED++))
        fi
    fi
done

# Summary
echo ""
echo "============================================"
echo "📊 TEST RESULTS"
echo "============================================"
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo "============================================"
echo ""

if [ $FAILED -eq 0 ]; then
    exit 0
else
    exit 1
fi
