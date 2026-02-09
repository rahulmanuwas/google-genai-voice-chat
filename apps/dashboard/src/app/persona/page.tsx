'use client';

import { useCallback, useState } from 'react';
import { usePersonas } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Pencil, Trash2, Save } from 'lucide-react';
import { SCENARIOS } from '@/lib/scenarios';
import type { Persona } from '@/types/api';

const EMPTY_FORM = {
  name: '',
  systemPrompt: '',
  personaName: '',
  personaGreeting: '',
  personaTone: '',
  preferredTerms: '',
  blockedTerms: '',
};

export default function PersonaPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = usePersonas();
  const personas = data?.personas ?? [];

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Assignment state: track pending assignment calls per app slug
  const [assigning, setAssigning] = useState<Record<string, boolean>>({});

  const openCreate = useCallback(() => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((persona: Persona) => {
    setEditingId(persona._id);
    setForm({
      name: persona.name,
      systemPrompt: persona.systemPrompt,
      personaName: persona.personaName ?? '',
      personaGreeting: persona.personaGreeting ?? '',
      personaTone: persona.personaTone ?? '',
      preferredTerms: persona.preferredTerms ?? '',
      blockedTerms: persona.blockedTerms ?? '',
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!api || !form.name || !form.systemPrompt) return;
    setSaving(true);
    try {
      if (editingId) {
        await api.patch('/api/personas', {
          personaId: editingId,
          name: form.name,
          systemPrompt: form.systemPrompt,
          personaName: form.personaName || undefined,
          personaGreeting: form.personaGreeting || undefined,
          personaTone: form.personaTone || undefined,
          preferredTerms: form.preferredTerms || undefined,
          blockedTerms: form.blockedTerms || undefined,
        });
      } else {
        await api.post('/api/personas', {
          name: form.name,
          systemPrompt: form.systemPrompt,
          personaName: form.personaName || undefined,
          personaGreeting: form.personaGreeting || undefined,
          personaTone: form.personaTone || undefined,
          preferredTerms: form.preferredTerms || undefined,
          blockedTerms: form.blockedTerms || undefined,
        });
      }
      mutate();
      setDialogOpen(false);
    } finally {
      setSaving(false);
    }
  }, [api, editingId, form, mutate]);

  const handleDelete = useCallback(async (personaId: string) => {
    if (!api) return;
    await api.delete('/api/personas', { personaId });
    mutate();
  }, [api, mutate]);

  const handleAssign = useCallback(async (appSlug: string, personaId: string | null) => {
    if (!api) return;
    setAssigning((prev) => ({ ...prev, [appSlug]: true }));
    try {
      await api.patch('/api/personas/assign', {
        targetAppSlug: appSlug,
        personaId,
      });
      mutate();
    } finally {
      setAssigning((prev) => ({ ...prev, [appSlug]: false }));
    }
  }, [api, mutate]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ─── Section 1: Persona Library ─────────────────────────── */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium">Persona Library</h2>
            <p className="text-xs text-muted-foreground">
              Create and manage reusable personas. Assign them to apps below.
            </p>
          </div>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New Persona
          </Button>
        </div>

        {personas.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No personas yet. Create one to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {personas.map((p) => (
              <Card key={p._id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{p.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(p)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(p._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {p.personaName && (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {p.personaName}
                      </Badge>
                    </div>
                  )}
                  {p.personaTone && (
                    <div>
                      <span className="text-muted-foreground">Tone: </span>
                      <span className="text-xs">{p.personaTone}</span>
                    </div>
                  )}
                  <details className="pt-1">
                    <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                      System prompt
                    </summary>
                    <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2 text-xs">
                      {p.systemPrompt}
                    </pre>
                  </details>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ─── Section 2: App Assignment ──────────────────────────── */}
      <div>
        <div className="mb-4">
          <h2 className="text-sm font-medium">App Assignment</h2>
          <p className="text-xs text-muted-foreground">
            Assign a persona to each scenario app. The agent will use the assigned persona at runtime.
          </p>
        </div>

        <Card>
          <CardContent className="divide-y py-0">
            {SCENARIOS.map((s) => (
              <div
                key={s.appSlug}
                className="flex items-center justify-between gap-4 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span>{s.icon}</span>
                    <span className="text-sm font-medium">{s.chatTitle}</span>
                    <Badge variant="outline" className="text-xs">
                      {s.appSlug}
                    </Badge>
                  </div>
                </div>
                <div className="w-56 shrink-0">
                  <Select
                    value="none"
                    onValueChange={(val) =>
                      handleAssign(s.appSlug, val === 'none' ? null : val)
                    }
                    disabled={assigning[s.appSlug]}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="No persona assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (use default)</SelectItem>
                      {personas.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Persona Editor Dialog ──────────────────────────────── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Persona' : 'New Persona'}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? 'Update the persona details below.'
                : 'Fill in the details for your new persona.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="p-name">Name *</Label>
              <Input
                id="p-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Sarah - Dentist Receptionist"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-systemPrompt">System Prompt *</Label>
              <Textarea
                id="p-systemPrompt"
                value={form.systemPrompt}
                onChange={(e) =>
                  setForm((f) => ({ ...f, systemPrompt: e.target.value }))
                }
                placeholder="You are Sarah, a friendly..."
                rows={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-personaName">Agent Name</Label>
              <Input
                id="p-personaName"
                value={form.personaName}
                onChange={(e) =>
                  setForm((f) => ({ ...f, personaName: e.target.value }))
                }
                placeholder="Sarah"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-greeting">Greeting</Label>
              <Textarea
                id="p-greeting"
                value={form.personaGreeting}
                onChange={(e) =>
                  setForm((f) => ({ ...f, personaGreeting: e.target.value }))
                }
                placeholder="Hi there! How can I help you today?"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-tone">Tone</Label>
              <Input
                id="p-tone"
                value={form.personaTone}
                onChange={(e) =>
                  setForm((f) => ({ ...f, personaTone: e.target.value }))
                }
                placeholder="friendly, professional, empathetic"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-preferred">Preferred Terms</Label>
              <Input
                id="p-preferred"
                value={form.preferredTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, preferredTerms: e.target.value }))
                }
                placeholder="customer, team member, partner"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-blocked">Blocked Terms</Label>
              <Input
                id="p-blocked"
                value={form.blockedTerms}
                onChange={(e) =>
                  setForm((f) => ({ ...f, blockedTerms: e.target.value }))
                }
                placeholder="user, issue, problem"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || !form.name || !form.systemPrompt}
              >
                <Save className="mr-1.5 h-3.5 w-3.5" />
                {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
