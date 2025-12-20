'use client';

import { useEffect, useState } from 'react';
import { BarChart3, Zap, Database, FileText, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { UsageSummary } from '@/types';

interface SessionData {
  organization: { id: string };
}

export default function AdminDashboardPage() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [orgId, setOrgId] = useState<string | null>(null);

  useEffect(() => {
    // Get session first
    fetch('/api/admin/session')
      .then((res) => res.json())
      .then((data: { success: boolean; data: SessionData }) => {
        if (data.success) {
          setOrgId(data.data.organization.id);
          // Then fetch usage
          return fetch(`/api/admin/organizations/${data.data.organization.id}/usage`);
        }
        throw new Error('No session');
      })
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setUsage(data.data.usage);
        }
      })
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  const formatBytes = (bytes: number) => {
    if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
    if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
    if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return bytes + ' B';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const stats = [
    {
      title: 'API Requests',
      value: formatNumber(usage?.total_api_requests || 0),
      description: 'This month',
      icon: BarChart3,
    },
    {
      title: 'LLM Tokens',
      value: formatNumber((usage?.total_llm_input_tokens || 0) + (usage?.total_llm_output_tokens || 0)),
      description: 'Input + Output',
      icon: Zap,
    },
    {
      title: 'Embeddings',
      value: formatNumber(usage?.total_embedding_requests || 0),
      description: 'This month',
      icon: FileText,
    },
    {
      title: 'Storage',
      value: formatBytes(usage?.total_storage_bytes || 0),
      description: 'Total used',
      icon: Database,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your organization&apos;s API usage
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Usage Details */}
      <Card>
        <CardHeader>
          <CardTitle>Token Breakdown</CardTitle>
          <CardDescription>Input and output token usage this month</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm">Input Tokens</span>
              <span className="font-medium">
                {formatNumber(usage?.total_llm_input_tokens || 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm">Output Tokens</span>
              <span className="font-medium">
                {formatNumber(usage?.total_llm_output_tokens || 0)}
              </span>
            </div>
            <hr />
            <div className="flex items-center justify-between text-lg">
              <span className="font-medium">Total Tokens</span>
              <span className="font-bold">
                {formatNumber(
                  (usage?.total_llm_input_tokens || 0) + (usage?.total_llm_output_tokens || 0)
                )}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Daily Usage */}
      {usage?.daily_breakdown && usage.daily_breakdown.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Usage</CardTitle>
            <CardDescription>API requests per day this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {usage.daily_breakdown.slice(-7).map((day) => (
                <div key={day.date} className="flex items-center justify-between py-2 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">
                    {new Date(day.date).toLocaleDateString()}
                  </span>
                  <div className="flex gap-4 text-sm">
                    <span>{day.api_requests} requests</span>
                    <span className="text-muted-foreground">|</span>
                    <span>{formatNumber(day.llm_input_tokens + day.llm_output_tokens)} tokens</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
