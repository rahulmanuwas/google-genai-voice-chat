'use client';

import { use, useMemo } from 'react';
import { useMessages, useConversationBySession } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDuration, timeAgo } from '@/lib/utils';

interface TranscriptMessage {
  id: string;
  role: string;
  content: string;
  ts?: number;
}

export default function ConversationDetailPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = use(params);
  const { ready } = useSession();
  const { data: messagesData, isLoading: messagesLoading } = useMessages(ready ? sessionId : null);
  const { data: conversation, isLoading: convLoading } = useConversationBySession(ready ? sessionId : null);

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

  const isLoading = !ready || messagesLoading || convLoading;

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

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
                    className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
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
