import { describe, it, expect } from 'vitest';
import { monthStats, buildInsights, shiftMonth } from './report';

const cat = (name: string) => ({ name });
const tx = (id: string, description: string, amount: number, type: string, date: string, extra: any = {}) => ({
  id, description, amount, type, date, due_date: null, status: 'pending', priority: 'important',
  is_recurring: false, recurrence_interval: null, recurrence_end_date: null, categories: null, ...extra,
});

describe('report', () => {
  it('shiftMonth crosses years', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-11', 3)).toBe('2027-02');
  });

  it('monthStats projects recurring salary and groups by category', () => {
    const all = [
      tx('s', 'Salário', 6000, 'income', '2026-08-05', { is_recurring: true, recurrence_interval: 'monthly' }),
      tx('a', 'Aluguel', 2000, 'expense', '2026-08-10', { is_recurring: true, recurrence_interval: 'monthly', priority: 'essential', categories: cat('Moradia') }),
      tx('m', 'Mercado', 500, 'expense', '2026-10-12', { categories: cat('Alimentação') }),
    ];
    const s = monthStats(all, '2026-10');
    expect(s.income).toBe(6000);
    expect(s.expenses).toBe(2500);
    expect(s.needs).toBe(2000);
    expect(s.byCategory).toEqual({ Moradia: 2000, 'Alimentação': 500 });
  });

  it('flags a category above its recent average and negative months first', () => {
    const base = { month: '', paid: 0, needs: 0, lifestyle: 0, topExpenses: [], txCount: 3 };
    const past = [1, 2, 3].map(i => ({ ...base, month: `2026-0${i}`, income: 5000, expenses: 4000, leftover: 1000, byCategory: { Lazer: 300 } }));
    const current = { ...base, month: '2026-04', income: 5000, expenses: 5600, leftover: -600, byCategory: { Lazer: 900 } };
    const insights = buildInsights(current, past);
    expect(insights[0].tone).toBe('bad');
    expect(insights.some(i => i.title.startsWith('Lazer está'))).toBe(true);
    expect(insights.length).toBeLessThanOrEqual(3);
  });
});
