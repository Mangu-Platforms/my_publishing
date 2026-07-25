// PERF-PHASE2-6 — Lean autosave server action (Phoenix WS2d dual-run)
'use server';

import { createClient } from '@/lib/supabase/server';
import { upsertReadingProgress } from '@/lib/data/reading';

export async function saveReadingProgress(bookId: string, position: number) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await upsertReadingProgress(user.id, bookId, position);
}
