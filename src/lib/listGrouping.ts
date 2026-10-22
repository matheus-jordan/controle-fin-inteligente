// Grouping and sorting for the transactions list.

export type GroupBy = 'day' | 'category' | 'priority' | 'status' | 'none';
export type SortBy = 'date' | 'name' | 'amount';

export interface TxGroup {
  key: string;
  label: string; // for 'day' the key is a date (YYYY-MM-DD) and the screen formats it
  items: any[];
  totalIn: number;
  totalOut: number;
}

export const displayDateOf = (t: any): string => (t.type === 'income' ? t.date : (t.due_date || t.date));

const priorityOrder = ['essential', 'critical', 'important', 'optional'];
const priorityLabels: Record<string, string> = { essential: 'Essencial', critical: 'Crítico', important: 'Importante', optional: 'Opcional' };

function sortItems(items: any[], sortBy: SortBy): any[] {
  const byDate = (a: any, b: any) => displayDateOf(b).localeCompare(displayDateOf(a));
  const sorted = [...items];
  if (sortBy === 'name') sorted.sort((a, b) => a.description.localeCompare(b.description, 'pt-BR', { sensitivity: 'base' }) || byDate(a, b));
  else if (sortBy === 'amount') sorted.sort((a, b) => Number(b.amount) - Number(a.amount) || byDate(a, b));
  else sorted.sort(byDate);
  return sorted;
}

// Group key, label and rank (lower shows first) of a transaction for the chosen grouping
function groupOf(t: any, groupBy: GroupBy): { key: string; label: string; rank: number | string } {
  switch (groupBy) {
    case 'day': {
      const d = displayDateOf(t);
      return { key: d, label: d, rank: d };
    }
    case 'category': {
      const name = t.categories?.name ?? 'Sem categoria';
      return { key: `${t.type}|${name}`, label: t.type === 'income' ? `${name} (entrada)` : name, rank: 0 };
    }
    case 'priority':
      if (t.type === 'income') return { key: 'income', label: 'Entradas', rank: 99 };
      return { key: t.priority, label: priorityLabels[t.priority] ?? t.priority, rank: priorityOrder.indexOf(t.priority) };
    case 'status':
      if (t.type === 'income') return { key: 'income', label: 'Entradas', rank: 99 };
      return t.status === 'paid' ? { key: 'paid', label: 'Pago', rank: 1 } : { key: 'pending', label: 'Pendente', rank: 0 };
    default:
      return { key: 'all', label: '', rank: 0 };
  }
}

export function groupTransactions(list: any[], groupBy: GroupBy, sortBy: SortBy): TxGroup[] {
  const groups = new Map<string, TxGroup & { rank: number | string }>();
  for (const t of list) {
    const g = groupOf(t, groupBy);
    const entry = groups.get(g.key) ?? { key: g.key, label: g.label, rank: g.rank, items: [], totalIn: 0, totalOut: 0 };
    entry.items.push(t);
    if (t.type === 'income') entry.totalIn += Number(t.amount);
    else entry.totalOut += Number(t.amount);
    groups.set(g.key, entry);
  }
  const result = Array.from(groups.values());
  if (groupBy === 'day') result.sort((a, b) => String(b.rank).localeCompare(String(a.rank)));
  // Categories: biggest spending first, income categories last
  else if (groupBy === 'category') result.sort((a, b) => (b.totalOut - a.totalOut) || (a.totalIn - b.totalIn) || a.label.localeCompare(b.label, 'pt-BR'));
  else result.sort((a, b) => Number(a.rank) - Number(b.rank));
  return result.map(({ rank, ...g }) => ({ ...g, items: sortItems(g.items, sortBy) }));
}

// When a recurring transaction ends, and for monthly ones how many occurrences are left counting the shown one.
export function recurrenceEnd(t: any): { label: string; remaining: number | null } | null {
  if (!t.is_recurring || !t.recurrence_end_date) return null;
  const end = new Date(t.recurrence_end_date + 'T00:00:00');
  const interval = t.recurrence_interval || 'monthly';
  if (interval !== 'monthly') {
    return { label: end.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }), remaining: null };
  }
  const shown = new Date(t.date + 'T00:00:00');
  // The end month only has an occurrence if the end date isn't before that month's occurrence day
  const daysInEndMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const lastIdx = end.getFullYear() * 12 + end.getMonth() - (end.getDate() < Math.min(shown.getDate(), daysInEndMonth) ? 1 : 0);
  const remaining = lastIdx - (shown.getFullYear() * 12 + shown.getMonth()) + 1;
  const last = new Date(Math.floor(lastIdx / 12), lastIdx % 12, 1);
  const month = last.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  return { label: `${month}/${last.getFullYear()}`, remaining: Math.max(0, remaining) };
}
