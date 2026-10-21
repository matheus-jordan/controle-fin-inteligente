import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDaysUntilDue, getDueDateStatus } from '@/lib/format';
import { cardInvoice, matchesCard, type CardInvoice } from '@/lib/cardInvoice';
import { projectOccurrence, buildMonth } from '@/lib/recurrence';

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useTransactions(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transactions', user?.id],
    queryFn: async () => {
      // The API caps each response at 1000 rows, so fetch page by page
      const PAGE = 1000;
      const rows = [];
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('transactions')
          .select('*, categories(*)')
          .eq('user_id', user!.id)
          .order('date', { ascending: false })
          .order('id')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        rows.push(...data);
        if (data.length < PAGE) break;
      }
      return rows;
    },
    select: (data) => (month ? buildMonth(data, month) : data),
    enabled: !!user,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { name: string; type: 'income' | 'expense'; color: string; icon: string }) => {
      const { data: row, error } = await supabase.from('categories').insert({ ...data, user_id: user!.id } as any).select().single();
      if (error) throw error;
      return row;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name: string; color: string }) => {
      const { data: rows, error } = await supabase.from('categories').update(data).eq('id', id).select('id');
      if (error) throw error;
      // RLS silently skips rows the user can't edit (shared default categories)
      if (!rows?.length) throw new Error('not_editable');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
    },
  });
}

// Moves everything in a category to `moveTo` (or leaves it uncategorized), then deletes the category.
export function useDeleteCategory() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, moveTo }: { id: string; moveTo: string | null }) => {
      // Shared default categories can't be deleted: stop before moving anything
      const { data: cat, error: e1 } = await supabase.from('categories').select('*').eq('id', id).single();
      if (e1) throw e1;
      if ((cat as any).user_id !== user!.id) throw new Error('not_editable');
      for (const table of ['transactions', 'card_expenses', 'fixed_bills'] as const) {
        const { error } = await supabase.from(table).update({ category_id: moveTo }).eq('category_id', id).eq('user_id', user!.id);
        if (error) throw error;
      }
      const { data: rows, error } = await supabase.from('categories').delete().eq('id', id).select('id');
      if (error) throw error;
      if (!rows?.length) throw new Error('not_editable');
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['card_expenses'] });
      qc.invalidateQueries({ queryKey: ['fixed_bills'] });
    },
  });
}

// Sets the category of several transactions at once (projected months update their series).
export function useSetTransactionsCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, categoryId }: { ids: string[]; categoryId: string }) => {
      const realIds = Array.from(new Set(ids.map(realId)));
      const { error } = await supabase.from('transactions').update({ category_id: categoryId }).in('id', realIds);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

// Strip virtual suffix used for projected recurring occurrences.
function realId(id: string): string {
  const idx = id.indexOf('-virtual-');
  return idx === -1 ? id : id.slice(0, idx);
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      description: string;
      amount: number;
      type: 'income' | 'expense';
      category_id?: string;
      date: string;
      priority: 'essential' | 'critical' | 'important' | 'optional';
      status: string;
      due_date?: string | null;
      is_recurring?: boolean;
      recurrence_interval?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
      recurrence_end_date?: string | null;
    }) => {
      const { error } = await supabase.from('transactions').insert({ ...data, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const idx = id.indexOf('-virtual-');
      if (idx === -1) {
        const { error } = await supabase.from('transactions').update({ status }).eq('id', id);
        if (error) throw error;
        return;
      }
      // Projected occurrence of a recurring transaction: save this month as its own row,
      // so the status applies only to this occurrence and not to the whole series.
      const occDate = id.slice(idx + '-virtual-'.length);
      const { data: r, error: e1 } = await supabase.from('transactions').select('*').eq('id', id.slice(0, idx)).single();
      if (e1) throw e1;
      const [y, m] = occDate.split('-').map(Number);
      const occ = projectOccurrence(r, y, m - 1);
      const { error } = await supabase.from('transactions').insert({
        user_id: r.user_id,
        category_id: r.category_id,
        description: r.description,
        amount: r.amount,
        type: r.type,
        priority: r.priority,
        date: occDate,
        due_date: occ?.due_date ?? null,
        is_recurring: false,
        status,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransactionFull() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      id: string;
      description: string;
      amount: number;
      type: 'income' | 'expense';
      category_id?: string;
      date: string;
      due_date?: string | null;
      priority: 'essential' | 'critical' | 'important' | 'optional';
      status: string;
      is_recurring?: boolean;
      recurrence_interval?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
      recurrence_end_date?: string | null;
    }) => {
      const { id, ...rest } = data;
      const { error } = await supabase.from('transactions').update({
        ...rest,
        user_id: user!.id,
      } as any).eq('id', realId(id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

// Ends a recurring series the day before `fromDate` and starts a new series from `fromDate` with the new data,
// so the change applies from that occurrence onwards and earlier months keep the old values.
export function useSplitRecurringTransaction() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, fromDate, data }: {
      id: string;
      fromDate: string;
      data: {
        description: string;
        amount: number;
        type: 'income' | 'expense';
        category_id?: string;
        due_date?: string | null;
        priority: 'essential' | 'critical' | 'important' | 'optional';
        status: string;
        recurrence_interval?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
        recurrence_end_date?: string | null;
      };
    }) => {
      const [y, m, d] = fromDate.split('-').map(Number);
      const dayBefore = new Date(y, m - 1, d - 1);
      const endStr = `${dayBefore.getFullYear()}-${(dayBefore.getMonth() + 1).toString().padStart(2, '0')}-${dayBefore.getDate().toString().padStart(2, '0')}`;
      const { error: e1 } = await supabase.from('transactions').update({ recurrence_end_date: endStr } as any).eq('id', realId(id));
      if (e1) throw e1;
      const { error } = await supabase.from('transactions').insert({
        ...data,
        date: fromDate,
        is_recurring: true,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', realId(id));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useFixedBills() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['fixed_bills', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('fixed_bills').select('*, categories(*)').eq('user_id', user!.id).order('due_day');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateFixedBill() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { name: string; amount: number; due_day: number; priority: string; category_id?: string }) => {
      const { error } = await supabase.from('fixed_bills').insert({
        name: data.name,
        amount: data.amount,
        due_day: data.due_day,
        priority: data.priority as 'essential' | 'critical' | 'important' | 'optional',
        category_id: data.category_id,
        user_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fixed_bills'] }),
  });
}

export function useDebts() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['debts', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('debts').select('*').eq('user_id', user!.id).order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateDebt() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: {
      name: string; total_amount: number;
      total_installments: number; installment_amount: number; priority: string; start_date: string;
      debt_kind?: 'single' | 'installments' | 'recurring';
      duration_months?: number | null;
      end_date?: string | null;
    }) => {
      const { error } = await supabase.from('debts').insert({
        name: data.name,
        total_amount: data.total_amount,
        total_installments: data.total_installments,
        installment_amount: data.installment_amount,
        priority: data.priority as 'essential' | 'critical' | 'important' | 'optional',
        start_date: data.start_date,
        debt_kind: data.debt_kind ?? 'installments',
        duration_months: data.duration_months ?? null,
        end_date: data.end_date ?? null,
        user_id: user!.id,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, paid_installments, status }: { id: string; paid_installments?: number; status?: string }) => {
      const updateData: Record<string, unknown> = {};
      if (paid_installments !== undefined) updateData.paid_installments = paid_installments;
      if (status !== undefined) updateData.status = status;
      const { error } = await supabase.from('debts').update(updateData as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useCreditCards() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['credit_cards', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('credit_cards').select('*').eq('user_id', user!.id).order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateCreditCard() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { name: string; color: string; last_digits?: string; credit_limit?: number; closing_day?: number; due_day?: number }) => {
      const { error } = await supabase.from('credit_cards').insert({ ...data, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_cards'] }),
  });
}

export function useUpdateCreditCard() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; color?: string; credit_limit?: number; closing_day?: number | null; due_day?: number | null }) => {
      const { error } = await supabase.from('credit_cards').update(data as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['credit_cards'] }),
  });
}

export interface MonthInvoice extends CardInvoice {
  // Transaction in the month that already represents this invoice (manual entry or paid invoice)
  registered: any | null;
}

// Invoices due in the given month, linked to any transaction that already stands for them.
export function useCardInvoices(month: string) {
  const cards = useCreditCards();
  const expenses = useCardExpenses();
  const transactions = useTransactions(month);
  const [y, m] = month.split('-').map(Number);
  const invoices: MonthInvoice[] = (cards.data ?? []).map(card => ({
    ...cardInvoice(card, expenses.data ?? [], y, m - 1),
    registered: (transactions.data ?? []).find(t => matchesCard(t, card.name)) ?? null,
  }));
  return {
    invoices,
    // Invoices that only exist as computed values and still need to be counted
    unregistered: invoices.filter(i => !i.registered && i.amount > 0),
    isLoading: cards.isLoading || expenses.isLoading || transactions.isLoading,
  };
}

export function usePayCardInvoice() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (invoice: CardInvoice) => {
      const { data: cat } = await supabase.from('categories').select('id').eq('name', 'Cartão de Crédito').eq('type', 'expense').maybeSingle();
      const toStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
      const due = invoice.dueDate ? toStr(invoice.dueDate) : `${invoice.month}-01`;
      const { error } = await supabase.from('transactions').insert({
        user_id: user!.id,
        description: `Fatura ${invoice.cardName}`,
        amount: invoice.amount,
        type: 'expense',
        category_id: cat?.id ?? null,
        date: due,
        due_date: invoice.dueDate ? due : null,
        priority: 'critical',
        status: 'paid',
        is_recurring: false,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useCardExpenses(cardId?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['card_expenses', user?.id, cardId],
    queryFn: async () => {
      let query = supabase.from('card_expenses').select('*, categories(*)').eq('user_id', user!.id).order('date', { ascending: false });
      if (cardId) query = query.eq('card_id', cardId);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateCardExpense() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (data: { card_id: string; description: string; amount: number; date: string; installments?: number; category_id?: string }) => {
      const { error } = await supabase.from('card_expenses').insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['card_expenses'] }),
  });
}

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: Date | null;
  daysUntil: number | null;
  urgency: 'overdue' | 'urgent' | 'warning' | 'ok' | 'none';
  priority: 'essential' | 'critical' | 'important' | 'optional';
  source: 'transaction' | 'fixed_bill' | 'debt' | 'card_invoice';
  invoice?: CardInvoice;
  status: 'pending' | 'paid';
}

// Returns the monthly installment amount that a debt contributes to target month, or 0 if not active that month.
function debtMonthlyImpact(debt: any, targetYear: number, targetMon: number): number {
  const start = new Date(debt.start_date + 'T00:00:00');
  const startMonths = start.getFullYear() * 12 + start.getMonth();
  const targetMonths = targetYear * 12 + targetMon;
  if (targetMonths < startMonths) return 0;

  const kind = debt.debt_kind ?? (debt.total_installments <= 1 ? 'single' : 'installments');

  if (kind === 'recurring') {
    if (debt.end_date) {
      const end = new Date(debt.end_date + 'T00:00:00');
      const endMonths = end.getFullYear() * 12 + end.getMonth();
      if (targetMonths > endMonths) return 0;
    }
    return Number(debt.installment_amount);
  }

  // single or installments — active for total_installments months starting at start_date
  const monthsFromStart = targetMonths - startMonths;
  if (monthsFromStart >= debt.total_installments) return 0;
  return Number(debt.installment_amount);
}

export function useUpcomingPayments(month?: string) {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(targetMonth);
  const fixedBills = useFixedBills();
  const debts = useDebts();
  const invoices = useCardInvoices(targetMonth);

  const payments: UpcomingPayment[] = [];

  (transactions.data ?? [])
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const hasDueDate = !!t.due_date;
      const dueDate = hasDueDate ? new Date(t.due_date + 'T00:00:00') : null;
      let daysUntil: number | null = null;
      let urgency: UpcomingPayment['urgency'] = 'none';

      if (dueDate) {
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const diffTime = dueDate.getTime() - today.getTime();
        daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        urgency = getDueDateStatus(daysUntil);
      }

      payments.push({
        id: t.id,
        name: t.description,
        amount: Number(t.amount),
        dueDate,
        daysUntil,
        urgency,
        priority: t.priority,
        source: 'transaction',
        status: t.status as 'pending' | 'paid',
      });
    });

  const [yearStr, monthStr] = targetMonth.split('-');
  const targetYear = parseInt(yearStr);
  const targetMon = parseInt(monthStr) - 1;

  (fixedBills.data ?? [])
    .filter(b => b.is_active)
    .forEach(b => {
      const dueDate = new Date(targetYear, targetMon, b.due_day);
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      payments.push({
        id: `bill-${b.id}`,
        name: b.name,
        amount: Number(b.amount),
        dueDate,
        daysUntil,
        urgency: getDueDateStatus(daysUntil),
        priority: b.priority,
        source: 'fixed_bill',
        status: 'pending',
      });
    });

  // Debts as expenses for the target month
  (debts.data ?? [])
    .filter(d => d.status === 'active')
    .forEach(d => {
      const impact = debtMonthlyImpact(d, targetYear, targetMon);
      if (impact <= 0) return;
      const kind = (d as any).debt_kind ?? (d.total_installments <= 1 ? 'single' : 'installments');
      // Index of this month in the debt's schedule (0-based)
      const start = new Date(d.start_date + 'T00:00:00');
      const monthIdx = (targetYear * 12 + targetMon) - (start.getFullYear() * 12 + start.getMonth());
      const isPaid = d.paid_installments > monthIdx;
      payments.push({
        id: `debt-${d.id}-${targetMonth}`,
        name: kind === 'recurring'
          ? d.name
          : `${d.name} (${monthIdx + 1}/${d.total_installments})`,
        amount: impact,
        dueDate: null,
        daysUntil: null,
        urgency: 'none',
        priority: d.priority,
        source: 'debt',
        status: isPaid ? 'paid' : 'pending',
      });
    });

  // Card invoices computed from card purchases and not yet registered as a transaction
  invoices.unregistered.forEach(inv => {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const daysUntil = inv.dueDate ? Math.ceil((inv.dueDate.getTime() - today.getTime()) / 86400000) : null;
    payments.push({
      id: `invoice-${inv.cardId}-${inv.month}`,
      name: `Fatura ${inv.cardName}`,
      amount: inv.amount,
      dueDate: inv.dueDate,
      daysUntil,
      urgency: daysUntil === null ? 'none' : getDueDateStatus(daysUntil),
      priority: 'critical',
      source: 'card_invoice',
      status: 'pending',
      invoice: inv,
    });
  });

  const priorityOrder = { essential: 0, critical: 1, important: 2, optional: 3 };
  payments.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    if (a.daysUntil === null && b.daysUntil !== null) return 1;
    if (a.daysUntil !== null && b.daysUntil === null) return -1;
    if (a.daysUntil !== null && b.daysUntil !== null && a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  return {
    payments,
    isLoading: transactions.isLoading || fixedBills.isLoading || debts.isLoading || invoices.isLoading,
  };
}

export function useFinanceSummary(month?: string) {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(targetMonth);
  const debts = useDebts();
  const cards = useCreditCards();
  const invoices = useCardInvoices(targetMonth);

  const allTx = transactions.data ?? [];
  const incomes = allTx.filter(t => t.type === 'income');
  const expenses = allTx.filter(t => t.type === 'expense');

  const [yearStr, monthStr] = targetMonth.split('-');
  const targetYear = parseInt(yearStr);
  const targetMon = parseInt(monthStr) - 1;

  // Build expense-like entries from active debts for the target month
  type ExpenseLike = { amount: number; status: 'pending' | 'paid' };
  const debtExpenses: ExpenseLike[] = [];
  (debts.data ?? [])
    .filter(d => d.status === 'active')
    .forEach(d => {
      const impact = debtMonthlyImpact(d, targetYear, targetMon);
      if (impact <= 0) return;
      const start = new Date(d.start_date + 'T00:00:00');
      const monthIdx = (targetYear * 12 + targetMon) - (start.getFullYear() * 12 + start.getMonth());
      const isPaid = d.paid_installments > monthIdx;
      debtExpenses.push({ amount: impact, status: isPaid ? 'paid' : 'pending' });
    });

  const txExpenseTotal = expenses.reduce((s, t) => s + Number(t.amount), 0);
  const debtExpenseTotal = debtExpenses.reduce((s, e) => s + e.amount, 0);
  const invoiceTotal = invoices.unregistered.reduce((s, i) => s + i.amount, 0);

  const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = txExpenseTotal + debtExpenseTotal + invoiceTotal;

  const paidTxExpenses = expenses.filter(t => t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const pendingTxExpenses = expenses.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const paidDebt = debtExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const pendingDebt = debtExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  const paidExpenses = paidTxExpenses + paidDebt;
  const pendingExpenses = pendingTxExpenses + pendingDebt + invoiceTotal;
  const estimatedRemaining = totalIncome - totalExpenses;

  const paidCount = expenses.filter(t => t.status === 'paid').length + debtExpenses.filter(e => e.status === 'paid').length;
  const pendingCount = expenses.filter(t => t.status === 'pending').length + debtExpenses.filter(e => e.status === 'pending').length + invoices.unregistered.length;

  // Realized: income already received (up to today) minus what was already paid
  const todayStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`;
  const receivedIncome = incomes.filter(t => t.date <= todayStr).reduce((s, t) => s + Number(t.amount), 0);
  const realizedBalance = receivedIncome - paidExpenses;

  // Committed income: card invoices, debts and recurring bills
  const cardNames = (cards.data ?? []).map(c => c.name);
  const isCardTx = (t: any) => cardNames.some(n => matchesCard(t, n));
  const committedCard = expenses.filter(isCardTx).reduce((s, t) => s + Number(t.amount), 0) + invoiceTotal;
  const committedFixed = expenses.filter(t => t.is_recurring && !isCardTx(t)).reduce((s, t) => s + Number(t.amount), 0);
  const committedDebt = debtExpenseTotal;
  const committedTotal = committedCard + committedFixed + committedDebt;

  return {
    totalIncome,
    totalExpenses,
    paidExpenses,
    pendingExpenses,
    estimatedRemaining,
    incomeCount: incomes.length,
    expenseCount: expenses.length + debtExpenses.length + invoices.unregistered.length,
    paidCount,
    pendingCount,
    receivedIncome,
    realizedBalance,
    committed: {
      total: committedTotal,
      fixed: committedFixed,
      debt: committedDebt,
      card: committedCard,
      share: totalIncome > 0 ? committedTotal / totalIncome : null,
    },
    isLoading: transactions.isLoading || debts.isLoading || invoices.isLoading,
  };
}
