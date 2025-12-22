'use client';

import { useEffect, useState } from 'react';
import { Settings, Eye, EyeOff, Loader2, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Organization {
  id: string;
  name: string;
  slug: string;
  has_gemini_key: boolean;
}

export default function SettingsPage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [geminiKey, setGeminiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sessionRes = await fetch('/api/admin/session');
      const sessionData = await sessionRes.json();
      if (!sessionData.success) {
        // No session - user needs to log in, handled gracefully
        return;
      }

      const orgId = sessionData.data.organization.id;

      const orgRes = await fetch(`/api/admin/organizations/${orgId}`);
      const orgData = await orgRes.json();
      if (orgData.success) {
        setOrg(orgData.data.organization);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveGeminiKey = async () => {
    if (!org) return;

    setIsSaving(true);
    setError('');
    setSaveSuccess(false);

    try {
      const res = await fetch(`/api/admin/organizations/${org.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gemini_api_key: geminiKey || null }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to save');
      }

      setSaveSuccess(true);
      setGeminiKey('');
      setOrg((prev) => prev ? { ...prev, has_gemini_key: !!geminiKey } : null);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">
          Configure your organization settings
        </p>
      </div>

      {/* Organization Info */}
      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
          <CardDescription>
            Your organization information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              <p className="font-medium">{org?.name}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Slug</Label>
              <p className="font-mono">{org?.slug}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gemini API Key */}
      <Card>
        <CardHeader>
          <CardTitle>Gemini API Key</CardTitle>
          <CardDescription>
            Configure your Google Gemini API key for LLM and embedding operations
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {org?.has_gemini_key ? (
            <div className="flex items-center gap-2 p-3 bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-400 rounded-lg">
              <Check className="h-5 w-5" />
              <span>Gemini API key is configured</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/20 text-yellow-700 dark:text-yellow-400 rounded-lg">
              <AlertTriangle className="h-5 w-5" />
              <span>No Gemini API key configured. API queries will fail.</span>
            </div>
          )}

          {error && (
            <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">
              {error}
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 text-sm text-green-500 bg-green-50 dark:bg-green-950/20 rounded-lg">
              Settings saved successfully!
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="geminiKey">
              {org?.has_gemini_key ? 'Update' : 'Set'} Gemini API Key
            </Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  id="geminiKey"
                  type={showKey ? 'text' : 'password'}
                  placeholder={org?.has_gemini_key ? '••••••••••••••••' : 'Enter your Gemini API key'}
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button onClick={handleSaveGeminiKey} disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from the{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google AI Studio
              </a>
            </p>
          </div>

          {org?.has_gemini_key && (
            <div className="pt-4 border-t">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (confirm('Are you sure you want to remove the Gemini API key?')) {
                    setGeminiKey('');
                    handleSaveGeminiKey();
                  }
                }}
              >
                Remove API Key
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* API Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>API Documentation</CardTitle>
          <CardDescription>
            Quick reference for using the API
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Base URL</h4>
            <code className="bg-muted px-2 py-1 rounded text-sm">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1
            </code>
          </div>

          <div>
            <h4 className="font-medium mb-2">Available Endpoints</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <code className="bg-muted px-1 rounded">POST /documents</code> - Upload a document
              </li>
              <li>
                <code className="bg-muted px-1 rounded">GET /documents</code> - List documents
              </li>
              <li>
                <code className="bg-muted px-1 rounded">POST /query</code> - Execute a RAG query
              </li>
              <li>
                <code className="bg-muted px-1 rounded">POST /chat</code> - Create a chat session
              </li>
              <li>
                <code className="bg-muted px-1 rounded">POST /chat/:id/messages</code> - Send a message
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
