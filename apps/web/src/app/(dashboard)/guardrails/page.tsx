'use client';

import { useCallback, useMemo, useState } from 'react';
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
import { Plus, Shield as ShieldIcon, Check, X } from 'lucide-react';
import { formatNumber, formatPercent, timeAgo } from '@/lib/utils';
/** Derive a human-readable name from pattern keywords */
function deriveRuleName(type: string, pattern: string): string {
  // Extract meaningful words from the pattern
  const words = pattern
    .replace(/[\\^$.*+?()[\]{}|]/g, ' ') // strip regex chars
    .split(/[_\s|,;]+/)
    .filter((w) => w.length > 2)
    .slice(0, 3);

  if (words.length === 0) return `${type} rule`;

  const name = words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return `${name} filter`;
}
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';

export default function GuardrailsPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useGuardrailRules();
  const { data: violationsData, mutate: mutateViolations } = useGuardrailViolations();
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

  const handleAnnotateViolation = useCallback(async (violationId: string, correctness: 'true_positive' | 'false_positive') => {
    if (!api) return;
    await api.patch('/api/guardrails/violations', {
      violationId,
      annotatedCorrectness: correctness,
    });
    mutateViolations();
  }, [api, mutateViolations]);

  const rules = data?.rules ?? [];
  const violations = violationsData?.violations ?? [];

  // Group rules by appSlug
  const rulesByApp = useMemo(() => {
    const groups: Record<string, typeof rules> = {};
    for (const r of rules) {
      const key = r.appSlug || 'global';
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [rules]);

  // Compute precision per rule
  const rulePrecision = useMemo(() => {
    const stats: Record<string, { tp: number; fp: number; total: number }> = {};
    for (const v of violations) {
      if (!v.annotatedCorrectness) continue;
      if (!stats[v.ruleId]) stats[v.ruleId] = { tp: 0, fp: 0, total: 0 };
      stats[v.ruleId].total++;
      if (v.annotatedCorrectness === 'true_positive') stats[v.ruleId].tp++;
      else stats[v.ruleId].fp++;
    }
    return stats;
  }, [violations]);

  // Overall stats
  const totalAnnotated = violations.filter((v) => v.annotatedCorrectness).length;
  const totalTP = violations.filter((v) => v.annotatedCorrectness === 'true_positive').length;
  const totalFP = violations.filter((v) => v.annotatedCorrectness === 'false_positive').length;
  const overallPrecision = totalAnnotated > 0 ? totalTP / totalAnnotated : null;

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Guardrails"
        count={rules.length}
        description={overview ? `${formatNumber(overview.totalGuardrailViolations)} total violations` : undefined}
      >
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
      </PageHeader>

      {/* Effectiveness Stats */}
      {totalAnnotated > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">Overall Precision</p>
              <p className="text-2xl font-semibold">{overallPrecision != null ? formatPercent(overallPrecision) : '—'}</p>
              <p className="text-xs text-muted-foreground">{totalAnnotated} violations annotated</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <Check className="h-5 w-5 text-emerald-500" />
              <div>
                <p className="text-2xl font-semibold">{totalTP}</p>
                <p className="text-xs text-muted-foreground">True Positives</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 flex items-center gap-3">
              <X className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-semibold">{totalFP}</p>
                <p className="text-xs text-muted-foreground">False Positives</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Rules</CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <EmptyState
              icon={ShieldIcon}
              title="No guardrail rules configured"
              description="Add keyword filters, regex patterns, or PII detection rules to protect your agent from harmful inputs and outputs."
              action={
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add your first rule
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {rulesByApp.map(([appSlug, appRules]) => (
                <div key={appSlug}>
                  {rulesByApp.length > 1 && (
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {appSlug}
                    </h3>
                  )}
                  <div className="space-y-3">
                    {appRules.map((r) => {
                      const precision = rulePrecision[r._id];
                      const precisionValue = precision && precision.total > 0
                        ? precision.tp / precision.total
                        : null;
                      const derivedName = deriveRuleName(r.type, r.pattern);
                      return (
                        <div key={r._id} className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary" className="text-xs">{r.type}</Badge>
                              <span className="text-sm font-medium">{derivedName}</span>
                            </div>
                            <details className="text-xs text-muted-foreground">
                              <summary className="cursor-pointer hover:text-foreground transition-colors">
                                Show pattern
                              </summary>
                              <code className="mt-1 block rounded bg-muted px-2 py-1 break-all">{r.pattern}</code>
                            </details>
                            {r.userMessage && <p className="text-xs text-muted-foreground">{r.userMessage}</p>}
                          </div>
                          <div className="flex items-center gap-2">
                            {precisionValue != null && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${precisionValue < 0.5 ? 'text-red-400 border-red-500/25' : precisionValue < 0.8 ? 'text-amber-400 border-amber-500/25' : 'text-emerald-400 border-emerald-500/25'}`}
                              >
                                {formatPercent(precisionValue)} precision ({precision!.total} annotated)
                              </Badge>
                            )}
                            <StatusBadge value={r.action} type="action" />
                            <span className="text-xs text-muted-foreground">{timeAgo(r.createdAt)}</span>
                          </div>
                        </div>
                      );
                    })}
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
                    <th className="p-3 font-medium">Correctness</th>
                  </tr>
                </thead>
                <tbody>
                  {violations.slice(0, 30).map((v) => (
                    <tr key={v._id} className="border-b border-border last:border-0">
                      <td className="p-3"><Badge variant="secondary" className="text-xs">{v.type}</Badge></td>
                      <td className="p-3"><StatusBadge value={v.action} type="action" /></td>
                      <td className="p-3 text-muted-foreground">{v.direction}</td>
                      <td className="p-3 text-muted-foreground max-w-xs truncate">{v.content}</td>
                      <td className="p-3 font-mono text-xs text-muted-foreground">{v.sessionId.slice(0, 12)}...</td>
                      <td className="p-3 text-muted-foreground">{timeAgo(v.createdAt)}</td>
                      <td className="p-3">
                        {v.annotatedCorrectness ? (
                          <Badge
                            variant="outline"
                            className={`text-xs ${v.annotatedCorrectness === 'true_positive' ? 'text-emerald-400 border-emerald-500/25' : 'text-red-400 border-red-500/25'}`}
                          >
                            {v.annotatedCorrectness === 'true_positive' ? 'TP' : 'FP'}
                          </Badge>
                        ) : (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-400"
                              onClick={() => void handleAnnotateViolation(v._id, 'true_positive')}
                              title="True Positive"
                            >
                              <Check className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
                              onClick={() => void handleAnnotateViolation(v._id, 'false_positive')}
                              title="False Positive"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile card list */}
            <div className="divide-y divide-border md:hidden">
              {violations.slice(0, 30).map((v) => (
                <div key={v._id} className="space-y-1.5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">{v.type}</Badge>
                      <StatusBadge value={v.action} type="action" />
                    </div>
                    <span className="text-xs text-muted-foreground">{v.direction}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{v.content}</p>
                  <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div className="flex items-center gap-3">
                      <span className="font-mono">{v.sessionId.slice(0, 12)}...</span>
                      <span>{timeAgo(v.createdAt)}</span>
                    </div>
                    {v.annotatedCorrectness ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${v.annotatedCorrectness === 'true_positive' ? 'text-emerald-400 border-emerald-500/25' : 'text-red-400 border-red-500/25'}`}
                      >
                        {v.annotatedCorrectness === 'true_positive' ? 'TP' : 'FP'}
                      </Badge>
                    ) : (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-emerald-500 hover:text-emerald-400"
                          onClick={() => void handleAnnotateViolation(v._id, 'true_positive')}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-red-500 hover:text-red-400"
                          onClick={() => void handleAnnotateViolation(v._id, 'false_positive')}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
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
