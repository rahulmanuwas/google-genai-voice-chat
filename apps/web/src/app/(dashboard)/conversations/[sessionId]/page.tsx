'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useMessages, useConversationBySession, useAnnotation } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Sparkles, ThumbsUp, ThumbsDown, Minus, ArrowUpDown, ScanSearch, Save, CheckCircle2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { TurnAudioButton } from '@/components/conversations/turn-audio-button';
import { FAILURE_MODES, type FailureMode } from '@/types/api';

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  ts?: number;
  audioUrl?: string;
}

interface AISummary {
  summary: string;
  sentiment: string;
  topics: string[];
  resolution: string;
}

interface RoleRecording {
  role: 'user' | 'agent';
  audioUrl: string;
  audioMimeType?: string;
}

function normalizeSpeakerRole(role: string): 'user' | 'agent' {
  const normalized = role.trim().toLowerCase();
  if (normalized === 'agent' || normalized === 'assistant' || normalized === 'model') {
    return 'agent';
  }
  return 'user';
}

const SENTIMENT_CONFIG: Record<string, { icon: typeof ThumbsUp; label: string; color: string }> = {
  positive: { icon: ThumbsUp, label: 'Positive', color: 'text-emerald-500' },
  negative: { icon: ThumbsDown, label: 'Negative', color: 'text-red-500' },
  neutral: { icon: Minus, label: 'Neutral', color: 'text-muted-foreground' },
  mixed: { icon: ArrowUpDown, label: 'Mixed', color: 'text-amber-500' },
};

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { api, ready } = useSession();
  const { data: conversation, isLoading: convLoading } = useConversationBySession(ready ? sessionId : null);
  const messageAppSlug = conversation?.appSlug ?? null;
  const { data: messagesData, isLoading: messagesLoading } = useMessages(
    ready ? sessionId : null,
    messageAppSlug,
  );
  const { data: annotationData, mutate: mutateAnnotation } = useAnnotation(ready ? sessionId : null);

  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Annotation state
  const [qualityRating, setQualityRating] = useState<'good' | 'bad' | 'mixed' | null>(null);
  const [selectedFailureModes, setSelectedFailureModes] = useState<FailureMode[]>([]);
  const [annotationNotes, setAnnotationNotes] = useState('');
  const [annotationSaving, setAnnotationSaving] = useState(false);
  const [annotationSaved, setAnnotationSaved] = useState(false);

  // Hydrate from existing annotation
  useEffect(() => {
    const annotation = annotationData?.annotation;
    if (annotation) {
      setQualityRating(annotation.qualityRating);
      setSelectedFailureModes(annotation.failureModes as FailureMode[]);
      setAnnotationNotes(annotation.notes);
    }
  }, [annotationData]);

  const toggleFailureMode = useCallback((mode: FailureMode) => {
    setSelectedFailureModes((prev) =>
      prev.includes(mode) ? prev.filter((m) => m !== mode) : [...prev, mode],
    );
    setAnnotationSaved(false);
  }, []);

  const handleSaveAnnotation = useCallback(async () => {
    if (!api || !qualityRating) return;
    setAnnotationSaving(true);
    try {
      await api.post('/api/annotations', {
        sessionId,
        conversationId: conversation?._id,
        qualityRating,
        failureModes: selectedFailureModes,
        notes: annotationNotes,
      });
      setAnnotationSaved(true);
      mutateAnnotation();
    } finally {
      setAnnotationSaving(false);
    }
  }, [api, sessionId, conversation, qualityRating, selectedFailureModes, annotationNotes, mutateAnnotation]);

  // Combine messages from the messages table and the conversation transcript field
  const transcript = useMemo<TranscriptMessage[]>(() => {
    const msgs = messagesData?.messages ?? [];
    const finalMsgs = msgs.filter((m) => m.isFinal);

    if (finalMsgs.length > 0) {
      return finalMsgs
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
          ts: m.createdAt,
          audioUrl: m.audioUrl,
        }));
    }

    // Fallback: parse the conversation's transcript JSON field
    if (conversation?.transcript) {
      try {
        const parsed = JSON.parse(conversation.transcript) as Array<{
          role?: string;
          content?: string;
          ts?: number;
        }>;
        return parsed
          .filter((m) => m.content)
          .map((m, i) => ({
            id: `transcript-${i}`,
            role: m.role ?? 'unknown',
            content: m.content!,
            ts: m.ts,
          }));
      } catch {
        // not valid JSON
      }
    }

    return [];
  }, [messagesData, conversation]);

  const roleRecordings = useMemo<RoleRecording[]>(() => {
    const byRole = new Map<'user' | 'agent', RoleRecording>();
    for (const message of messagesData?.messages ?? []) {
      if (!message.audioUrl) continue;
      const role = normalizeSpeakerRole(message.role);
      byRole.set(role, {
        role,
        audioUrl: message.audioUrl,
        audioMimeType: message.audioMimeType,
      });
    }
    return ['user', 'agent']
      .map((role) => byRole.get(role as 'user' | 'agent'))
      .filter((recording): recording is RoleRecording => Boolean(recording));
  }, [messagesData]);

  const fetchSummary = useCallback(async (msgs: TranscriptMessage[]) => {
    setSummaryLoading(true);
    setSummaryError(null);
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: msgs.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok) throw new Error('Failed to generate summary');
      const data = await res.json();
      setAiSummary(data);
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Summary failed');
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  // Auto-summarize when transcript loads
  useEffect(() => {
    if (transcript.length >= 2 && !aiSummary && !summaryLoading && !summaryError) {
      fetchSummary(transcript);
    }
  }, [transcript, aiSummary, summaryLoading, summaryError, fetchSummary]);

  const isLoading = !ready || messagesLoading || convLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const sentimentCfg = SENTIMENT_CONFIG[aiSummary?.sentiment ?? ''] ?? SENTIMENT_CONFIG.neutral;
  const SentimentIcon = sentimentCfg.icon;

  return (
    <div className="space-y-6">
      <PageHeader title="Conversation" description={`Session ${sessionId.slice(0, 16)}...`} />

      {/* Conversation metadata */}
      {conversation && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">App: </span>
                <Badge variant="secondary" className="text-xs">{conversation.appSlug}</Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Status: </span>
                <StatusBadge value={conversation.status ?? 'active'} />
              </div>
              {conversation.channel && (
                <div>
                  <span className="text-muted-foreground">Channel: </span>
                  <span>{conversation.channel}</span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Messages: </span>
                <span>{conversation.messageCount}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Duration: </span>
                <span>
                  {conversation.endedAt
                    ? formatDuration(conversation.endedAt - conversation.startedAt)
                    : 'ongoing'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Started: </span>
                <span>{timeAgo(conversation.startedAt)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {roleRecordings.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Voice Recordings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {roleRecordings.map((recording) => (
              <div key={recording.role} className="space-y-1.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant={recording.role === 'agent' ? 'secondary' : 'outline'} className="text-[10px]">
                    {recording.role === 'agent' ? 'Agent' : 'Customer'}
                  </Badge>
                </div>
                <audio controls preload="none" className="w-full">
                  <source src={recording.audioUrl} type={recording.audioMimeType} />
                </audio>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* AI Summary */}
      {transcript.length >= 2 && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <CardTitle className="text-sm font-medium">AI Summary</CardTitle>
            {summaryLoading && (
              <div className="ml-auto h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
            )}
          </CardHeader>
          <CardContent>
            {summaryLoading && (
              <p className="text-sm text-muted-foreground">Analyzing conversation...</p>
            )}
            {summaryError && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-red-500">{summaryError}</p>
                <button
                  onClick={() => fetchSummary(transcript)}
                  className="text-xs text-muted-foreground underline hover:text-foreground"
                >
                  Retry
                </button>
              </div>
            )}
            {aiSummary && (
              <div className="space-y-3">
                <p className="text-sm leading-relaxed">{aiSummary.summary}</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <SentimentIcon className={`h-3.5 w-3.5 ${sentimentCfg.color}`} />
                    <span className={`text-xs font-medium ${sentimentCfg.color}`}>
                      {sentimentCfg.label}
                    </span>
                  </div>
                  {aiSummary.resolution && aiSummary.resolution !== 'unknown' && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {aiSummary.resolution}
                    </Badge>
                  )}
                  {aiSummary.topics?.map((topic) => (
                    <Badge key={topic} variant="secondary" className="text-xs">
                      {topic}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Annotation Panel */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-3">
          <CheckCircle2 className="h-4 w-4 text-blue-500" />
          <CardTitle className="text-sm font-medium">Quality Annotation</CardTitle>
          {annotationData?.annotation && (
            <Badge variant="secondary" className="ml-auto text-xs">
              Annotated {timeAgo(annotationData.annotation.updatedAt)}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Quality Rating */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quality Rating</Label>
            <div className="flex gap-2">
              {(['good', 'bad', 'mixed'] as const).map((rating) => (
                <Button
                  key={rating}
                  size="sm"
                  variant={qualityRating === rating ? 'default' : 'outline'}
                  onClick={() => { setQualityRating(rating); setAnnotationSaved(false); }}
                  className="gap-1.5"
                >
                  {rating === 'good' && <ThumbsUp className="h-3.5 w-3.5" />}
                  {rating === 'bad' && <ThumbsDown className="h-3.5 w-3.5" />}
                  {rating === 'mixed' && <ArrowUpDown className="h-3.5 w-3.5" />}
                  <span className="capitalize">{rating}</span>
                </Button>
              ))}
            </div>
          </div>

          {/* Failure Modes */}
          {(qualityRating === 'bad' || qualityRating === 'mixed') && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Failure Modes</Label>
              <div className="flex flex-wrap gap-2">
                {FAILURE_MODES.map((mode) => (
                  <Badge
                    key={mode}
                    variant={selectedFailureModes.includes(mode) ? 'default' : 'outline'}
                    className="cursor-pointer text-xs hover:opacity-80"
                    onClick={() => toggleFailureMode(mode)}
                  >
                    {mode.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea
              value={annotationNotes}
              onChange={(e) => { setAnnotationNotes(e.target.value); setAnnotationSaved(false); }}
              placeholder="What went wrong? What could be improved?"
              rows={3}
              className="text-sm"
            />
          </div>

          {/* Save */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => void handleSaveAnnotation()}
              disabled={!qualityRating || annotationSaving}
            >
              {annotationSaving ? (
                <>
                  <div className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-background border-t-transparent" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                  Save Annotation
                </>
              )}
            </Button>
            {annotationSaved && (
              <span className="text-xs text-emerald-500">Saved</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* View Full Trace */}
      {messagesData?.messages?.[0]?.traceId && (
        <Link href={`/traces/${messagesData.messages[0].traceId}?sessionId=${sessionId}`}>
          <Button variant="outline" size="sm" className="gap-1.5">
            <ScanSearch className="h-3.5 w-3.5" />
            View Full Trace
          </Button>
        </Link>
      )}

      {/* Transcript */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Transcript
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transcript.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transcript available for this conversation.</p>
          ) : (
            <div className="space-y-3">
              {transcript.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 ${m.role === 'agent' ? '' : 'flex-row-reverse'}`}
                >
                  <Badge
                    variant={m.role === 'agent' ? 'secondary' : 'outline'}
                    className="h-6 shrink-0 text-xs"
                  >
                    {m.role}
                  </Badge>
                  <TurnAudioButton audioUrl={m.audioUrl} className="mt-0.5" />
                  <div
                    className={`max-w-[90%] md:max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                      m.role === 'agent'
                        ? 'bg-muted text-foreground'
                        : 'bg-primary text-primary-foreground'
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
