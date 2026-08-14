import { requireAdmin } from '@/lib/middleware/auth';
import { Container } from '@/components/layout/Container';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: {
    environment?: { status: 'pass' | 'fail' | 'warn'; message?: string };
    database?: { status: 'pass' | 'fail' | 'warn'; latency_ms?: number; message?: string };
    auth?: { status: 'pass' | 'fail' | 'warn'; latency_ms?: number; message?: string };
    migrations?: { status: 'pass' | 'fail' | 'warn'; message?: string };
    stripe?: { status: 'pass' | 'fail' | 'warn'; latency_ms?: number; message?: string };
  };
}

async function getHealthStatus(): Promise<HealthCheck> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001';
  try {
    const response = await fetch(`${baseUrl}/api/health?ready=1`, {
      cache: 'no-store',
      ...(process.env.HEALTH_CHECK_TOKEN ? { headers: { 'x-health-token': process.env.HEALTH_CHECK_TOKEN } } : {}),
    });

    const data = await response.json();
    // Ensure checks is always an object even if the API shape differs
    if (!data.checks || typeof data.checks !== 'object') {
      data.checks = {};
    }
    return data as HealthCheck;
  } catch {
    return {
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      checks: {},
    };
  }
}

function StatusIcon({ status }: { status: 'pass' | 'fail' | 'warn' | undefined }) {
  if (status === 'pass') {
    return <CheckCircle2 className="h-5 w-5 text-green-500" />;
  }
  if (status === 'fail') {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (status === 'warn') {
    return <AlertCircle className="h-5 w-5 text-yellow-500" />;
  }
  return <Loader2 className="h-5 w-5 animate-spin text-gray-400" />;
}

function StatusBadge({ status }: { status: 'pass' | 'fail' | 'warn' | undefined }) {
  if (status === 'pass') {
    return <Badge className="bg-green-500">Pass</Badge>;
  }
  if (status === 'fail') {
    return <Badge className="bg-red-500">Fail</Badge>;
  }
  if (status === 'warn') {
    return <Badge className="bg-yellow-500">Warning</Badge>;
  }
  return <Badge variant="outline">Unknown</Badge>;
}

export default async function HealthDashboardPage() {
  await requireAdmin();
  const health = await getHealthStatus();

  return (
    <Container className="py-8">
      <div className="mb-8">
        <div className="mb-2 flex items-center justify-between gap-4">
          <h1 className="text-4xl font-bold">System Health Dashboard</h1>
          <Button asChild variant="outline">
            <Link href="/admin/health">Refresh</Link>
          </Button>
        </div>
        <p className="text-muted-foreground">
          Monitor the health and status of all system components
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated: {new Date(health.timestamp).toLocaleString()}
        </p>
      </div>

      {/* Overall Status */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Overall Status</span>
            <StatusBadge
              status={
                health.status === 'healthy'
                  ? 'pass'
                  : health.status === 'degraded'
                    ? 'warn'
                    : 'fail'
              }
            />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <StatusIcon
              status={
                health.status === 'healthy'
                  ? 'pass'
                  : health.status === 'degraded'
                    ? 'warn'
                    : 'fail'
              }
            />
            <span className="text-lg font-semibold capitalize">{health.status}</span>
          </div>
        </CardContent>
      </Card>

      {/* Service Checks */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Environment */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Environment</span>
              <StatusBadge status={health.checks.environment?.status} />
            </CardTitle>
            <CardDescription>Environment variable configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={health.checks.environment?.status} />
                <span className="text-sm">
                  {health.checks.environment?.status === 'pass'
                    ? 'All required variables configured'
                    : health.checks.environment?.message || 'Checking...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Database</span>
              <StatusBadge status={health.checks.database?.status} />
            </CardTitle>
            <CardDescription>Supabase database connection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={health.checks.database?.status} />
                <span className="text-sm">
                  {health.checks.database?.status === 'pass'
                    ? `Connected (${health.checks.database.latency_ms}ms)`
                    : health.checks.database?.message || 'Checking...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Authentication */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Authentication</span>
              <StatusBadge status={health.checks.auth?.status} />
            </CardTitle>
            <CardDescription>Supabase Auth service</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={health.checks.auth?.status} />
                <span className="text-sm">
                  {health.checks.auth?.status === 'pass'
                    ? `Available (${health.checks.auth.latency_ms}ms)`
                    : health.checks.auth?.message || 'Checking...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Migrations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Migrations</span>
              <StatusBadge status={health.checks.migrations?.status} />
            </CardTitle>
            <CardDescription>Database migration status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={health.checks.migrations?.status} />
                <span className="text-sm">
                  {health.checks.migrations?.status === 'pass'
                    ? 'All migrations applied'
                    : health.checks.migrations?.message || 'Checking...'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stripe */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Stripe</span>
              <StatusBadge status={health.checks.stripe?.status} />
            </CardTitle>
            <CardDescription>Payment processing service</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <StatusIcon status={health.checks.stripe?.status} />
                <span className="text-sm">
                  {health.checks.stripe?.status === 'pass'
                    ? `Connected${health.checks.stripe.latency_ms ? ` (${health.checks.stripe.latency_ms}ms)` : ''}`
                    : health.checks.stripe?.message || 'Not configured'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Environment Variables (Masked) */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Environment Configuration</CardTitle>
          <CardDescription>Configured environment variables (values masked)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 font-mono text-sm">
            <div>
              <span className="text-muted-foreground">NEXT_PUBLIC_SUPABASE_URL:</span>{' '}
              {process.env.NEXT_PUBLIC_SUPABASE_URL
                ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.substring(0, 20)}...`
                : 'Not set'}
            </div>
            <div>
              <span className="text-muted-foreground">STRIPE_SECRET_KEY:</span>{' '}
              {process.env.STRIPE_SECRET_KEY
                ? `${process.env.STRIPE_SECRET_KEY.substring(0, 7)}...`
                : 'Not set'}
            </div>
            <div>
              <span className="text-muted-foreground">OPENAI_API_KEY:</span>{' '}
              {process.env.OPENAI_API_KEY ? 'Set' : 'Not set'}
            </div>
            <div>
              <span className="text-muted-foreground">RESEND_API_KEY:</span>{' '}
              {process.env.RESEND_API_KEY ? 'Set' : 'Not set'}
            </div>
          </div>
        </CardContent>
      </Card>
    </Container>
  );
}
