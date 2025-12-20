'use client';

import { useEffect, useState } from 'react';
import { Key, Plus, Trash2, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  is_active: boolean;
  key?: string; // Only present when newly created
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const sessionRes = await fetch('/api/admin/session');
      const sessionData = await sessionRes.json();
      if (!sessionData.success) throw new Error('No session');

      const orgId = sessionData.data.organization.id;
      setOrgId(orgId);

      const keysRes = await fetch(`/api/admin/organizations/${orgId}/api-keys`);
      const keysData = await keysRes.json();
      if (keysData.success) {
        setApiKeys(keysData.data.api_keys);
      }
    } catch (error) {
      console.error('Failed to load API keys:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateKey = async () => {
    if (!newKeyName.trim() || !orgId) return;

    setIsCreating(true);
    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName }),
      });

      const data = await res.json();
      if (data.success) {
        setNewlyCreatedKey(data.data.api_key.key);
        setApiKeys((prev) => [{ ...data.data.api_key, is_active: true }, ...prev]);
        setNewKeyName('');
      }
    } catch (error) {
      console.error('Failed to create API key:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteKey = async (keyId: string) => {
    if (!orgId || !confirm('Are you sure you want to delete this API key?')) return;

    try {
      const res = await fetch(`/api/admin/organizations/${orgId}/api-keys/${keyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setApiKeys((prev) => prev.filter((k) => k.id !== keyId));
      }
    } catch (error) {
      console.error('Failed to delete API key:', error);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeNewKeyDialog = () => {
    setCreateDialogOpen(false);
    setNewlyCreatedKey(null);
    setNewKeyName('');
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">
            Manage your API keys for programmatic access
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          if (!open) closeNewKeyDialog();
          else setCreateDialogOpen(true);
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create API Key
            </Button>
          </DialogTrigger>
          <DialogContent>
            {newlyCreatedKey ? (
              <>
                <DialogHeader>
                  <DialogTitle>API Key Created</DialogTitle>
                  <DialogDescription>
                    Copy your API key now. You won&apos;t be able to see it again!
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="p-4 bg-muted rounded-lg font-mono text-sm break-all">
                    {newlyCreatedKey}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => copyToClipboard(newlyCreatedKey)}
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4 mr-2" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                </div>
                <DialogFooter>
                  <Button onClick={closeNewKeyDialog}>Done</Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <DialogHeader>
                  <DialogTitle>Create API Key</DialogTitle>
                  <DialogDescription>
                    Create a new API key for programmatic access to your organization&apos;s data
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="keyName">Key Name</Label>
                    <Input
                      id="keyName"
                      placeholder="e.g., Production API"
                      value={newKeyName}
                      onChange={(e) => setNewKeyName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={closeNewKeyDialog}>Cancel</Button>
                  <Button onClick={handleCreateKey} disabled={!newKeyName.trim() || isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Key'
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your API Keys</CardTitle>
          <CardDescription>
            Use these keys to authenticate API requests. Keep them secret!
          </CardDescription>
        </CardHeader>
        <CardContent>
          {apiKeys.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No API keys yet</p>
              <p className="text-sm">Create your first API key to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {apiKeys.map((key) => (
                <div
                  key={key.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      {!key.is_active && (
                        <Badge variant="secondary">Revoked</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <span className="font-mono">{key.key_prefix}...</span>
                      <span className="mx-2">·</span>
                      <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                      {key.last_used_at && (
                        <>
                          <span className="mx-2">·</span>
                          <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeleteKey(key.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle>Using Your API Key</CardTitle>
          <CardDescription>
            Include your API key in the Authorization header
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="bg-muted p-4 rounded-lg font-mono text-sm">
            <p className="text-muted-foreground"># Example cURL request</p>
            <p>curl -X POST https://your-domain/api/v1/query \</p>
            <p className="pl-4">-H &quot;Authorization: Bearer mrag_sk_your_key_here&quot; \</p>
            <p className="pl-4">-H &quot;Content-Type: application/json&quot; \</p>
            <p className="pl-4">-d &apos;{`{"query": "What is..."}`}&apos;</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
