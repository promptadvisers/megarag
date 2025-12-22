'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Building2, UserPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function RegisterPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    admin_email: '',
    admin_password: '',
    gemini_api_key: '',
  });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    // Auto-generate slug from name
    if (name === 'name') {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      setFormData((prev) => ({ ...prev, slug }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/admin/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || 'Registration failed');
      }

      // Redirect to login
      router.push('/admin/login?registered=true');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-muted">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create Organization</CardTitle>
          <CardDescription>
            Set up your MegaRAG organization to get started
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950/20 rounded-lg">
                {error}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name</Label>
                <Input
                  id="name"
                  name="name"
                  placeholder="My Company"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">URL Slug</Label>
                <Input
                  id="slug"
                  name="slug"
                  placeholder="my-company"
                  value={formData.slug}
                  onChange={handleChange}
                  required
                  disabled={isLoading}
                  pattern="[a-z0-9-]+"
                />
                <p className="text-xs text-muted-foreground">
                  Lowercase letters, numbers, and hyphens only
                </p>
              </div>
            </div>

            <hr />

            <div className="space-y-2">
              <Label htmlFor="admin_email">Admin Email</Label>
              <Input
                id="admin_email"
                name="admin_email"
                type="email"
                placeholder="admin@example.com"
                value={formData.admin_email}
                onChange={handleChange}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_password">Admin Password</Label>
              <Input
                id="admin_password"
                name="admin_password"
                type="password"
                placeholder="Choose a strong password"
                value={formData.admin_password}
                onChange={handleChange}
                required
                minLength={8}
                disabled={isLoading}
              />
            </div>

            <hr />

            <div className="space-y-2">
              <Label htmlFor="gemini_api_key">
                Gemini API Key <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="gemini_api_key"
                name="gemini_api_key"
                type="password"
                placeholder="Your Google Gemini API key"
                value={formData.gemini_api_key}
                onChange={handleChange}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground">
                You can add this later in settings. Required for RAG queries.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Organization
                </>
              )}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Already have an organization?{' '}
              <Link href="/admin/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
