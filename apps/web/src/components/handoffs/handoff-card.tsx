'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { PriorityBadge } from './priority-badge';
import { timeAgo } from '@/lib/utils';
import type { Handoff } from '@/types/api';

interface HandoffCardProps {
  handoff: Handoff;
  onClaim?: (id: string) => void;
  onResolve?: (id: string) => void;
}

export function HandoffCard({ handoff, onClaim, onResolve }: HandoffCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-sm font-medium">{handoff.reason}</CardTitle>
          <p className="text-xs text-muted-foreground">
            Session: {handoff.sessionId.slice(0, 12)}... &middot; {timeAgo(handoff.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PriorityBadge priority={handoff.priority} />
          <StatusBadge value={handoff.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {handoff.aiSummary && (
          <p className="text-sm text-muted-foreground">{handoff.aiSummary}</p>
        )}
        {handoff.reasonDetail && (
          <p className="text-sm text-muted-foreground">{handoff.reasonDetail}</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary" className="text-xs">{handoff.channel}</Badge>
          {handoff.assignedAgent && <span>Assigned: {handoff.assignedAgent}</span>}
        </div>
        <div className="flex gap-2">
          {handoff.status === 'pending' && onClaim && (
            <Button size="sm" variant="outline" onClick={() => onClaim(handoff._id)}>
              Claim
            </Button>
          )}
          {(handoff.status === 'pending' || handoff.status === 'claimed') && onResolve && (
            <Button size="sm" variant="secondary" onClick={() => onResolve(handoff._id)}>
              Resolve
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
