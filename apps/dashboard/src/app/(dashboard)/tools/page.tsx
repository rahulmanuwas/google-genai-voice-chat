'use client';

import { useCallback, useState } from 'react';
import { useTools, useToolExecutions, useOverview } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToolUsageChart } from '@/components/overview/tool-usage-chart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { timeAgo, formatDuration } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

export default function ToolsPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useTools();
  const { data: execData } = useToolExecutions();
  const { data: overview } = useOverview();
  const [open, setOpen] = useState(false);

  const handleRegister = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!api) return;
    const fd = new FormData(e.currentTarget);
    await api.post('/api/tools', {
      name: fd.get('name') as string,
      description: fd.get('description') as string,
      parametersSchema: fd.get('parametersSchema') as string,
      endpoint: fd.get('endpoint') as string,
      httpMethod: fd.get('httpMethod') as string || 'POST',
    });
    setOpen(false);
    mutate();
  }, [api, mutate]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const tools = data?.tools ?? [];
  const executions = execData?.executions ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Tools" count={tools.length} description={`${executions.length} executions`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Register Tool</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Register Tool</DialogTitle>
              <DialogDescription>Add a new tool for the AI agent to use.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" name="name" required placeholder="lookup_order" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" name="description" required placeholder="Look up order by ID" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parametersSchema">Parameters Schema (JSON)</Label>
                <Textarea id="parametersSchema" name="parametersSchema" required placeholder='{"type":"object","properties":{"orderId":{"type":"string"}}}' />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endpoint">Endpoint URL</Label>
                <Input id="endpoint" name="endpoint" required placeholder="https://api.example.com/orders" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="httpMethod">HTTP Method</Label>
                <Input id="httpMethod" name="httpMethod" placeholder="POST" defaultValue="POST" />
              </div>
              <Button type="submit" className="w-full">Register</Button>
            </form>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Registered Tools</CardTitle>
          </CardHeader>
          <CardContent>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools registered yet.</p>
            ) : (
              <div className="space-y-3">
                {tools.map((t) => (
                  <div key={t._id} className="flex items-center justify-between rounded-md border border-border p-3">
                    <div>
                      <p className="text-sm font-medium">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!t.isActive && <Badge variant="outline" className="text-xs bg-zinc-500/20 text-zinc-400">Inactive</Badge>}
                      {t.requiresConfirmation && <Badge variant="outline" className="text-xs">Confirm</Badge>}
                      <Badge variant="secondary" className="text-xs">{t.httpMethod ?? 'POST'}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        {overview && <ToolUsageChart toolUsage={overview.toolUsage} />}
      </div>

      {executions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Executions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Tool</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 font-medium">Duration</th>
                    <th className="p-3 font-medium">Session</th>
                    <th className="p-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {executions.slice(0, 20).map((e) => (
                    <tr key={e._id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{e.toolName}</td>
                      <td className="p-3">
                        <Badge variant={e.status === 'success' ? 'secondary' : 'destructive'} className="text-xs">
                          {e.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-muted-foreground">{formatDuration(e.durationMs)}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{e.sessionId.slice(0, 12)}...</td>
                      <td className="p-3 text-muted-foreground">{timeAgo(e.executedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-border md:hidden">
              {executions.slice(0, 20).map((e) => (
                <div key={e._id} className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">{e.toolName}</span>
                    <Badge variant={e.status === 'success' ? 'secondary' : 'destructive'} className="text-xs">
                      {e.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{formatDuration(e.durationMs)}</span>
                    <span className="font-mono">{e.sessionId.slice(0, 12)}...</span>
                    <span>{timeAgo(e.executedAt)}</span>
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
