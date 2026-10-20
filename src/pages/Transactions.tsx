import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions, useUpdateTransaction } from '@/hooks/useFinanceData';
import { formatCurrency } from '@/lib/format';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { MonthNav } from '@/components/shared/MonthNav';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Repeat, Check, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TransactionForm, type TransactionToEdit } from '@/components/transactions/TransactionForm';

const typeFilters = [
  { value: 'all', label: 'Todos' },
  { value: 'income', label: 'Entradas' },
  { value: 'expense', label: 'Saídas' },
];

export default function Transactions() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showForm, setShowForm] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<TransactionToEdit | null>(null);

  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentMonth = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const { data: transactions, isLoading } = useTransactions(currentMonth);
  const updateTransaction = useUpdateTransaction();

  const filtered = (transactions ?? []).filter(t => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const displayDateOf = (t: any): string => (t.type === 'income' ? t.date : (t.due_date || t.date));

  // Group by the date shown on each row (due date for expenses), newest first
  const byDay = filtered.reduce((acc, t) => {
    const key = displayDateOf(t);
    (acc[key] ??= []).push(t);
    return acc;
  }, {} as Record<string, any[]>);
  const days = Object.keys(byDay).sort((a, b) => b.localeCompare(a));

  const totalIn = filtered.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalOut = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + Number(t.amount), 0);

  const handleTogglePaid = async (id: string, currentStatus: string) => {
    try {
      await updateTransaction.mutateAsync({ id, status: currentStatus === 'paid' ? 'pending' : 'paid' });
      toast.success(currentStatus === 'paid' ? 'Marcado como pendente' : 'Marcado como pago');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleEdit = (t: any) => {
    setEditingTransaction({
      id: t.original_id || t.id,
      type: t.type,
      amount: Number(t.amount),
      description: t.description,
      category_id: t.category_id,
      date: t.date,
      due_date: t.due_date,
      priority: t.priority,
      status: t.status,
      is_recurring: t.is_recurring,
      recurrence_interval: t.recurrence_interval,
      recurrence_end_date: t.recurrence_end_date ?? null,
      occurrence_date: t.is_virtual ? t.date : undefined,
      series_date: t.is_virtual ? t.series_date : undefined,
    });
    setShowForm(true);
  };

  const dayLabel = (key: string) => {
    const d = new Date(key + 'T00:00:00');
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diff === 0) return 'Hoje';
    if (diff === 1) return 'Amanhã';
    if (diff === -1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <MonthNav label={monthLabel} onPrev={() => setMonthOffset(o => o - 1)} onNext={() => setMonthOffset(o => o + 1)} />

        {/* Totals of the filtered list */}
        <div className="glass rounded-2xl grid grid-cols-2 divide-x divide-border">
          <div className="p-3">
            <p className="text-xs text-muted-foreground">Entradas</p>
            <p className="text-base font-semibold font-mono money-positive">{formatCurrency(totalIn)}</p>
          </div>
          <div className="p-3">
            <p className="text-xs text-muted-foreground">Saídas</p>
            <p className="text-base font-semibold font-mono money-negative">{formatCurrency(totalOut)}</p>
          </div>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 rounded-full glass-flat" />
          </div>
          <div className="flex gap-2">
            <div className="glass-flat rounded-full flex p-1 gap-1 flex-1">
              {typeFilters.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilterType(f.value)}
                  className={cn('flex-1 rounded-full py-1.5 text-xs font-medium transition-colors',
                    filterType === f.value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px] rounded-full glass-flat h-auto">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Prioridade</SelectItem>
                <SelectItem value="essential">Essencial</SelectItem>
                <SelectItem value="critical">Crítico</SelectItem>
                <SelectItem value="important">Importante</SelectItem>
                <SelectItem value="optional">Opcional</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Transaction List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhuma transação encontrada</div>
        ) : (
          <div className="space-y-4">
            {days.map(day => (
              <div key={day}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 px-1">{dayLabel(day)}</p>
                <div className="glass-flat rounded-2xl divide-y divide-border overflow-hidden">
                  {byDay[day].map(t => {
                    const isIncome = t.type === 'income';
                    const isPaid = t.status === 'paid';
                    return (
                      <div
                        key={t.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => handleEdit(t)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEdit(t)}
                        className="flex items-center gap-3 px-3 py-3 cursor-pointer hover:bg-accent/40 transition-colors"
                      >
                        <div className={cn('w-1 h-9 rounded-full shrink-0', isIncome ? 'bg-success' : 'bg-destructive')} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{t.description}</p>
                            {!isIncome && (t.priority === 'essential' || t.priority === 'critical') && <PriorityBadge priority={t.priority} />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            {t.categories?.name ?? 'Sem categoria'}
                            {t.is_recurring && <Repeat className="h-3 w-3" aria-label="Recorrente" />}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <p className={cn('text-sm font-semibold font-mono', isIncome ? 'money-positive' : 'money-negative')}>
                            {isIncome ? '+' : '-'}{formatCurrency(Number(t.amount))}
                          </p>
                          {!isIncome && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleTogglePaid(t.id, t.status); }}
                              className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors',
                                isPaid
                                  ? 'bg-success/15 text-success border-success/30'
                                  : 'bg-warning/10 text-warning border-warning/30 hover:bg-success/15 hover:text-success hover:border-success/30'
                              )}
                              title={isPaid ? 'Marcar como pendente' : 'Marcar como pago'}
                            >
                              {isPaid ? <Check className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {isPaid ? 'Pago' : 'Pendente'}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <TransactionForm
        open={showForm}
        onOpenChange={(open) => {
          setShowForm(open);
          if (!open) setEditingTransaction(null);
        }}
        editTransaction={editingTransaction}
      />
    </AppLayout>
  );
}
