import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getDaysUntilDue, getDueDateStatus } from '@/lib/format';

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

// Date and due date of a recurring transaction's occurrence in the given month, or null if none.
function projectOccurrence(r: any, year: number, monIdx: number): { date: string; due_date: string | null } | null {
  const endDate = new Date(year, monIdx + 1, 0);
  const monthStartTs = new Date(year, monIdx, 1).getTime();
  const monthEndTs = endDate.getTime();
  const intervalDays: Record<string, number> = { weekly: 7, biweekly: 14 };
  const toDateStr = (d: Date) => `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;

  const baseDate = new Date(r.date + 'T00:00:00');
  if (baseDate.getTime() > monthEndTs) return null; // starts after this month
  const endLimit = r.recurrence_end_date
    ? new Date(r.recurrence_end_date + 'T00:00:00').getTime()
    : null;
  if (endLimit !== null && monthStartTs > endLimit) return null; // ended before this month
  const interval = r.recurrence_interval || 'monthly';
  const dueDateOriginal = r.due_date ? new Date(r.due_date + 'T00:00:00') : null;
  // For weekly/biweekly, preserve the day gap between registration and due date
  const dueOffsetMs = dueDateOriginal ? dueDateOriginal.getTime() - baseDate.getTime() : null;
  // For monthly/yearly, preserve the fixed due day-of-month (and month offset), so it doesn't drift with month length
  const dueMonthDelta = dueDateOriginal
    ? (dueDateOriginal.getFullYear() * 12 + dueDateOriginal.getMonth()) - (baseDate.getFullYear() * 12 + baseDate.getMonth())
    : null;

  let occurrence: Date | null = null;
  if (interval === 'monthly') {
    const day = Math.min(baseDate.getDate(), endDate.getDate());
    const candidate = new Date(year, monIdx, day);
    if (candidate.getTime() >= baseDate.getTime() && candidate.getTime() <= monthEndTs) {
      occurrence = candidate;
    }
  } else if (interval === 'yearly') {
    if (baseDate.getMonth() === monIdx) {
      const day = Math.min(baseDate.getDate(), endDate.getDate());
      const candidate = new Date(year, monIdx, day);
      if (candidate.getTime() >= baseDate.getTime()) occurrence = candidate;
    }
  } else if (interval === 'weekly' || interval === 'biweekly') {
    const step = intervalDays[interval];
    const diffMs = monthStartTs - baseDate.getTime();
    const stepsToFirst = Math.max(0, Math.ceil(diffMs / (step * 86400000)));
    const firstTs = baseDate.getTime() + stepsToFirst * step * 86400000;
    if (firstTs <= monthEndTs) occurrence = new Date(firstTs);
  }

  if (!occurrence || (endLimit !== null && occurrence.getTime() > endLimit)) return null;

  let virtualDueDate: string | null = null;
  if (dueDateOriginal) {
    if (interval === 'monthly' || interval === 'yearly') {
      const dueMonthIdx = occurrence.getMonth() + (dueMonthDelta ?? 0);
      const dueYear = occurrence.getFullYear() + Math.floor(dueMonthIdx / 12);
      const normalizedDueMonthIdx = ((dueMonthIdx % 12) + 12) % 12;
      const lastDayOfDueMonth = new Date(dueYear, normalizedDueMonthIdx + 1, 0).getDate();
      const dueDay = Math.min(dueDateOriginal.getDate(), lastDayOfDueMonth);
      virtualDueDate = toDateStr(new Date(dueYear, normalizedDueMonthIdx, dueDay));
    } else if (dueOffsetMs !== null) {
      virtualDueDate = toDateStr(new Date(occurrence.getTime() + dueOffsetMs));
    }
  }
  return { date: toDateStr(occurrence), due_date: virtualDueDate };
}

export function useTransactions(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transactions', user?.id, month],
    queryFn: async () => {
      if (!month) {
        const { data, error } = await supabase.from('transactions').select('*, categories(*)').eq('user_id', user!.id).order('date', { ascending: false });
        if (error) throw error;
        return data;
      }

      const [yearStr, monthStr] = month.split('-');
      const year = parseInt(yearStr);
      const monIdx = parseInt(monthStr) - 1;
      const start = `${month}-01`;
      const endDate = new Date(year, monIdx + 1, 0);
      const end = `${month}-${endDate.getDate().toString().padStart(2, '0')}`;

      // Fetch by date range OR due_date range
      const { data: byDate, error: e1 } = await supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', user!.id)
        .gte('date', start)
        .lte('date', end)
        .order('date', { ascending: false });
      if (e1) throw e1;

      const { data: byDueDate, error: e2 } = await supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', user!.id)
        .gte('due_date', start)
        .lte('due_date', end)
        .order('date', { ascending: false });
      if (e2) throw e2;

      // Fetch all recurring transactions (no month filter) so we can project virtual instances
      const { data: recurring, error: e3 } = await supabase
        .from('transactions')
        .select('*, categories(*)')
        .eq('user_id', user!.id)
        .eq('is_recurring', true);
      if (e3) throw e3;

      // Merge real transactions
      const map = new Map<string, any>();
      for (const t of [...(byDate ?? []), ...(byDueDate ?? [])]) {
        map.set(t.id, t);
      }

      // Project recurring transactions into the target month, including those with a fixed due_date.
      // Each projected occurrence starts as pending; once marked, it is materialized as its own real row.
      const realRows = Array.from(map.values());
      for (const r of recurring ?? []) {
        if (map.has(r.id)) continue; // already in this month as real entry
        const occ = projectOccurrence(r, year, monIdx);
        if (!occ) continue;
        const materialized = realRows.some(t =>
          !t.is_recurring && t.date === occ.date && t.description === r.description && t.type === r.type
        );
        if (materialized) continue;
        map.set(`${r.id}-virtual-${occ.date}`, {
          ...r,
          id: `${r.id}-virtual-${occ.date}`,
          original_id: r.id,
          series_date: r.date,
          is_virtual: true,
          date: occ.date,
          due_date: occ.due_date,
          status: 'pending',
        });
      }

      return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
    },
    enabled: !!user,
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
  source: 'transaction' | 'fixed_bill' | 'debt';
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
    isLoading: transactions.isLoading || fixedBills.isLoading || debts.isLoading,
  };
}

export function useFinanceSummary(month?: string) {
  const now = new Date();
  const targetMonth = month || `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(targetMonth);
  const debts = useDebts();

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

  const totalIncome = incomes.reduce((s, t) => s + Number(t.amount), 0);
  const totalExpenses = txExpenseTotal + debtExpenseTotal;

  const paidTxExpenses = expenses.filter(t => t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const pendingTxExpenses = expenses.filter(t => t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const paidDebt = debtExpenses.filter(e => e.status === 'paid').reduce((s, e) => s + e.amount, 0);
  const pendingDebt = debtExpenses.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0);

  const paidExpenses = paidTxExpenses + paidDebt;
  const pendingExpenses = pendingTxExpenses + pendingDebt;
  const estimatedRemaining = totalIncome - totalExpenses;

  const paidCount = expenses.filter(t => t.status === 'paid').length + debtExpenses.filter(e => e.status === 'paid').length;
  const pendingCount = expenses.filter(t => t.status === 'pending').length + debtExpenses.filter(e => e.status === 'pending').length;

  return {
    totalIncome,
    totalExpenses,
    paidExpenses,
    pendingExpenses,
    estimatedRemaining,
    incomeCount: incomes.length,
    expenseCount: expenses.length + debtExpenses.length,
    paidCount,
    pendingCount,
    isLoading: transactions.isLoading || debts.isLoading,
  };
}
