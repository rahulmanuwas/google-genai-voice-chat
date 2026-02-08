'use client';

import { useCallback, useState } from 'react';
import { useExperiments } from '@/lib/hooks/use-api';
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
import { Plus, Trash2 } from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface VariantInput {
  id: string;
  weight: number;
}

export default function ExperimentsPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = useExperiments();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [variants, setVariants] = useState<VariantInput[]>([
    { id: 'control', weight: 50 },
    { id: 'variant_a', weight: 50 },
  ]);

  const handleCreate = useCallback(async () => {
    if (!api || !name || variants.length < 2) return;
    await api.post('/api/experiments', { name, variants });
    setOpen(false);
    setName('');
    setVariants([{ id: 'control', weight: 50 }, { id: 'variant_a', weight: 50 }]);
    mutate();
  }, [api, name, variants, mutate]);

  const addVariant = () => {
    setVariants((v) => [...v, { id: `variant_${String.fromCharCode(97 + v.length - 1)}`, weight: 0 }]);
  };

  const removeVariant = (idx: number) => {
    if (variants.length <= 2) return;
    setVariants((v) => v.filter((_, i) => i !== idx));
  };

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  const experiments = data?.experiments ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{experiments.length} experiments</p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="mr-2 h-4 w-4" />Create Experiment</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Experiment</DialogTitle>
              <DialogDescription>Set up an A/B test with weighted variants.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Experiment Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="greeting_test" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variants</Label>
                  <Button size="sm" variant="ghost" onClick={addVariant}><Plus className="h-3 w-3 mr-1" />Add</Button>
                </div>
                {variants.map((v, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      value={v.id}
                      onChange={(e) => setVariants((vs) => vs.map((vv, j) => j === i ? { ...vv, id: e.target.value } : vv))}
                      placeholder="Variant ID"
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      value={v.weight}
                      onChange={(e) => setVariants((vs) => vs.map((vv, j) => j === i ? { ...vv, weight: Number(e.target.value) } : vv))}
                      className="w-20"
                      min={0}
                      max={100}
                    />
                    <span className="text-xs text-muted-foreground w-4">%</span>
                    {variants.length > 2 && (
                      <Button size="icon" variant="ghost" onClick={() => removeVariant(i)} className="h-8 w-8">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!name || variants.length < 2}>
                Create Experiment
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {experiments.length === 0 ? (
          <Card>
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">No experiments yet.</p>
            </CardContent>
          </Card>
        ) : (
          experiments.map((exp) => (
            <Card key={exp._id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium">{exp.name}</CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant={exp.isActive ? 'default' : 'secondary'}>
                    {exp.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{timeAgo(exp.createdAt)}</span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {exp.variants.map((v) => (
                    <Badge key={v.id} variant="outline" className="text-xs">
                      {v.id}: {v.weight}%
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
