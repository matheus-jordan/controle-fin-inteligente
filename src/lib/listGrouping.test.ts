import { describe, it, expect } from 'vitest';
import { groupTransactions } from './listGrouping';

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

  it('groups by status with pending first', () => {
    expect(groupTransactions(list, 'status', 'date').map(g => g.label)).toEqual(['Pendente', 'Pago', 'Entradas']);
  });

  it('sorts by name ignoring case and by amount', () => {
    expect(groupTransactions(list, 'none', 'name')[0].items.map(t => t.id)).toEqual(['b', 'c', 'a', 's']);
    expect(groupTransactions(list, 'none', 'amount')[0].items.map(t => t.id)).toEqual(['s', 'b', 'a', 'c']);
  });
});
