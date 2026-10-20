import { describe, it, expect } from 'vitest';
import { cardInvoice, cardOpenBalance, matchesCard } from './cardInvoice';

const card = (closing_day: number | null, due_day: number | null) => ({ id: 'c', name: 'Nubank', closing_day, due_day });
const exp = (date: string, amount: number, installments = 1) => ({ id: date, card_id: 'c', description: 'x', date, amount, installments });

describe('cardInvoice', () => {
  it('purchase before closing goes to the invoice due the same month', () => {
    const inv = cardInvoice(card(5, 12), [exp('2026-10-03', 100)], 2026, 9);
    expect(inv.amount).toBe(100);
    expect(inv.dueDate?.getDate()).toBe(12);
  });

  it('purchase after closing goes to next invoice', () => {
    expect(cardInvoice(card(5, 12), [exp('2026-10-07', 100)], 2026, 9).amount).toBe(0);
    expect(cardInvoice(card(5, 12), [exp('2026-10-07', 100)], 2026, 10).amount).toBe(100);
  });

  it('due day before closing day means invoice is due the month after closing', () => {
    expect(cardInvoice(card(25, 5), [exp('2026-10-20', 100)], 2026, 9).amount).toBe(0);
    const nov = cardInvoice(card(25, 5), [exp('2026-10-20', 100)], 2026, 10);
    expect(nov.amount).toBe(100);
    expect(nov.closingDate?.getMonth()).toBe(9);
  });

  it('splits installments across consecutive invoices, crossing the year', () => {
    const e = [exp('2026-10-07', 300, 3)];
    expect(cardInvoice(card(5, 12), e, 2026, 10).items[0]).toMatchObject({ amount: 100, installment: 1 });
    expect(cardInvoice(card(5, 12), e, 2026, 11).items[0]).toMatchObject({ installment: 2 });
    expect(cardInvoice(card(5, 12), e, 2027, 0).items[0]).toMatchObject({ installment: 3 });
    expect(cardInvoice(card(5, 12), e, 2027, 1).amount).toBe(0);
  });

  it('without cycle configured, purchase counts in its own month', () => {
    expect(cardInvoice(card(null, null), [exp('2026-10-28', 50)], 2026, 9).amount).toBe(50);
  });

  it('open balance counts remaining installments from a month on', () => {
    expect(cardOpenBalance(card(5, 12), [exp('2026-10-07', 300, 3)], 2026, 11)).toBe(200);
  });
});

describe('matchesCard', () => {
  const tx = (description: string) => ({ type: 'expense', description });
  it('matches whole words, ignoring case', () => {
    expect(matchesCard(tx('Fatura Nubank'), 'Nubank')).toBe(true);
    expect(matchesCard(tx('fatura inter - out'), 'Inter')).toBe(true);
    expect(matchesCard(tx('Internet'), 'Inter')).toBe(false);
    expect(matchesCard(tx('Fatura C6'), 'C6')).toBe(true);
  });
});
