'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useConversations, useMessages } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageSquare } from 'lucide-react';
import { timeAgo, formatDuration } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import type { Conversation } from '@/types/api';

/** Parse transcript JSON and return the first user message as a preview */
function getTranscriptPreview(c: Conversation): string {
  if (!c.transcript) return '—';
  try {
    const msgs = JSON.parse(c.transcript) as Array<{ role?: string; content?: string }>;
    const firstUser = msgs.find((m) => m.role === 'user' && m.content);
    if (firstUser?.content) {
      return firstUser.content.length > 80
        ? firstUser.content.slice(0, 80) + '...'
        : firstUser.content;
    }
    // If no user message, show first message
    const first = msgs.find((m) => m.content);
    if (first?.content) {
      return first.content.length > 80
        ? first.content.slice(0, 80) + '...'
        : first.content;
    }
  } catch {
    // not valid JSON
  }
  return '—';
}

export default function ConversationsPage() {
  const { ready } = useSession();
  const [tab, setTab] = useState('all');
  const { data, isLoading } = useConversations(tab === 'all' ? undefined : tab);
  const [sessionId, setSessionId] = useState('');
  const [searchId, setSearchId] = useState<string | null>(null);
  const { data: messagesData, isLoading: messagesLoading } = useMessages(searchId);

  const handleSearch = () => {
    if (sessionId.trim()) setSearchId(sessionId.trim());
  };

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const conversations = data?.conversations ?? [];
  const messages = messagesData?.messages ?? [];

  return (
    <div className="space-y-6">
      <PageHeader title="Conversations" count={conversations.length}>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Session ID lookup..."
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-8 w-48 text-xs sm:w-64"
          />
          <Button size="sm" variant="outline" onClick={handleSearch} className="h-8 w-8 p-0" aria-label="Search session ID">
            <Search className="h-3.5 w-3.5" />
          </Button>
        </div>
      </PageHeader>

      {searchId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Transcript: {searchId.slice(0, 20)}...
            </CardTitle>
          </CardHeader>
          <CardContent>
            {messagesLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
              </div>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No messages found for this session.</p>
            ) : (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {messages
                  .filter((m) => m.isFinal)
                  .sort((a, b) => a.createdAt - b.createdAt)
                  .map((m) => (
                    <div key={m._id} className={`flex gap-3 ${m.role === 'agent' ? '' : 'flex-row-reverse'}`}>
                      <Badge variant={m.role === 'agent' ? 'secondary' : 'outline'} className="h-6 shrink-0 text-xs">{m.role}</Badge>
                      <div className={`max-w-[90%] md:max-w-[80%] rounded-lg px-3 py-2 text-sm ${m.role === 'agent' ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'}`}>
                        {m.content}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="resolved">Resolved</TabsTrigger>
          <TabsTrigger value="handed_off">Handed Off</TabsTrigger>
          <TabsTrigger value="abandoned">Abandoned</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          {conversations.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No conversations yet"
              description="Conversations appear here when users interact with your agent via voice chat, text, or phone. Try a live demo to see your first conversation."
            />
          ) : (
            <Card>
              <CardContent className="p-0">
                {/* Desktop table */}
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-muted-foreground">
                        <th className="p-3 font-medium">App</th>
                        <th className="p-3 font-medium">Preview</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium">Channel</th>
                        <th className="p-3 font-medium">Msgs</th>
                        <th className="p-3 font-medium">Duration</th>
                        <th className="p-3 font-medium">Started</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conversations.map((c) => (
                        <tr key={c._id} className="border-b border-border last:border-0 hover:bg-muted/50">
                          <td className="p-3">
                            <Badge variant="secondary" className="text-xs">{c.appSlug}</Badge>
                          </td>
                          <td className="p-3 max-w-xs">
                            <Link href={`/conversations/${c.sessionId}`} className="text-blue-400 hover:underline text-xs">
                              {getTranscriptPreview(c)}
                            </Link>
                          </td>
                          <td className="p-3">
                            <StatusBadge value={c.status ?? 'active'} />
                          </td>
                          <td className="p-3 text-muted-foreground">{c.channel ?? '—'}</td>
                          <td className="p-3">{c.messageCount}</td>
                          <td className="p-3 text-muted-foreground">
                            {c.endedAt ? formatDuration(c.endedAt - c.startedAt) : 'ongoing'}
                          </td>
                          <td className="p-3 text-muted-foreground">{timeAgo(c.startedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile card list */}
                <div className="divide-y divide-border md:hidden">
                  {conversations.map((c) => (
                    <div key={c._id} className="space-y-1.5 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="secondary" className="text-xs">{c.appSlug}</Badge>
                        <StatusBadge value={c.status ?? 'active'} />
                      </div>
                      <Link href={`/conversations/${c.sessionId}`} className="block text-blue-400 hover:underline text-xs">
                        {getTranscriptPreview(c)}
                      </Link>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{c.messageCount} msgs</span>
                        <span>{c.endedAt ? formatDuration(c.endedAt - c.startedAt) : 'ongoing'}</span>
                        <span>{timeAgo(c.startedAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
