import { describe, it, expect } from 'vitest';
import { groupTransactions, recurrenceEnd } from './listGrouping';

const tx = (id: string, description: string, amount: number, extra: any = {}) => ({
  id, description, amount, type: 'expense', date: '2026-10-01', due_date: null, status: 'pending', priority: 'important', categories: null, ...extra,
});
const list = [
  tx('a', 'Pneu', 200, { due_date: '2026-10-25', priority: 'critical', categories: { name: 'Transporte' } }),
  tx('b', 'aluguel', 1600, { due_date: '2026-10-10', priority: 'essential', status: 'paid', categories: { name: 'Moradia' } }),
  tx('c', 'Internet', 90, { due_date: '2026-10-26', categories: { name: 'Moradia' } }),
  tx('s', 'Salário', 6000, { type: 'income', date: '2026-10-05', priority: 'optional', categories: { name: 'Salário' } }),
];

describe('groupTransactions', () => {
  it('groups by day, newest first', () => {
    expect(groupTransactions(list, 'day', 'date').map(g => g.key)).toEqual(['2026-10-26', '2026-10-25', '2026-10-10', '2026-10-05']);
  });

  it('groups by category with biggest spending first and subtotals', () => {
    const g = groupTransactions(list, 'category', 'date');
    expect(g.map(x => x.label)).toEqual(['Moradia', 'Transporte', 'Salário (entrada)']);
    expect(g[0].totalOut).toBe(1690);
  });

  it('groups by priority in fixed order with income last', () => {
    expect(groupTransactions(list, 'priority', 'date').map(g => g.label)).toEqual(['Essencial', 'Crítico', 'Importante', 'Entradas']);
  });

  it('puts paid expenses last inside each group, keeping the sort order', () => {
    const items = [
      tx('p1', 'Água', 50, { status: 'paid', due_date: '2026-10-20' }),
      tx('n1', 'Luz', 80, { due_date: '2026-10-20' }),
      tx('p2', 'Gás', 70, { status: 'paid', due_date: '2026-10-20' }),
      tx('n2', 'Net', 90, { due_date: '2026-10-20' }),
    ];
    const g = groupTransactions(items, 'none', 'amount');
    expect(g[0].items.map(t => t.id)).toEqual(['n2', 'n1', 'p2', 'p1']);
  });

  it('groups by status with pending first', () => {
    expect(groupTransactions(list, 'status', 'date').map(g => g.label)).toEqual(['Pendente', 'Pago', 'Entradas']);
  });

  it('sorts by name ignoring case and by amount, paid expenses last', () => {
    expect(groupTransactions(list, 'none', 'name')[0].items.map(t => t.id)).toEqual(['c', 'a', 's', 'b']);
    expect(groupTransactions(list, 'none', 'amount')[0].items.map(t => t.id)).toEqual(['s', 'a', 'c', 'b']);
  });
});

describe('recurrenceEnd', () => {
  const rec = (extra: any) => ({ is_recurring: true, recurrence_interval: 'monthly', date: '2026-10-25', ...extra });
  it('counts monthly occurrences left including the shown month', () => {
    expect(recurrenceEnd(rec({ recurrence_end_date: '2027-03-25' }))).toEqual({ label: 'mar/2027', remaining: 6 });
    expect(recurrenceEnd(rec({ recurrence_end_date: '2026-10-31' }))?.remaining).toBe(1);
  });
  it('skips the end month when the end date is before the due day', () => {
    expect(recurrenceEnd(rec({ recurrence_end_date: '2027-03-10' }))).toEqual({ label: 'fev/2027', remaining: 5 });
  });
  it('is null without an end date or when not recurring', () => {
    expect(recurrenceEnd(rec({ recurrence_end_date: null }))).toBeNull();
    expect(recurrenceEnd({ is_recurring: false, recurrence_end_date: '2027-01-01', date: '2026-10-01' })).toBeNull();
  });
  it('shows the full date for weekly series', () => {
    expect(recurrenceEnd(rec({ recurrence_interval: 'weekly', recurrence_end_date: '2027-01-15' }))).toEqual({ label: '15/01/2027', remaining: null });
  });
});
