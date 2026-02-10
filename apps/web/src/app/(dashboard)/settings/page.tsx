'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { PageHeader } from '@/components/layout/page-header';

export default function SettingsPage() {
  const appSlug = process.env.NEXT_PUBLIC_APP_SLUG ?? 'demo';
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL ?? 'Not configured';

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">App Configuration</CardTitle>
          <CardDescription>Current environment settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">App Slug</p>
            <p className="text-sm text-muted-foreground">{appSlug}</p>
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-sm font-medium">Convex URL</p>
            <p className="text-sm text-muted-foreground break-all">{convexUrl}</p>
          </div>
          <Separator />
          <div className="space-y-1">
            <p className="text-sm font-medium">Dashboard Version</p>
            <p className="text-sm text-muted-foreground">0.1.0</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
