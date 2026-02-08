'use client';

import { useCallback, useState } from 'react';
import { useGuardrailRules, useGuardrailViolations, useOverview } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Shield } from 'lucide-react';
import { formatNumber, timeAgo } from '@/lib/utils';

export default function GuardrailsPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useGuardrailRules();
  const { data: violationsData } = useGuardrailViolations();
  const { data: overview } = useOverview();
  const [open, setOpen] = useState(false);
  const [ruleType, setRuleType] = useState('keyword');
  const [ruleAction, setRuleAction] = useState('block');

  const handleCreate = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!api) return;
    const fd = new FormData(e.currentTarget);
    await api.post('/api/guardrails/rules', {
      type: ruleType,
      pattern: fd.get('pattern') as string,
      action: ruleAction,
      userMessage: fd.get('userMessage') as string || undefined,
    });
    setOpen(false);
    mutate();
  }, [api, mutate, ruleType, ruleAction]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const rules = data?.rules ?? [];
  const violations = violationsData?.violations ?? [];

  const ACTION_COLORS: Record<string, string> = {
    block: 'bg-red-500/20 text-red-400 border-red-500/30',
    warn: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    log: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          <p className="text-sm text-muted-foreground">{rules.length} rules</p>
          {overview && (
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {formatNumber(overview.totalGuardrailViolations)} total violations
              </span>
            </div>
          )}
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Rule</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Guardrail Rule</DialogTitle>
              <DialogDescription>Add a pattern-based guardrail rule.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={ruleType} onValueChange={setRuleType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="keyword">Keyword</SelectItem>
                    <SelectItem value="regex">Regex</SelectItem>
                    <SelectItem value="blocked_topic">Blocked Topic</SelectItem>
                    <SelectItem value="pii_filter">PII Filter</SelectItem>
                    <SelectItem value="jailbreak_detection">Jailbreak Detection</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pattern">Pattern</Label>
                <Input id="pattern" name="pattern" required placeholder={ruleType === 'regex' ? '\\b(bad|word)\\b' : 'bad word'} />
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={ruleAction} onValueChange={setRuleAction}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="block">Block</SelectItem>
                    <SelectItem value="warn">Warn</SelectItem>
                    <SelectItem value="log">Log</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="userMessage">User Message (optional)</Label>
                <Input id="userMessage" name="userMessage" placeholder="This content is not allowed" />
              </div>
              <Button type="submit" className="w-full">Create Rule</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guardrail rules configured.</p>
          ) : (
            <div className="space-y-3">
              {rules.map((r) => (
                <div key={r._id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{r.type}</Badge>
                      <code className="text-xs text-muted-foreground">{r.pattern}</code>
                    </div>
                    {r.userMessage && <p className="text-xs text-muted-foreground">{r.userMessage}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={ACTION_COLORS[r.action] ?? ''}>{r.action}</Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {violations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Recent Violations</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 font-medium">Action</th>
                    <th className="p-3 font-medium">Direction</th>
                    <th className="p-3 font-medium">Content</th>
                    <th className="p-3 font-medium">Session</th>
                    <th className="p-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, 20).map((v) => (
                    <tr key={v._id} className="border-b border-border last:border-0">
                      <td className="p-3"><Badge variant="secondary" className="text-xs">{v.type}</Badge></td>
                      <td className="p-3"><Badge variant="outline" className={`text-xs ${ACTION_COLORS[v.action] ?? ''}`}>{v.action}</Badge></td>
                      <td className="p-3 text-muted-foreground">{v.direction}</td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">{v.content}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{v.sessionId.slice(0, 12)}...</td>
                      <td className="p-3 text-muted-foreground">{timeAgo(v.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-border md:hidden">
              {violations.slice(0, 20).map((v) => (
                <div key={v._id} className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{v.type}</Badge>
                      <Badge variant="outline" className={`text-xs ${ACTION_COLORS[v.action] ?? ''}`}>{v.action}</Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">{v.direction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.content}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="font-mono">{v.sessionId.slice(0, 12)}...</span>
                    <span>{timeAgo(v.createdAt)}</span>
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
