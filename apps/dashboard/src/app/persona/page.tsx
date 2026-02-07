'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePersona } from '@/lib/hooks/use-api';
import { useSession } from '@/lib/hooks/use-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';

export default function PersonaPage() {
  const { api, ready } = useSession();
  const { data, isLoading, mutate } = usePersona();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    personaName: '',
    personaGreeting: '',
    personaTone: '',
    preferredTerms: '',
    blockedTerms: '',
  });

  useEffect(() => {
    if (data) {
      setForm({
        personaName: data.personaName ?? '',
        personaGreeting: data.personaGreeting ?? '',
        personaTone: data.personaTone ?? '',
        preferredTerms: data.preferredTerms ?? '',
        blockedTerms: data.blockedTerms ?? '',
      });
    }
  }, [data]);

  const handleSave = useCallback(async () => {
    if (!api) return;
    setSaving(true);
    try {
      await api.patch('/api/persona', {
        personaName: form.personaName || undefined,
        personaGreeting: form.personaGreeting || undefined,
        personaTone: form.personaTone || undefined,
        preferredTerms: form.preferredTerms || undefined,
        blockedTerms: form.blockedTerms || undefined,
      });
      mutate();
    } finally {
      setSaving(false);
    }
  }, [api, form, mutate]);

  if (!ready || isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-muted-foreground border-t-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Brand Voice Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="personaName">Name</Label>
            <Input
              id="personaName"
              value={form.personaName}
              onChange={(e) => setForm((f) => ({ ...f, personaName: e.target.value }))}
              placeholder="Agent name (e.g., Aria)"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personaGreeting">Greeting</Label>
            <Textarea
              id="personaGreeting"
              value={form.personaGreeting}
              onChange={(e) => setForm((f) => ({ ...f, personaGreeting: e.target.value }))}
              placeholder="Hi there! How can I help you today?"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="personaTone">Tone</Label>
            <Input
              id="personaTone"
              value={form.personaTone}
              onChange={(e) => setForm((f) => ({ ...f, personaTone: e.target.value }))}
              placeholder="friendly, professional, empathetic"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredTerms">Preferred Terms (comma-separated)</Label>
            <Textarea
              id="preferredTerms"
              value={form.preferredTerms}
              onChange={(e) => setForm((f) => ({ ...f, preferredTerms: e.target.value }))}
              placeholder="customer, team member, partner"
              rows={2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="blockedTerms">Blocked Terms (comma-separated)</Label>
            <Textarea
              id="blockedTerms"
              value={form.blockedTerms}
              onChange={(e) => setForm((f) => ({ ...f, blockedTerms: e.target.value }))}
              placeholder="user, issue, problem"
              rows={2}
            />
          </div>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
