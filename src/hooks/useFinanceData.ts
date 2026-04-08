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

export function useTransactions(month?: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['transactions', user?.id, month],
    queryFn: async () => {
      let query = supabase.from('transactions').select('*, categories(*)').eq('user_id', user!.id).order('date', { ascending: false });
      if (month) {
        const start = `${month}-01`;
        const endDate = new Date(parseInt(month.split('-')[0]), parseInt(month.split('-')[1]), 0);
        const end = `${month}-${endDate.getDate().toString().padStart(2, '0')}`;
        query = query.gte('date', start).lte('date', end);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
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
      due_date?: string;
      is_recurring?: boolean;
      recurrence_interval?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
    }) => {
      const { error } = await supabase.from('transactions').insert({ ...data, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from('transactions').update({ status }).eq('id', id);
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
      due_date?: string;
      priority: 'essential' | 'critical' | 'important' | 'optional';
      status: string;
      is_recurring?: boolean;
      recurrence_interval?: 'monthly' | 'weekly' | 'biweekly' | 'yearly';
    }) => {
      const { id, ...rest } = data;
      const { error } = await supabase.from('transactions').update({
        ...rest,
        user_id: user!.id,
      } as any).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transactions'] }),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('transactions').delete().eq('id', id);
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
      name: string; total_amount: number; interest_rate?: number;
      total_installments: number; installment_amount: number; priority: string; start_date: string;
    }) => {
      const { error } = await supabase.from('debts').insert({
        name: data.name,
        total_amount: data.total_amount,
        interest_rate: data.interest_rate,
        total_installments: data.total_installments,
        installment_amount: data.installment_amount,
        priority: data.priority as 'essential' | 'critical' | 'important' | 'optional',
        start_date: data.start_date,
        user_id: user!.id,
      });
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
    mutationFn: async (data: { name: string; last_digits: string; credit_limit: number; closing_day: number; due_day: number; color: string }) => {
      const { error } = await supabase.from('credit_cards').insert({ ...data, user_id: user!.id });
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
  dueDate: Date;
  daysUntil: number;
  urgency: 'overdue' | 'urgent' | 'warning' | 'ok';
  priority: 'essential' | 'critical' | 'important' | 'optional';
  source: 'transaction' | 'fixed_bill';
  status: 'pending' | 'paid';
}

export function useUpcomingPayments() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(currentMonth);
  const fixedBills = useFixedBills();

  const payments: UpcomingPayment[] = [];

  // Add pending expense transactions
  (transactions.data ?? [])
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const dueDate = t.due_date ? new Date(t.due_date + 'T00:00:00') : new Date(t.date + 'T00:00:00');
      const diffTime = dueDate.getTime() - new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      payments.push({
        id: t.id,
        name: t.description,
        amount: Number(t.amount),
        dueDate,
        daysUntil,
        urgency: getDueDateStatus(daysUntil),
        priority: t.priority,
        source: 'transaction',
        status: t.status as 'pending' | 'paid',
      });
    });

  // Add active fixed bills
  (fixedBills.data ?? [])
    .filter(b => b.is_active)
    .forEach(b => {
      const daysUntil = getDaysUntilDue(b.due_day);
      const dueDate = new Date(now.getFullYear(), now.getMonth(), b.due_day);
      if (dueDate < now) dueDate.setMonth(dueDate.getMonth() + 1);
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

  // Sort: pending first, then by due date, then by priority
  const priorityOrder = { essential: 0, critical: 1, important: 2, optional: 3 };
  payments.sort((a, b) => {
    if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
    if (a.daysUntil !== b.daysUntil) return a.daysUntil - b.daysUntil;
    return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
  });

  return {
    payments,
    isLoading: transactions.isLoading || fixedBills.isLoading,
  };
}

export function useFinanceSummary() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(currentMonth);

  const income = (transactions.data ?? []).filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = (transactions.data ?? []).filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);
  const estimatedRemaining = income - expenses;

  return {
    income,
    expenses,
    estimatedRemaining,
    isLoading: transactions.isLoading,
  };
}
