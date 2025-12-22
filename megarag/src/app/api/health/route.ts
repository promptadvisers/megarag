import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency_ms?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  version: string;
  timestamp: string;
  services: {
    api: HealthCheck;
    database: HealthCheck;
    storage: HealthCheck;
    docling?: HealthCheck;
  };
  uptime_seconds: number;
}

const startTime = Date.now();

/**
 * GET /api/health - System health check
 * Public endpoint for monitoring
 */
export async function GET() {
  const response: HealthResponse = {
    status: 'healthy',
    version: process.env.npm_package_version || '1.0.0',
    timestamp: new Date().toISOString(),
    services: {
      api: { status: 'healthy' },
      database: { status: 'healthy' },
      storage: { status: 'healthy' },
    },
    uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
  };

  // Check database
  try {
    const dbStart = Date.now();
    const { error } = await supabaseAdmin.from('documents').select('id').limit(1);
    response.services.database.latency_ms = Date.now() - dbStart;

    if (error) {
      response.services.database.status = 'unhealthy';
      response.services.database.error = error.message;
    }
  } catch (error) {
    response.services.database.status = 'unhealthy';
    response.services.database.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check storage
  try {
    const storageStart = Date.now();
    const { error } = await supabaseAdmin.storage.from('documents').list('', { limit: 1 });
    response.services.storage.latency_ms = Date.now() - storageStart;

    if (error) {
      response.services.storage.status = 'unhealthy';
      response.services.storage.error = error.message;
    }
  } catch (error) {
    response.services.storage.status = 'unhealthy';
    response.services.storage.error = error instanceof Error ? error.message : 'Unknown error';
  }

  // Check Docling service (optional)
  const doclingUrl = process.env.DOCLING_SERVICE_URL || 'http://localhost:8000';
  try {
    const doclingStart = Date.now();
    const doclingResponse = await fetch(`${doclingUrl}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    response.services.docling = {
      status: doclingResponse.ok ? 'healthy' : 'degraded',
      latency_ms: Date.now() - doclingStart,
    };
    if (!doclingResponse.ok) {
      response.services.docling.error = `HTTP ${doclingResponse.status}`;
    }
  } catch {
    response.services.docling = {
      status: 'unhealthy',
      error: 'Service unavailable',
    };
  }

  // Determine overall status
  const statuses = Object.values(response.services).map(s => s.status);
  if (statuses.some(s => s === 'unhealthy')) {
    // Only mark unhealthy if critical services are down (db, api)
    if (response.services.database.status === 'unhealthy') {
      response.status = 'unhealthy';
    } else {
      response.status = 'degraded';
    }
  } else if (statuses.some(s => s === 'degraded')) {
    response.status = 'degraded';
  }

  const httpStatus = response.status === 'healthy' ? 200 : response.status === 'degraded' ? 200 : 503;

  return NextResponse.json(response, { status: httpStatus });
}
