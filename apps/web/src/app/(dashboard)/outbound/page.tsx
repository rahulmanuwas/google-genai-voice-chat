'use client';

import { useCallback, useMemo, useState } from 'react';
import { useOutboundDispatches, useOutboundTriggers } from '@/lib/hooks/use-api';
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
import { Plus, Send, Zap } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

function parseJson(value: string): Record<string, unknown> | null {
  if (!value.trim()) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

export default function OutboundPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useOutboundTriggers();
  const { data: dispatchData, mutate: mutateDispatches } = useOutboundDispatches();

  const triggers = useMemo(() => data?.triggers ?? [], [data?.triggers]);
  const dispatches = useMemo(() => dispatchData?.dispatches ?? [], [dispatchData?.dispatches]);

  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventType, setEventType] = useState('');
  const [channel, setChannel] = useState('sms');
  const [conditionJson, setConditionJson] = useState('');
  const [template, setTemplate] = useState('Hi {{firstName}}, this is a follow-up on {{eventType}}.');
  const [throttleMax, setThrottleMax] = useState('1');
  const [throttleWindowHours, setThrottleWindowHours] = useState('24');

  const [dispatchEventType, setDispatchEventType] = useState('');
  const [dispatchRecipient, setDispatchRecipient] = useState('');
  const [dispatchChannel, setDispatchChannel] = useState('any');
  const [dispatchDataJson, setDispatchDataJson] = useState(
    '{\n  "firstName": "Alex",\n  "eventType": "cart_abandoned",\n  "orderValue": 249\n}',
  );
  const [dispatchError, setDispatchError] = useState<string | null>(null);
  const [isDispatching, setIsDispatching] = useState(false);

  const eventTypeOptions = useMemo(() => {
    const values = new Set<string>();
    for (const trigger of triggers) values.add(trigger.eventType);
    return Array.from(values).sort((a, b) => a.localeCompare(b));
  }, [triggers]);

  const handleCreateTrigger = useCallback(async () => {
    if (!api || !name.trim() || !eventType.trim() || !template.trim()) return;

    const condition = parseJson(conditionJson);
    if (condition === null) {
      setDispatchError('Condition JSON must be a valid object');
      return;
    }

    const maxPerWindow = Number(throttleMax);
    const windowHours = Number(throttleWindowHours);
    if (!Number.isFinite(maxPerWindow) || maxPerWindow <= 0) return;
    if (!Number.isFinite(windowHours) || windowHours <= 0) return;

    await api.post('/api/outbound/triggers', {
      name: name.trim(),
      description: description.trim() || undefined,
      eventType: eventType.trim(),
      channel,
      condition: Object.keys(condition).length > 0 ? condition : undefined,
      template: template.trim(),
      throttleMaxPerWindow: maxPerWindow,
      throttleWindowMs: windowHours * 60 * 60 * 1000,
      isActive: true,
    });

    setName('');
    setDescription('');
    setEventType('');
    setChannel('sms');
    setConditionJson('');
    setTemplate('Hi {{firstName}}, this is a follow-up on {{eventType}}.');
    setThrottleMax('1');
    setThrottleWindowHours('24');
    setDispatchError(null);
    setOpen(false);
    await mutate();
  }, [
    api,
    channel,
    conditionJson,
    description,
    eventType,
    mutate,
    name,
    template,
    throttleMax,
    throttleWindowHours,
  ]);

  const handleDispatch = useCallback(async () => {
    if (!api || !dispatchEventType.trim() || !dispatchRecipient.trim()) return;
    const eventPayload = parseJson(dispatchDataJson);
    if (eventPayload === null) {
      setDispatchError('Event data must be valid JSON object');
      return;
    }

    setDispatchError(null);
    setIsDispatching(true);
    try {
      await api.post('/api/outbound/dispatch', {
        eventType: dispatchEventType.trim(),
        recipient: dispatchRecipient.trim(),
        eventData: eventPayload,
        channel: dispatchChannel === 'any' ? undefined : dispatchChannel,
      });
      await mutateDispatches();
    } catch (error) {
      setDispatchError(error instanceof Error ? error.message : 'Dispatch failed');
    } finally {
      setIsDispatching(false);
    }
  }, [
    api,
    dispatchChannel,
    dispatchDataJson,
    dispatchEventType,
    dispatchRecipient,
    mutateDispatches,
  ]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Outbound" count={triggers.length} description={`${dispatches.length} dispatch logs`}>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Trigger
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Outbound Trigger</DialogTitle>
              <DialogDescription>
                Define when proactive outreach should fire and how it should be throttled.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="trigger-name">Name</Label>
                <Input
                  id="trigger-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="abandoned_cart_sms"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-description">Description</Label>
                <Input
                  id="trigger-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Send reminder 30 min after cart abandonment"
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trigger-event">Event type</Label>
                  <Input
                    id="trigger-event"
                    value={eventType}
                    onChange={(event) => setEventType(event.target.value)}
                    placeholder="cart_abandoned"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="push">Push</SelectItem>
                      <SelectItem value="voice">Voice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-condition">Condition JSON (optional)</Label>
                <Textarea
                  id="trigger-condition"
                  value={conditionJson}
                  onChange={(event) => setConditionJson(event.target.value)}
                  placeholder={'{\n  "orderValue": 250,\n  "segment": "vip"\n}'}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-template">Message template</Label>
                <Textarea
                  id="trigger-template"
                  value={template}
                  onChange={(event) => setTemplate(event.target.value)}
                  placeholder="Hi {{firstName}}, your cart is waiting."
                  rows={3}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="trigger-max">Max sends per window</Label>
                  <Input
                    id="trigger-max"
                    type="number"
                    min={1}
                    value={throttleMax}
                    onChange={(event) => setThrottleMax(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="trigger-window">Window (hours)</Label>
                  <Input
                    id="trigger-window"
                    type="number"
                    min={1}
                    value={throttleWindowHours}
                    onChange={(event) => setThrottleWindowHours(event.target.value)}
                  />
                </div>
              </div>
              <Button
                onClick={() => void handleCreateTrigger()}
                className="w-full"
                disabled={!name.trim() || !eventType.trim() || !template.trim()}
              >
                Save Trigger
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Dispatch Tester</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Event type</Label>
              <Select value={dispatchEventType || undefined} onValueChange={setDispatchEventType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  {eventTypeOptions.map((value) => (
                    <SelectItem key={value} value={value}>
                      {value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dispatch-recipient">Recipient</Label>
              <Input
                id="dispatch-recipient"
                value={dispatchRecipient}
                onChange={(event) => setDispatchRecipient(event.target.value)}
                placeholder="+15551234567 or user@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Channel override</Label>
              <Select value={dispatchChannel} onValueChange={setDispatchChannel}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="push">Push</SelectItem>
                  <SelectItem value="voice">Voice</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dispatch-payload">Event payload JSON</Label>
            <Textarea
              id="dispatch-payload"
              value={dispatchDataJson}
              onChange={(event) => setDispatchDataJson(event.target.value)}
              rows={6}
            />
          </div>
          {dispatchError && (
            <p className="text-sm text-destructive">{dispatchError}</p>
          )}
          <Button
            onClick={() => void handleDispatch()}
            disabled={!dispatchEventType || !dispatchRecipient || isDispatching}
          >
            <Send className="mr-2 h-4 w-4" />
            {isDispatching ? 'Dispatching...' : 'Dispatch Event'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Triggers</CardTitle>
        </CardHeader>
        <CardContent>
          {triggers.length === 0 ? (
            <EmptyState
              icon={Zap}
              title="No outbound triggers yet"
              description="Add triggers for events like cart abandonment, renewal reminders, or failed payments."
              action={
                <Button size="sm" onClick={() => setOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add first trigger
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {triggers.map((trigger) => (
                <div key={trigger._id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{trigger.name}</p>
                    <Badge variant={trigger.isActive ? 'secondary' : 'outline'} className="text-xs">
                      {trigger.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{trigger.channel}</Badge>
                    <Badge variant="outline" className="text-xs">{trigger.eventType}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {trigger.throttleMaxPerWindow}/{Math.round(trigger.throttleWindowMs / (60 * 60 * 1000))}h
                    </span>
                  </div>
                  {trigger.description && (
                    <p className="mb-1 text-xs text-muted-foreground">{trigger.description}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{trigger.template}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Dispatch Logs</CardTitle>
        </CardHeader>
        <CardContent>
          {dispatches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outbound dispatches yet.</p>
          ) : (
            <div className="space-y-3">
              {dispatches.slice(0, 30).map((dispatch) => (
                <div key={dispatch._id} className="rounded-md border border-border p-3">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium">{dispatch.triggerName}</p>
                    <Badge variant={dispatch.status === 'sent' ? 'secondary' : 'outline'} className="text-xs">
                      {dispatch.status}
                    </Badge>
                    <Badge variant="outline" className="text-xs">{dispatch.channel}</Badge>
                    <span className="text-xs text-muted-foreground">{dispatch.recipient}</span>
                    <span className="text-xs text-muted-foreground">{timeAgo(dispatch.createdAt)}</span>
                  </div>
                  {dispatch.reason && (
                    <p className="text-xs text-muted-foreground">reason: {dispatch.reason}</p>
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
