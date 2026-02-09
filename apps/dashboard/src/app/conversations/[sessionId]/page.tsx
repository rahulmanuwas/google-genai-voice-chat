'use client';

import { use, useCallback, useEffect, useMemo, useState } from 'react';
import { useMessages, useConversationBySession } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration, timeAgo } from '@/lib/utils';
import { Sparkles, ThumbsUp, ThumbsDown, Minus, ArrowUpDown } from 'lucide-react';

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  ts?: number;
}

interface AISummary {
  summary: string;
  sentiment: string;
  topics: string[];
  resolution: string;
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
  const { ready } = useSession();
  const { data: messagesData, isLoading: messagesLoading } = useMessages(ready ? sessionId : null);
  const { data: conversation, isLoading: convLoading } = useConversationBySession(ready ? sessionId : null);

  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

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
                <Badge variant="outline" className="text-xs">{conversation.status ?? 'active'}</Badge>
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
