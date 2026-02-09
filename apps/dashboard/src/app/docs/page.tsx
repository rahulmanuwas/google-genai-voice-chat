'use client';

import { useState, useMemo } from 'react';
import { Search, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ALL_ENDPOINTS,
  CATEGORIES,
  METHOD_COLORS,
  type EndpointDef,
  type Category,
} from '@/lib/api-reference';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/layout/page-header';

function EndpointCard({ endpoint }: { endpoint: EndpointDef }) {
  const [open, setOpen] = useState(false);
  const hasDetails =
    (endpoint.requestFields && endpoint.requestFields.length > 0) ||
    endpoint.response ||
    endpoint.auth;

  return (
    <div className="rounded-lg border border-border bg-card transition-colors hover:border-border/80">
      <button
        type="button"
        onClick={() => hasDetails && setOpen((o) => !o)}
        className={cn(
          'flex w-full items-start gap-3 p-4 text-left',
          hasDetails && 'cursor-pointer',
        )}
      >
        <Badge
          variant="outline"
          className={cn(
            'mt-0.5 shrink-0 border font-mono text-xs font-semibold',
            METHOD_COLORS[endpoint.method],
          )}
        >
          {endpoint.method}
        </Badge>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium text-foreground">
            {endpoint.path}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {endpoint.description}
          </p>
        </div>
        {hasDetails &&
          (open ? (
            <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
          ))}
      </button>

      {open && hasDetails && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-4">
          {/* Auth */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span>{endpoint.auth}</span>
          </div>

          {/* Request fields */}
          {endpoint.requestFields && endpoint.requestFields.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {endpoint.method === 'GET' ? 'Query Parameters' : 'Request Body'}
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 pr-4 font-medium">Field</th>
                      <th className="pb-2 pr-4 font-medium">Type</th>
                      <th className="pb-2 pr-4 font-medium">Required</th>
                      <th className="pb-2 font-medium">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {endpoint.requestFields.map((f) => (
                      <tr
                        key={f.name}
                        className="border-b border-border/50 last:border-0"
                      >
                        <td className="py-1.5 pr-4 font-mono text-xs">
                          {f.name}
                        </td>
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground">
                          {f.type}
                        </td>
                        <td className="py-1.5 pr-4">
                          {f.required ? (
                            <Badge variant="secondary" className="text-[10px]">
                              required
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              optional
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 text-xs text-muted-foreground">
                          {f.description}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Response */}
          {endpoint.response && (
            <div>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Response
              </p>
              <code className="text-xs text-muted-foreground">
                {endpoint.response}
              </code>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DocsPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ALL_ENDPOINTS.filter((ep) => {
      if (activeCategory !== 'all' && ep.category !== activeCategory) return false;
      if (!q) return true;
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.category.toLowerCase().includes(q)
      );
    });
  }, [search, activeCategory]);

  const grouped = useMemo(() => {
    const map = new Map<string, EndpointDef[]>();
    for (const ep of filtered) {
      const arr = map.get(ep.category) ?? [];
      arr.push(ep);
      map.set(ep.category, arr);
    }
    return map;
  }, [filtered]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Reference"
        count={ALL_ENDPOINTS.length}
        description={`${CATEGORIES.length} categories. All endpoints accept appSlug+appSecret or sessionToken auth.`}
      />

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search endpoints..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory('all')}
          className={cn(
            'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
            activeCategory === 'all'
              ? 'border-foreground/30 bg-foreground/10 text-foreground'
              : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'rounded-md border px-3 py-1 text-xs font-medium transition-colors',
              activeCategory === cat
                ? 'border-foreground/30 bg-foreground/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/20 hover:text-foreground',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Endpoints grouped by category */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No endpoints match your search.
        </p>
      ) : (
        Array.from(grouped.entries()).map(([category, endpoints]) => (
          <section key={category}>
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              {category}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                ({endpoints.length})
              </span>
            </h2>
            <div className="space-y-2">
              {endpoints.map((ep) => (
                <EndpointCard
                  key={`${ep.method}-${ep.path}`}
                  endpoint={ep}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
