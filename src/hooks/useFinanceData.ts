import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

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
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('transactions').update(data).eq('id', id);
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
      const { error } = await supabase.from('fixed_bills').insert({ ...data, user_id: user!.id } as any);
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
      const { error } = await supabase.from('debts').insert({ ...data, user_id: user!.id } as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['debts'] }),
  });
}

export function useUpdateDebt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; [key: string]: any }) => {
      const { error } = await supabase.from('debts').update(data).eq('id', id);
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

export function useFinanceSummary() {
  const { user } = useAuth();
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
  const transactions = useTransactions(currentMonth);
  const debts = useDebts();
  const fixedBills = useFixedBills();

  const income = (transactions.data ?? []).filter(t => t.type === 'income' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const expenses = (transactions.data ?? []).filter(t => t.type === 'expense' && t.status === 'paid').reduce((s, t) => s + Number(t.amount), 0);
  const pendingExpenses = (transactions.data ?? []).filter(t => t.type === 'expense' && t.status === 'pending').reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = (debts.data ?? []).filter(d => d.status === 'active').reduce((s, d) => s + Number(d.total_amount) - (Number(d.installment_amount) * d.paid_installments), 0);
  const monthlyDebtImpact = (debts.data ?? []).filter(d => d.status === 'active').reduce((s, d) => s + Number(d.installment_amount), 0);
  const balance = income - expenses;
  const projectedBalance = balance - pendingExpenses;
  const totalCommitted = expenses + pendingExpenses + monthlyDebtImpact;
  const compromisePercentage = income > 0 ? (totalCommitted / income) * 100 : 0;

  return {
    income, expenses, balance, projectedBalance, totalDebt, monthlyDebtImpact,
    compromisePercentage, pendingExpenses,
    isLoading: transactions.isLoading || debts.isLoading || fixedBills.isLoading,
  };
}
