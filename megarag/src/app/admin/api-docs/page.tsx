'use client';

import { useState } from 'react';
import {
  BookOpen,
  Copy,
  Check,
  ChevronRight,
  FileText,
  MessageSquare,
  Search,
  Key,
  Activity,
  Users,
  GitBranch,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

interface EndpointDoc {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  auth: 'API Key' | 'Session';
  example?: {
    request?: string;
    response?: string;
  };
}

const endpoints: Record<string, EndpointDoc[]> = {
  documents: [
    {
      method: 'POST',
      path: '/api/v1/documents',
      description: 'Upload a new document for processing',
      auth: 'API Key',
      example: {
        request: `curl -X POST https://your-domain.com/api/v1/documents \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@document.pdf"`,
        response: `{
  "success": true,
  "data": {
    "document_id": "abc123",
    "file_name": "document.pdf",
    "status": "pending"
  }
}`,
      },
    },
    {
      method: 'GET',
      path: '/api/v1/documents',
      description: 'List all documents with pagination',
      auth: 'API Key',
      example: {
        request: `curl https://your-domain.com/api/v1/documents?page=1&limit=20 \\
  -H "Authorization: Bearer YOUR_API_KEY"`,
      },
    },
    {
      method: 'GET',
      path: '/api/v1/documents/:id',
      description: 'Get details for a specific document',
      auth: 'API Key',
    },
    {
      method: 'DELETE',
      path: '/api/v1/documents/:id',
      description: 'Delete a document and all associated data',
      auth: 'API Key',
    },
  ],
  query: [
    {
      method: 'POST',
      path: '/api/v1/query',
      description: 'Execute a RAG query against your documents',
      auth: 'API Key',
      example: {
        request: `curl -X POST https://your-domain.com/api/v1/query \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What are the main topics?",
    "mode": "mix",
    "top_k": 10
  }'`,
        response: `{
  "success": true,
  "data": {
    "response": "Based on the documents...",
    "sources": [...],
    "entities": [...],
    "mode_used": "mix"
  }
}`,
      },
    },
  ],
  chat: [
    {
      method: 'POST',
      path: '/api/v1/chat',
      description: 'Create a new chat session',
      auth: 'API Key',
    },
    {
      method: 'GET',
      path: '/api/v1/chat',
      description: 'List all chat sessions',
      auth: 'API Key',
    },
    {
      method: 'POST',
      path: '/api/v1/chat/:sessionId/messages',
      description: 'Send a message in a chat session',
      auth: 'API Key',
      example: {
        request: `curl -X POST https://your-domain.com/api/v1/chat/SESSION_ID/messages \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"message": "Summarize the documents"}'`,
      },
    },
  ],
  admin: [
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/stats',
      description: 'Get dashboard statistics',
      auth: 'Session',
    },
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/usage',
      description: 'Get usage statistics',
      auth: 'Session',
    },
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/entities',
      description: 'List entities with filtering',
      auth: 'Session',
    },
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/relations',
      description: 'List relations with filtering',
      auth: 'Session',
    },
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/knowledge-graph',
      description: 'Get knowledge graph data for visualization',
      auth: 'Session',
    },
    {
      method: 'GET',
      path: '/api/admin/organizations/:orgId/api-keys',
      description: 'List API keys',
      auth: 'Session',
    },
    {
      method: 'POST',
      path: '/api/admin/organizations/:orgId/api-keys',
      description: 'Create a new API key',
      auth: 'Session',
    },
  ],
};

const methodColors: Record<string, string> = {
  GET: 'bg-green-500',
  POST: 'bg-blue-500',
  DELETE: 'bg-red-500',
  PATCH: 'bg-yellow-500',
};

export default function AdminApiDocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, id }: { code: string; id: string }) => (
    <div className="relative">
      <pre className="bg-[#0a0a0a] text-sm p-4 rounded-lg overflow-x-auto">
        <code className="text-gray-300">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2"
        onClick={() => copyToClipboard(code, id)}
      >
        {copiedCode === id ? (
          <Check className="h-4 w-4 text-green-500" />
        ) : (
          <Copy className="h-4 w-4" />
        )}
      </Button>
    </div>
  );

  const EndpointCard = ({ endpoint, category, index }: { endpoint: EndpointDoc; category: string; index: number }) => (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Badge className={methodColors[endpoint.method]}>{endpoint.method}</Badge>
        <code className="text-sm font-mono">{endpoint.path}</code>
        <Badge variant="outline" className="ml-auto">
          {endpoint.auth}
        </Badge>
      </div>
      <p className="text-muted-foreground">{endpoint.description}</p>

      {endpoint.example && (
        <div className="space-y-2">
          {endpoint.example.request && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Request</p>
              <CodeBlock code={endpoint.example.request} id={`${category}-${index}-req`} />
            </div>
          )}
          {endpoint.example.response && (
            <div>
              <p className="text-xs text-muted-foreground mb-1">Response</p>
              <CodeBlock code={endpoint.example.response} id={`${category}-${index}-res`} />
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <BookOpen className="h-8 w-8" />
          API Documentation
        </h1>
        <p className="text-muted-foreground mt-1">
          Complete reference for integrating MegaRAG into your applications
        </p>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>Get started with the MegaRAG API in minutes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Key className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">1. Get API Key</p>
                <p className="text-sm text-muted-foreground">
                  Create an API key in the API Keys section
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-primary/10 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">2. Upload Documents</p>
                <p className="text-sm text-muted-foreground">
                  POST files to /api/v1/documents
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 border rounded-lg">
              <div className="bg-primary/10 p-2 rounded-lg">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">3. Query Documents</p>
                <p className="text-sm text-muted-foreground">
                  POST queries to /api/v1/query
                </p>
              </div>
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Base URL</p>
            <CodeBlock
              code={`https://your-domain.com/api/v1`}
              id="base-url"
            />
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-2">Authentication</p>
            <CodeBlock
              code={`curl https://your-domain.com/api/v1/documents \\
  -H "Authorization: Bearer YOUR_API_KEY"`}
              id="auth-example"
            />
          </div>
        </CardContent>
      </Card>

      {/* Endpoints */}
      <Tabs defaultValue="documents" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Documents
          </TabsTrigger>
          <TabsTrigger value="query" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Query
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="admin" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Admin
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Document Endpoints
              </CardTitle>
              <CardDescription>Upload, list, and manage documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoints.documents.map((ep, i) => (
                <EndpointCard key={i} endpoint={ep} category="documents" index={i} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="query" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Query Endpoints
              </CardTitle>
              <CardDescription>Execute RAG queries against your documents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 p-4 rounded-lg mb-4">
                <p className="font-medium mb-2">Query Modes</p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
                  <div className="p-2 bg-background rounded border">
                    <p className="font-medium">naive</p>
                    <p className="text-xs text-muted-foreground">Vector search only</p>
                  </div>
                  <div className="p-2 bg-background rounded border">
                    <p className="font-medium">local</p>
                    <p className="text-xs text-muted-foreground">Entity-focused</p>
                  </div>
                  <div className="p-2 bg-background rounded border">
                    <p className="font-medium">global</p>
                    <p className="text-xs text-muted-foreground">Relation-focused</p>
                  </div>
                  <div className="p-2 bg-background rounded border">
                    <p className="font-medium">hybrid</p>
                    <p className="text-xs text-muted-foreground">Local + Global</p>
                  </div>
                  <div className="p-2 bg-primary/10 rounded border border-primary">
                    <p className="font-medium">mix</p>
                    <p className="text-xs text-muted-foreground">Full hybrid (recommended)</p>
                  </div>
                </div>
              </div>
              {endpoints.query.map((ep, i) => (
                <EndpointCard key={i} endpoint={ep} category="query" index={i} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Chat Endpoints
              </CardTitle>
              <CardDescription>Manage chat sessions and messages</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoints.chat.map((ep, i) => (
                <EndpointCard key={i} endpoint={ep} category="chat" index={i} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="admin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Admin Endpoints
              </CardTitle>
              <CardDescription>Organization management and analytics (session auth required)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {endpoints.admin.map((ep, i) => (
                <EndpointCard key={i} endpoint={ep} category="admin" index={i} />
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* SDK Examples */}
      <Card>
        <CardHeader>
          <CardTitle>SDK Examples</CardTitle>
          <CardDescription>Quick code snippets in popular languages</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="javascript">
            <TabsList>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="curl">cURL</TabsTrigger>
            </TabsList>

            <TabsContent value="javascript" className="mt-4">
              <CodeBlock
                code={`// Upload a document
const formData = new FormData();
formData.append('file', file);

const uploadRes = await fetch('/api/v1/documents', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${API_KEY}\` },
  body: formData,
});

// Query documents
const queryRes = await fetch('/api/v1/query', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${API_KEY}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    query: 'What are the main topics?',
    mode: 'mix',
    top_k: 10,
  }),
});

const result = await queryRes.json();
console.log(result.data.response);`}
                id="js-example"
              />
            </TabsContent>

            <TabsContent value="python" className="mt-4">
              <CodeBlock
                code={`import requests

API_KEY = 'your_api_key'
BASE_URL = 'https://your-domain.com'

headers = {'Authorization': f'Bearer {API_KEY}'}

# Upload a document
with open('document.pdf', 'rb') as f:
    res = requests.post(
        f'{BASE_URL}/api/v1/documents',
        headers=headers,
        files={'file': f}
    )

# Query documents
res = requests.post(
    f'{BASE_URL}/api/v1/query',
    headers={**headers, 'Content-Type': 'application/json'},
    json={
        'query': 'What are the main topics?',
        'mode': 'mix',
        'top_k': 10
    }
)

print(res.json()['data']['response'])`}
                id="python-example"
              />
            </TabsContent>

            <TabsContent value="curl" className="mt-4">
              <CodeBlock
                code={`# Set your API key
export API_KEY="your_api_key"

# Upload a document
curl -X POST https://your-domain.com/api/v1/documents \\
  -H "Authorization: Bearer $API_KEY" \\
  -F "file=@document.pdf"

# Query documents
curl -X POST https://your-domain.com/api/v1/query \\
  -H "Authorization: Bearer $API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "What are the main topics?",
    "mode": "mix",
    "top_k": 10
  }'`}
                id="curl-example"
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Response Format */}
      <Card>
        <CardHeader>
          <CardTitle>Response Format</CardTitle>
          <CardDescription>All API responses follow a consistent format</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm font-medium mb-2 text-green-500">Success Response</p>
            <CodeBlock
              code={`{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "uuid",
    "usage": {
      "input_tokens": 100,
      "output_tokens": 50
    }
  }
}`}
              id="success-format"
            />
          </div>
          <div>
            <p className="text-sm font-medium mb-2 text-red-500">Error Response</p>
            <CodeBlock
              code={`{
  "success": false,
  "error": {
    "code": "INVALID_REQUEST",
    "message": "Query is required",
    "details": { ... }
  },
  "meta": {
    "request_id": "uuid"
  }
}`}
              id="error-format"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
