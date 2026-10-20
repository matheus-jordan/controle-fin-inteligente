// Credit card invoice math. Invoices are identified by the month their due date falls in.
// `amount` on a card expense is the total purchase value, split evenly across `installments`.

export interface InvoiceItem {
  id: string;
  description: string;
  amount: number; // this invoice's share
  installment: number; // 1-based
  installments: number;
}

export interface CardInvoice {
  cardId: string;
  cardName: string;
  month: string; // YYYY-MM of the due date
  closingDate: Date | null;
  dueDate: Date | null;
  amount: number;
  items: InvoiceItem[];
}

const monthKey = (y: number, m: number) => {
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
};

const clampDay = (y: number, m: number, day: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()));

// Month index (year*12 + month) of the invoice that receives a purchase made on `date`.
function firstInvoiceIndex(card: any, date: Date): number {
  const idx = date.getFullYear() * 12 + date.getMonth();
  if (!card.closing_day) return idx; // no cycle configured: purchase counts in its own month
  const closing = clampDay(date.getFullYear(), date.getMonth(), card.closing_day);
  // Purchases after the closing day go to the next cycle
  const cycleIdx = date.getTime() > closing.getTime() ? idx + 1 : idx;
  // Due day before (or on) the closing day means the invoice is due the month after it closes
  const dueAfterClose = card.due_day && card.due_day <= card.closing_day ? 1 : 0;
  return cycleIdx + dueAfterClose;
}

export function cardInvoice(card: any, expenses: any[], year: number, monIdx: number): CardInvoice {
  const target = year * 12 + monIdx;
  const items: InvoiceItem[] = [];
  for (const e of expenses) {
    if (e.card_id !== card.id) continue;
    const n = Math.max(1, Number(e.installments) || 1);
    const k = target - firstInvoiceIndex(card, new Date(e.date + 'T00:00:00'));
    if (k < 0 || k >= n) continue;
    items.push({
      id: e.id,
      description: e.description,
      amount: Math.round((Number(e.amount) / n) * 100) / 100,
      installment: k + 1,
      installments: n,
    });
  }
  const dueAfterClose = card.closing_day && card.due_day && card.due_day <= card.closing_day ? 1 : 0;
  return {
    cardId: card.id,
    cardName: card.name,
    month: monthKey(year, monIdx),
    closingDate: card.closing_day ? clampDay(year, monIdx - dueAfterClose, card.closing_day) : null,
    dueDate: card.due_day ? clampDay(year, monIdx, card.due_day) : null,
    amount: items.reduce((s, i) => s + i.amount, 0),
    items,
  };
}

// Sum of installments still to be billed from the invoice due in (year, monIdx) onwards.
export function cardOpenBalance(card: any, expenses: any[], year: number, monIdx: number): number {
  const from = year * 12 + monIdx;
  let total = 0;
  for (const e of expenses) {
    if (e.card_id !== card.id) continue;
    const n = Math.max(1, Number(e.installments) || 1);
    const first = firstInvoiceIndex(card, new Date(e.date + 'T00:00:00'));
    const remaining = Math.min(n, Math.max(0, first + n - from));
    total += (Number(e.amount) / n) * remaining;
  }
  return Math.round(total * 100) / 100;
}

// A transaction in the month that names the card stands for its invoice (manual entry or a paid invoice).
// Matches whole words only, so a card named "Inter" does not match "Internet".
export function matchesCard(t: any, cardName: string): boolean {
  const name = cardName.trim();
  if (t.type !== 'expense' || !name) return false;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(t.description);
}
