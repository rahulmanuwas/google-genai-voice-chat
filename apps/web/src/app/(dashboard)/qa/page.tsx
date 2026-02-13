'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQaScenarios, useQaRuns } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { FlaskConical, Plus } from 'lucide-react';
import { formatPercent, timeAgo } from '@/lib/utils';

function splitLines(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function QaPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useQaScenarios();
  const { data: runsData, mutate: mutateRuns } = useQaRuns();

  const scenarios = useMemo(() => data?.scenarios ?? [], [data?.scenarios]);
  const runs = useMemo(() => runsData?.runs ?? [], [runsData?.runs]);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [turnsText, setTurnsText] = useState('');
  const [shouldContainText, setShouldContainText] = useState('');
  const [shouldNotContainText, setShouldNotContainText] = useState('');
  const [shouldCallTool, setShouldCallTool] = useState('');
  const [shouldHandoff, setShouldHandoff] = useState('any');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [responseText, setResponseText] = useState('');
  const [calledTools, setCalledTools] = useState('');
  const [handoffTriggered, setHandoffTriggered] = useState('false');
  const [isSubmittingRun, setIsSubmittingRun] = useState(false);

  useEffect(() => {
    if (!selectedScenarioId && scenarios.length > 0) {
      setSelectedScenarioId(scenarios[0]._id);
    }
  }, [selectedScenarioId, scenarios]);

  const selectedScenarioName = useMemo(
    () => scenarios.find((scenario) => scenario._id === selectedScenarioId)?.name ?? null,
    [scenarios, selectedScenarioId],
  );

  const handleCreateScenario = useCallback(async () => {
    if (!api || !name.trim()) return;

    const turns = splitLines(turnsText).map((content) => ({ role: 'user' as const, content }));
    if (turns.length === 0) return;

    const expectations: Record<string, unknown> = {};
    const shouldContain = splitLines(shouldContainText);
    const shouldNotContain = splitLines(shouldNotContainText);
    if (shouldContain.length > 0) expectations.shouldContain = shouldContain;
    if (shouldNotContain.length > 0) expectations.shouldNotContain = shouldNotContain;
    if (shouldCallTool.trim()) expectations.shouldCallTool = shouldCallTool.trim();
    if (shouldHandoff !== 'any') expectations.shouldHandoff = shouldHandoff === 'true';

    await api.post('/api/qa/scenarios', {
      name: name.trim(),
      description: description.trim() || undefined,
      turns,
      expectations,
      isActive: true,
    });

    setName('');
    setDescription('');
    setTurnsText('');
    setShouldContainText('');
    setShouldNotContainText('');
    setShouldCallTool('');
    setShouldHandoff('any');
    setCreateOpen(false);
    await mutate();
  }, [
    api,
    description,
    mutate,
    name,
    shouldCallTool,
    shouldContainText,
    shouldHandoff,
    shouldNotContainText,
    turnsText,
  ]);

  const handleRunScenario = useCallback(async () => {
    if (!api || !selectedScenarioId || !responseText.trim()) return;
    setIsSubmittingRun(true);
    try {
      const tools = calledTools
        .split(',')
        .map((tool) => tool.trim())
        .filter(Boolean);

      await api.post('/api/qa/runs', {
        scenarioId: selectedScenarioId,
        responseText: responseText.trim(),
        calledTools: tools,
        handoffTriggered: handoffTriggered === 'true',
      });

      setResponseText('');
      setCalledTools('');
      setHandoffTriggered('false');
      await mutateRuns();
    } finally {
      setIsSubmittingRun(false);
    }
  }, [api, calledTools, handoffTriggered, mutateRuns, responseText, selectedScenarioId]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Conversation QA" count={scenarios.length} description={`${runs.length} runs`}>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Scenario
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create QA Scenario</DialogTitle>
              <DialogDescription>
                Define turns and quality expectations for regression testing.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scenario-name">Name</Label>
                <Input
                  id="scenario-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="order_status_resolution"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-description">Description</Label>
                <Input
                  id="scenario-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="User asks for delayed order update"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-turns">User turns (one per line)</Label>
                <Textarea
                  id="scenario-turns"
                  value={turnsText}
                  onChange={(event) => setTurnsText(event.target.value)}
                  placeholder={'Where is my order?\nCan you check tracking status?'}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-contain">Must contain (one phrase per line)</Label>
                <Textarea
                  id="scenario-contain"
                  value={shouldContainText}
                  onChange={(event) => setShouldContainText(event.target.value)}
                  placeholder={'tracking\nestimated delivery'}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-not-contain">Must not contain (one phrase per line)</Label>
                <Textarea
                  id="scenario-not-contain"
                  value={shouldNotContainText}
                  onChange={(event) => setShouldNotContainText(event.target.value)}
                  placeholder={'I do not know\nmaybe'}
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="scenario-tool">Required tool call (optional)</Label>
                <Input
                  id="scenario-tool"
                  value={shouldCallTool}
                  onChange={(event) => setShouldCallTool(event.target.value)}
                  placeholder="lookup_order"
                />
              </div>
              <div className="space-y-2">
                <Label>Handoff expectation</Label>
                <Select value={shouldHandoff} onValueChange={setShouldHandoff}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">No expectation</SelectItem>
                    <SelectItem value="true">Must handoff</SelectItem>
                    <SelectItem value="false">Must not handoff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => void handleCreateScenario()}
                className="w-full"
                disabled={!name.trim() || splitLines(turnsText).length === 0}
              >
                Save Scenario
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Run Scenario</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Scenario</Label>
              <Select value={selectedScenarioId || undefined} onValueChange={setSelectedScenarioId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a scenario" />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario._id} value={scenario._id}>
                      {scenario.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Handoff triggered?</Label>
              <Select value={handoffTriggered} onValueChange={setHandoffTriggered}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="false">No</SelectItem>
                  <SelectItem value="true">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="qa-response">Agent response text</Label>
            <Textarea
              id="qa-response"
              value={responseText}
              onChange={(event) => setResponseText(event.target.value)}
              placeholder="Paste the model response to evaluate..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="qa-tools">Called tools (comma-separated)</Label>
            <Input
              id="qa-tools"
              value={calledTools}
              onChange={(event) => setCalledTools(event.target.value)}
              placeholder="lookup_order, check_inventory"
            />
          </div>

          <Button
            onClick={() => void handleRunScenario()}
            disabled={!selectedScenarioId || !responseText.trim() || isSubmittingRun}
          >
            {isSubmittingRun ? 'Running...' : `Run ${selectedScenarioName ?? 'scenario'}`}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Scenarios</CardTitle>
        </CardHeader>
        <CardContent>
          {scenarios.length === 0 ? (
            <EmptyState
              icon={FlaskConical}
              title="No QA scenarios yet"
              description="Create baseline test scenarios to catch regressions in tone, tool usage, and handoff behavior."
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first scenario
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {scenarios.map((scenario) => (
                <div
                  key={scenario._id}
                  className="space-y-2 rounded-md border border-border p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{scenario.name}</p>
                    <Badge variant={scenario.isActive ? 'secondary' : 'outline'} className="text-xs">
                      {scenario.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{timeAgo(scenario.updatedAt)}</span>
                  </div>
                  {scenario.description && (
                    <p className="text-xs text-muted-foreground">{scenario.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{scenario.turns.length} user turns</Badge>
                    {scenario.expectations.shouldContain?.length ? (
                      <Badge variant="outline">{scenario.expectations.shouldContain.length} contain checks</Badge>
                    ) : null}
                    {scenario.expectations.shouldNotContain?.length ? (
                      <Badge variant="outline">{scenario.expectations.shouldNotContain.length} exclusion checks</Badge>
                    ) : null}
                    {scenario.expectations.shouldCallTool ? (
                      <Badge variant="outline">
                        tool: {Array.isArray(scenario.expectations.shouldCallTool)
                          ? scenario.expectations.shouldCallTool.join(', ')
                          : scenario.expectations.shouldCallTool}
                      </Badge>
                    ) : null}
                    {scenario.expectations.shouldHandoff !== undefined ? (
                      <Badge variant="outline">
                        handoff: {String(scenario.expectations.shouldHandoff)}
                      </Badge>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="space-y-3">
              {runs.slice(0, 20).map((run) => (
                <div key={run._id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{run.scenarioName}</p>
                    <Badge variant={run.status === 'passed' ? 'secondary' : 'destructive'} className="text-xs">
                      {run.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {formatPercent(run.score)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {run.passedChecks}/{run.totalChecks} checks
                    </span>
                    <span className="text-xs text-muted-foreground">{timeAgo(run.createdAt)}</span>
                  </div>
                  {run.results.some((result) => !result.passed) && (
                    <ul className="space-y-1">
                      {run.results
                        .filter((result) => !result.passed)
                        .slice(0, 3)
                        .map((result, idx) => (
                          <li key={`${run._id}-${idx}`} className="text-xs text-muted-foreground">
                            {result.detail}
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
