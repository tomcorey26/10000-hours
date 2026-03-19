'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useHaptics } from '@/hooks/use-haptics';

export function AddHabitForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const { trigger } = useHaptics();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    await onAdd(name.trim());
    trigger('success');
    setName('');
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <Input placeholder="New habit name (max 30 chars)" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" maxLength={30} />
      <Button type="submit" disabled={loading || !name.trim()}>Add</Button>
    </form>
  );
}
