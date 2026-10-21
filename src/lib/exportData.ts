// Full backup of the signed-in user's data as a JSON file download.
import { supabase } from '@/integrations/supabase/client';

const TABLES = ['categories', 'transactions', 'credit_cards', 'card_expenses', 'debts', 'fixed_bills', 'user_settings'] as const;

async function fetchAll(table: (typeof TABLES)[number]) {
  const PAGE = 1000;
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').order('id').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

export async function exportMyData(): Promise<number> {
  const { data: auth } = await supabase.auth.getUser();
  const tables: Record<string, unknown[]> = {};
  for (const t of TABLES) tables[t] = await fetchAll(t);

  const payload = {
    exported_at: new Date().toISOString(),
    user: { id: auth.user?.id, email: auth.user?.email },
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    tables,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fincontrol-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return tables.transactions.length;
}
