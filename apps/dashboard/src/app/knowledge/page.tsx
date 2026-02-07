'use client';

import { useCallback, useState } from 'react';
import { useKnowledgeGaps, useKnowledgeDocuments } from '@/lib/hooks/use-api';
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
import { Plus, Search } from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import type { KnowledgeSearchResult } from '@/types/api';

export default function KnowledgePage() {
  const { api, ready } = useSession();
  const { data: gapsData, isLoading } = useKnowledgeGaps();
  const { data: docsData } = useKnowledgeDocuments();
  const [addOpen, setAddOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const handleAdd = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!api) return;
    const fd = new FormData(e.currentTarget);
    await api.post('/api/knowledge', {
      title: fd.get('title') as string,
      content: fd.get('content') as string,
      category: fd.get('category') as string,
    });
    setAddOpen(false);
  }, [api]);

  const handleSearch = useCallback(async () => {
    if (!api || !searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.post<{ results: KnowledgeSearchResult[] }>('/api/knowledge/search', {
        query: searchQuery,
        topK: 5,
      });
      setSearchResults(res.results);
    } finally {
      setSearching(false);
    }
  }, [api, searchQuery]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const gaps = gapsData?.gaps ?? [];
  const documents = docsData?.documents ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{documents.length} documents &middot; {gaps.length} gaps</p>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Add Document</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Knowledge Document</DialogTitle>
              <DialogDescription>Add a document to the knowledge base for RAG.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" required placeholder="Return Policy" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Content</Label>
                <Textarea id="content" name="content" required rows={5} placeholder="Our return policy allows..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Input id="category" name="category" required placeholder="policies" />
              </div>
              <Button type="submit" className="w-full">Add Document</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Search Knowledge Base</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Button size="sm" variant="outline" onClick={handleSearch} disabled={searching}>
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchResults && (
            <div className="space-y-3">
              {searchResults.length === 0 ? (
                <p className="text-sm text-muted-foreground">No results found.</p>
              ) : (
                searchResults.map((r) => (
                  <div key={r._id} className="rounded-md border border-border p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{r.title}</p>
                      <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.content}</p>
                    <p className="text-xs text-muted-foreground">Score: {r._score.toFixed(3)}</p>
                  </div>
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Title</th>
                    <th className="p-3 font-medium">Category</th>
                    <th className="p-3 font-medium">Source</th>
                    <th className="p-3 font-medium">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((d) => (
                    <tr key={d._id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium">{d.title}</td>
                      <td className="p-3"><Badge variant="secondary" className="text-xs">{d.category}</Badge></td>
                      <td className="p-3 text-muted-foreground">{d.sourceType}</td>
                      <td className="p-3 text-muted-foreground">{timeAgo(d.lastUpdated)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {gaps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Unresolved Gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {gaps.map((g) => (
                <div key={g._id} className="flex items-center justify-between rounded-md border border-border p-3">
                  <div className="space-y-1">
                    <p className="text-sm">{g.query}</p>
                    <p className="text-xs text-muted-foreground">Best match: {(g.bestMatchScore * 100).toFixed(0)}%</p>
                  </div>
                  <span className="text-xs text-muted-foreground">{timeAgo(g.createdAt)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
