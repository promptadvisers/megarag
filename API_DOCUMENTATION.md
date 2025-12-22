# MegaRAG API Documentation

Complete API reference for integrating MegaRAG with your admin panel or external applications.

**Base URL:** `https://your-domain.com` (or `http://localhost:3000` for local development)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Public Endpoints](#public-endpoints)
3. [Admin API](#admin-api)
4. [V1 API (API Key Auth)](#v1-api-api-key-auth)
5. [Response Format](#response-format)
6. [Error Codes](#error-codes)
7. [Rate Limits](#rate-limits)
8. [Code Examples](#code-examples)

---

## Authentication

MegaRAG uses two authentication methods:

### 1. Admin Session (Cookie-based)
For admin panel access. Login creates a secure HTTP-only cookie.

```bash
# Login
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "your-password"}' \
  -c cookies.txt

# Use session for subsequent requests
curl https://your-domain.com/api/admin/organizations \
  -b cookies.txt
```

### 2. API Key (Bearer Token)
For programmatic access to the V1 API.

```bash
curl https://your-domain.com/api/v1/documents \
  -H "Authorization: Bearer mr_live_xxxxxxxxxxxxxxxxxxxx"
```

---

## Public Endpoints

### Health Check

Check system status and service health.

```http
GET /api/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2025-12-21T01:00:00.000Z",
  "services": {
    "api": { "status": "healthy" },
    "database": { "status": "healthy", "latency_ms": 12 },
    "storage": { "status": "healthy", "latency_ms": 45 },
    "docling": { "status": "healthy", "latency_ms": 8 }
  },
  "uptime_seconds": 86400
}
```

**cURL Example:**
```bash
curl https://your-domain.com/api/health
```

---

## Admin API

All admin endpoints require session authentication (cookie-based).

### Authentication

#### Login

```http
POST /api/admin/login
```

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Login successful",
    "user": {
      "id": "uuid",
      "org_id": "uuid",
      "role": "owner"
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "secret"}' \
  -c cookies.txt
```

#### Logout

```http
POST /api/admin/logout
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/admin/logout -b cookies.txt
```

#### Check Session

```http
GET /api/admin/session
```

**Response:**
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "user": {
      "id": "uuid",
      "email": "admin@example.com",
      "role": "owner",
      "org_id": "uuid",
      "org_name": "My Organization"
    }
  }
}
```

---

### Organization Management

#### Get Organization

```http
GET /api/admin/organizations
```

**Response:**
```json
{
  "success": true,
  "data": {
    "organizations": [{
      "id": "uuid",
      "name": "My Organization",
      "slug": "my-org",
      "has_gemini_key": true,
      "settings": {},
      "created_at": "2025-12-20T10:00:00Z"
    }]
  }
}
```

#### Create Organization

```http
POST /api/admin/organizations
```

**Request Body:**
```json
{
  "name": "New Organization",
  "slug": "new-org",
  "admin_email": "admin@neworg.com",
  "admin_password": "secure-password",
  "gemini_api_key": "optional-gemini-key"
}
```

#### Update Organization

```http
PATCH /api/admin/organizations/{orgId}
```

**Request Body:**
```json
{
  "name": "Updated Name",
  "gemini_api_key": "new-api-key",
  "settings": {
    "max_file_size_mb": 200
  }
}
```

---

### Dashboard Statistics

```http
GET /api/admin/organizations/{orgId}/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": {
      "total": 150,
      "completed": 145,
      "processing": 3,
      "pending": 1,
      "failed": 1
    },
    "chunks": 12500,
    "entities": 3200,
    "relations": 8500,
    "chat_sessions": 45,
    "api_keys": 3,
    "usage": {
      "api_requests": 15000,
      "llm_calls": 2500,
      "embeddings": 8000,
      "storage_bytes": 524288000
    },
    "recent_documents": [
      {
        "id": "uuid",
        "file_name": "report.pdf",
        "file_type": "application/pdf",
        "status": "completed",
        "created_at": "2025-12-21T00:30:00Z"
      }
    ],
    "entity_types": [
      { "type": "PERSON", "count": 850 },
      { "type": "ORGANIZATION", "count": 620 },
      { "type": "LOCATION", "count": 480 }
    ]
  }
}
```

**cURL Example:**
```bash
curl https://your-domain.com/api/admin/organizations/{orgId}/stats \
  -b cookies.txt
```

---

### Usage Statistics

```http
GET /api/admin/organizations/{orgId}/usage
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| period | string | month | `month`, `week`, or `custom` |
| start_date | string | - | ISO date for custom period |
| end_date | string | - | ISO date for custom period |

**cURL Examples:**
```bash
# Current month usage
curl "https://your-domain.com/api/admin/organizations/{orgId}/usage" \
  -b cookies.txt

# Last 7 days
curl "https://your-domain.com/api/admin/organizations/{orgId}/usage?period=week" \
  -b cookies.txt

# Custom date range
curl "https://your-domain.com/api/admin/organizations/{orgId}/usage?period=custom&start_date=2025-12-01&end_date=2025-12-21" \
  -b cookies.txt
```

---

### API Key Management

#### List API Keys

```http
GET /api/admin/organizations/{orgId}/api-keys
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_keys": [
      {
        "id": "uuid",
        "key_prefix": "mr_live_abc",
        "name": "Production API Key",
        "scopes": ["read", "write"],
        "last_used_at": "2025-12-21T00:45:00Z",
        "expires_at": null,
        "created_at": "2025-12-01T10:00:00Z",
        "is_active": true
      }
    ]
  }
}
```

#### Create API Key

```http
POST /api/admin/organizations/{orgId}/api-keys
```

**Request Body:**
```json
{
  "name": "New API Key",
  "scopes": ["read", "write"],
  "expires_in_days": 90
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "api_key": {
      "id": "uuid",
      "key": "mr_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
      "key_prefix": "mr_live_xxx",
      "name": "New API Key",
      "scopes": ["read", "write"],
      "expires_at": "2025-03-21T00:00:00Z"
    },
    "message": "API key created. Store this key securely - it will not be shown again."
  }
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/admin/organizations/{orgId}/api-keys \
  -H "Content-Type: application/json" \
  -d '{"name": "My API Key", "scopes": ["read", "write"]}' \
  -b cookies.txt
```

#### Delete API Key

```http
DELETE /api/admin/organizations/{orgId}/api-keys/{keyId}
```

---

### Entity Management

#### List Entities

```http
GET /api/admin/organizations/{orgId}/entities
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page (max 100) |
| type | string | - | Filter by entity type |
| search | string | - | Search by name |

**Response:**
```json
{
  "success": true,
  "data": {
    "entities": [
      {
        "id": "uuid",
        "name": "John Smith",
        "entity_type": "PERSON",
        "description": "CEO of Acme Corp",
        "embedding": null,
        "source_chunk_ids": ["chunk-1", "chunk-2"],
        "workspace": "org-id",
        "created_at": "2025-12-20T15:00:00Z"
      }
    ],
    "available_types": ["PERSON", "ORGANIZATION", "LOCATION", "EVENT", "CONCEPT"],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 3200,
      "total_pages": 64
    }
  }
}
```

**cURL Examples:**
```bash
# List all entities
curl "https://your-domain.com/api/admin/organizations/{orgId}/entities" \
  -b cookies.txt

# Filter by type
curl "https://your-domain.com/api/admin/organizations/{orgId}/entities?type=PERSON" \
  -b cookies.txt

# Search by name
curl "https://your-domain.com/api/admin/organizations/{orgId}/entities?search=John" \
  -b cookies.txt
```

#### Bulk Delete Entities

```http
DELETE /api/admin/organizations/{orgId}/entities
```

**Request Body:**
```json
{
  "entity_ids": ["uuid-1", "uuid-2", "uuid-3"]
}
```

---

### Relation Management

#### List Relations

```http
GET /api/admin/organizations/{orgId}/relations
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page (max 100) |
| type | string | - | Filter by relation type |
| search | string | - | Search source/target/description |

**Response:**
```json
{
  "success": true,
  "data": {
    "relations": [
      {
        "id": "uuid",
        "source_entity": "John Smith",
        "target_entity": "Acme Corp",
        "relation_type": "WORKS_AT",
        "description": "John Smith is the CEO of Acme Corp",
        "source_chunk_ids": ["chunk-1"],
        "workspace": "org-id",
        "created_at": "2025-12-20T15:00:00Z"
      }
    ],
    "available_types": ["WORKS_AT", "LOCATED_IN", "PART_OF", "RELATED_TO"],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 8500,
      "total_pages": 170
    }
  }
}
```

#### Bulk Delete Relations

```http
DELETE /api/admin/organizations/{orgId}/relations
```

**Request Body:**
```json
{
  "relation_ids": ["uuid-1", "uuid-2"]
}
```

---

### Knowledge Graph

Get graph visualization data (nodes and edges).

```http
GET /api/admin/organizations/{orgId}/knowledge-graph
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| limit | number | 100 | Max nodes to return (max 500) |
| entity_type | string | - | Filter by entity type |
| center | string | - | Entity ID to center graph around |

**Response:**
```json
{
  "success": true,
  "data": {
    "nodes": [
      {
        "id": "uuid-1",
        "name": "John Smith",
        "type": "PERSON",
        "description": "CEO"
      },
      {
        "id": "uuid-2",
        "name": "Acme Corp",
        "type": "ORGANIZATION",
        "description": "Technology company"
      }
    ],
    "edges": [
      {
        "id": "rel-uuid",
        "source": "uuid-1",
        "target": "uuid-2",
        "type": "WORKS_AT",
        "description": "CEO of"
      }
    ],
    "available_entity_types": ["PERSON", "ORGANIZATION", "LOCATION"],
    "meta": {
      "node_count": 100,
      "edge_count": 250,
      "limit_applied": 100
    }
  }
}
```

**cURL Examples:**
```bash
# Full graph (limited)
curl "https://your-domain.com/api/admin/organizations/{orgId}/knowledge-graph" \
  -b cookies.txt

# Center on specific entity
curl "https://your-domain.com/api/admin/organizations/{orgId}/knowledge-graph?center=entity-uuid" \
  -b cookies.txt

# Filter by entity type
curl "https://your-domain.com/api/admin/organizations/{orgId}/knowledge-graph?entity_type=PERSON&limit=50" \
  -b cookies.txt
```

---

## V1 API (API Key Auth)

Production API endpoints for programmatic access. All endpoints require API key authentication.

### Documents

#### Upload Document

```http
POST /api/v1/documents
Content-Type: multipart/form-data
Authorization: Bearer {api_key}
```

**Form Data:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| file | File | Yes | Document file to upload |

**Supported File Types:**
- Documents: PDF, DOCX, PPTX, XLSX
- Text: TXT, MD
- Images: JPG, PNG, GIF, WebP
- Video: MP4, WebM, MOV
- Audio: MP3, WAV, OGG, FLAC, M4A, AAC

**Max File Size:** 100MB (configurable)

**Response:**
```json
{
  "success": true,
  "data": {
    "document_id": "uuid",
    "file_name": "report.pdf",
    "file_type": "application/pdf",
    "file_size": 1048576,
    "status": "pending",
    "message": "Document uploaded and processing started"
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/v1/documents \
  -H "Authorization: Bearer mr_live_xxxx" \
  -F "file=@/path/to/document.pdf"
```

#### List Documents

```http
GET /api/v1/documents
Authorization: Bearer {api_key}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 50 | Items per page (max 100) |
| status | string | - | Filter by status |

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "uuid",
        "file_name": "report.pdf",
        "file_type": "application/pdf",
        "file_size": 1048576,
        "status": "completed",
        "metadata": {},
        "created_at": "2025-12-20T10:00:00Z",
        "updated_at": "2025-12-20T10:05:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "total_pages": 3
    }
  }
}
```

**cURL Example:**
```bash
curl "https://your-domain.com/api/v1/documents?status=completed" \
  -H "Authorization: Bearer mr_live_xxxx"
```

#### Get Document

```http
GET /api/v1/documents/{id}
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "document": {
      "id": "uuid",
      "file_name": "report.pdf",
      "file_type": "application/pdf",
      "file_size": 1048576,
      "status": "completed",
      "metadata": {},
      "stats": {
        "chunks_count": 45,
        "entities_count": 12
      },
      "created_at": "2025-12-20T10:00:00Z"
    }
  }
}
```

#### Delete Document

```http
DELETE /api/v1/documents/{id}
Authorization: Bearer {api_key}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true,
    "document_id": "uuid"
  }
}
```

---

### RAG Query

Execute a RAG query against your document collection.

```http
POST /api/v1/query
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "What are the main revenue drivers mentioned in the reports?",
  "mode": "mix",
  "top_k": 10,
  "system_prompt": "You are a financial analyst assistant.",
  "model": "gemini-2.5-flash"
}
```

**Parameters:**
| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| query | string | Yes | - | The question to answer |
| mode | string | No | mix | Query mode (see below) |
| top_k | number | No | 10 | Number of results (1-50) |
| system_prompt | string | No | - | Custom system prompt |
| model | string | No | gemini-2.5-flash | LLM model to use |

**Query Modes:**
| Mode | Description |
|------|-------------|
| naive | Vector search on chunks only |
| local | Search entities, get related chunks |
| global | Search relations, traverse knowledge graph |
| hybrid | Combine local + global |
| mix | Full hybrid (chunks + entities + relations) - **recommended** |

**Response:**
```json
{
  "success": true,
  "data": {
    "response": "Based on the documents, the main revenue drivers are...",
    "sources": [
      {
        "document_id": "uuid",
        "document_name": "Q4 Report.pdf",
        "chunk_id": "chunk-uuid",
        "content": "Revenue increased 25% driven by...",
        "score": 0.92
      }
    ],
    "entities": [
      {
        "name": "Q4 2024",
        "type": "DATE",
        "relevance": 0.95
      }
    ],
    "mode_used": "mix"
  },
  "meta": {
    "request_id": "uuid",
    "usage": {
      "input_tokens": 1250,
      "output_tokens": 450
    }
  }
}
```

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/v1/query \
  -H "Authorization: Bearer mr_live_xxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the key findings?",
    "mode": "mix",
    "top_k": 5
  }'
```

---

### Chat Sessions

#### Create Chat Session

```http
POST /api/v1/chat
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Financial Analysis Chat",
  "system_prompt": "You are a helpful financial analyst.",
  "model": "gemini-2.5-flash"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "session_id": "uuid",
    "title": "Financial Analysis Chat",
    "system_prompt": "You are a helpful financial analyst.",
    "model": "gemini-2.5-flash"
  }
}
```

#### List Chat Sessions

```http
GET /api/v1/chat
Authorization: Bearer {api_key}
```

**Query Parameters:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| page | number | 1 | Page number |
| limit | number | 20 | Items per page (max 50) |

#### Get Chat Session

```http
GET /api/v1/chat/{sessionId}
Authorization: Bearer {api_key}
```

#### Delete Chat Session

```http
DELETE /api/v1/chat/{sessionId}
Authorization: Bearer {api_key}
```

#### Send Message

```http
POST /api/v1/chat/{sessionId}/messages
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "Summarize the Q4 financial performance",
  "mode": "mix",
  "top_k": 10
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_message": {
      "id": "uuid",
      "role": "user",
      "content": "Summarize the Q4 financial performance"
    },
    "assistant_message": {
      "id": "uuid",
      "role": "assistant",
      "content": "Based on the documents, Q4 showed...",
      "sources": [...],
      "entities": [...]
    }
  }
}
```

#### Get Messages

```http
GET /api/v1/chat/{sessionId}/messages
Authorization: Bearer {api_key}
```

---

## Response Format

All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "usage": { ... }
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message",
    "details": { ... }
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| INVALID_REQUEST | 400 | Invalid request parameters |
| UNAUTHORIZED | 401 | Missing or invalid authentication |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| RATE_LIMIT_EXCEEDED | 429 | Too many requests |
| GEMINI_KEY_MISSING | 400 | Organization Gemini key not configured |
| SERVER_ERROR | 500 | Internal server error |

---

## Rate Limits

Rate limits are applied per organization:

| Tier | API Requests/min | Uploads/hour | Query Requests/min |
|------|------------------|--------------|-------------------|
| Free | 60 | 10 | 20 |
| Pro | 300 | 100 | 100 |
| Enterprise | Unlimited | Unlimited | Unlimited |

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 1703145600
```

---

## Code Examples

### JavaScript/TypeScript

```typescript
const MEGARAG_API_KEY = 'mr_live_xxxxxxxxxxxx';
const BASE_URL = 'https://your-domain.com';

// Upload a document
async function uploadDocument(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${BASE_URL}/api/v1/documents`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MEGARAG_API_KEY}`,
    },
    body: formData,
  });

  return response.json();
}

// Query documents
async function query(question: string, mode = 'mix') {
  const response = await fetch(`${BASE_URL}/api/v1/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${MEGARAG_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query: question,
      mode,
      top_k: 10,
    }),
  });

  return response.json();
}

// Usage
const result = await query('What are the main topics in my documents?');
console.log(result.data.response);
```

### Python

```python
import requests

MEGARAG_API_KEY = 'mr_live_xxxxxxxxxxxx'
BASE_URL = 'https://your-domain.com'

headers = {
    'Authorization': f'Bearer {MEGARAG_API_KEY}',
}

# Upload a document
def upload_document(file_path: str):
    with open(file_path, 'rb') as f:
        files = {'file': f}
        response = requests.post(
            f'{BASE_URL}/api/v1/documents',
            headers=headers,
            files=files
        )
    return response.json()

# Query documents
def query(question: str, mode: str = 'mix'):
    response = requests.post(
        f'{BASE_URL}/api/v1/query',
        headers={**headers, 'Content-Type': 'application/json'},
        json={
            'query': question,
            'mode': mode,
            'top_k': 10
        }
    )
    return response.json()

# Usage
result = query('What are the main topics in my documents?')
print(result['data']['response'])
```

### cURL Quick Reference

```bash
# Set your API key
export MEGARAG_API_KEY="mr_live_xxxxxxxxxxxx"
export MEGARAG_URL="https://your-domain.com"

# Upload document
curl -X POST "$MEGARAG_URL/api/v1/documents" \
  -H "Authorization: Bearer $MEGARAG_API_KEY" \
  -F "file=@document.pdf"

# List documents
curl "$MEGARAG_URL/api/v1/documents" \
  -H "Authorization: Bearer $MEGARAG_API_KEY"

# Query
curl -X POST "$MEGARAG_URL/api/v1/query" \
  -H "Authorization: Bearer $MEGARAG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "Summarize the documents", "mode": "mix"}'

# Create chat session
curl -X POST "$MEGARAG_URL/api/v1/chat" \
  -H "Authorization: Bearer $MEGARAG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "My Chat"}'

# Send message
curl -X POST "$MEGARAG_URL/api/v1/chat/{session_id}/messages" \
  -H "Authorization: Bearer $MEGARAG_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello, what can you tell me about the documents?"}'
```

---

## Admin Panel Integration Guide

### Step 1: Create Organization & Get API Key

```bash
# 1. Create organization (public endpoint)
curl -X POST https://your-domain.com/api/admin/organizations \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Company",
    "slug": "my-company",
    "admin_email": "admin@mycompany.com",
    "admin_password": "secure-password",
    "gemini_api_key": "your-gemini-key"
  }'

# 2. Login to get session
curl -X POST https://your-domain.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@mycompany.com", "password": "secure-password"}' \
  -c cookies.txt

# 3. Create API key for programmatic access
curl -X POST "https://your-domain.com/api/admin/organizations/{orgId}/api-keys" \
  -H "Content-Type: application/json" \
  -d '{"name": "Production Key", "scopes": ["read", "write"]}' \
  -b cookies.txt
```

### Step 2: Dashboard Data Fetching

```javascript
// Fetch all dashboard data
async function fetchDashboard(orgId: string) {
  const [stats, usage, recentDocs] = await Promise.all([
    fetch(`/api/admin/organizations/${orgId}/stats`).then(r => r.json()),
    fetch(`/api/admin/organizations/${orgId}/usage`).then(r => r.json()),
    fetch(`/api/v1/documents?limit=10`).then(r => r.json()),
  ]);

  return {
    stats: stats.data,
    usage: usage.data,
    recentDocs: recentDocs.data.documents,
  };
}
```

### Step 3: Knowledge Graph Visualization

```javascript
// Fetch graph data for D3.js / vis.js / cytoscape
async function fetchKnowledgeGraph(orgId: string, options = {}) {
  const params = new URLSearchParams({
    limit: options.limit || 100,
    ...(options.entityType && { entity_type: options.entityType }),
    ...(options.centerEntity && { center: options.centerEntity }),
  });

  const response = await fetch(
    `/api/admin/organizations/${orgId}/knowledge-graph?${params}`
  );
  const { data } = await response.json();

  // Transform for visualization library
  return {
    nodes: data.nodes.map(n => ({
      id: n.id,
      label: n.name,
      group: n.type,
      title: n.description,
    })),
    edges: data.edges.map(e => ({
      from: e.source,
      to: e.target,
      label: e.type,
      title: e.description,
    })),
  };
}
```

---

## Webhooks (Coming Soon)

Configure webhooks to receive real-time notifications:

- `document.uploaded` - Document upload started
- `document.processed` - Document processing completed
- `document.failed` - Document processing failed
- `query.completed` - Query completed
- `usage.threshold` - Usage threshold reached

---

## Support

- **Documentation:** https://your-domain.com/docs
- **API Status:** https://your-domain.com/api/health
- **Support Email:** support@your-domain.com
