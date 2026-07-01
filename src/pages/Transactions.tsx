import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useTransactions, useDeleteTransaction, useUpdateTransaction } from '@/hooks/useFinanceData';
import { formatCurrency, formatDate } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Check, Search, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { TransactionForm, type TransactionToEdit } from '@/components/transactions/TransactionForm';

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
  const deleteTransaction = useDeleteTransaction();
  const updateTransaction = useUpdateTransaction();

  const filtered = (transactions ?? []).filter(t => {
    if (search && !t.description.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterType !== 'all' && t.type !== filterType) return false;
    if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
    return true;
  });

  const handleTogglePaid = async (id: string, currentStatus: string) => {
    try {
      await updateTransaction.mutateAsync({ id, status: currentStatus === 'paid' ? 'pending' : 'paid' });
      toast.success('Status atualizado');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTransaction.mutateAsync(id);
      toast.success('Transação excluída');
    } catch {
      toast.error('Erro ao excluir');
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
    });
    setShowForm(true);
  };

  const handleNewTransaction = () => {
    setEditingTransaction(null);
    setShowForm(true);
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Month Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(o => o - 1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold capitalize">{monthLabel}</h2>
          <Button variant="ghost" size="icon" onClick={() => setMonthOffset(o => o + 1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex gap-2">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Entradas</SelectItem>
                <SelectItem value="expense">Saídas</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Prioridade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
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
          <div className="space-y-2">
            {filtered.map(t => {
              const isIncome = t.type === 'income';
              const displayDate = isIncome ? t.date : (t.due_date || t.date);
              return (
                <Card key={t.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className={cn('w-1 h-10 rounded-full shrink-0', isIncome ? 'bg-success' : 'bg-destructive')} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{t.description}</p>
                        {!isIncome && <PriorityBadge priority={t.priority} />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {t.categories?.name && (
                          <>
                            <span className="text-[10px] text-muted-foreground">{t.categories.name}</span>
                            <span className="text-[10px] text-muted-foreground">•</span>
                          </>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {!isIncome && 'Vence '}
                          {formatDate(displayDate)}
                        </span>
                        {isIncome && t.is_recurring && (
                          <>
                            <span className="text-[10px] text-muted-foreground">•</span>
                            <span className="text-[10px] text-muted-foreground">Recorrente</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-1">
                      <div>
                        <p className={cn('text-sm font-bold font-mono', isIncome ? 'money-positive' : 'money-negative')}>
                          {isIncome ? '+' : '-'}{formatCurrency(Number(t.amount))}
                        </p>
                        {!isIncome && <StatusBadge status={t.status as any} />}
                      </div>
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleEdit(t)} className="p-1 rounded hover:bg-muted">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        {!isIncome && (
                          <button onClick={() => handleTogglePaid(t.id, t.status)} className="p-1 rounded hover:bg-muted">
                            <Check className={cn('h-3.5 w-3.5', t.status === 'paid' ? 'text-success' : 'text-muted-foreground')} />
                          </button>
                        )}
                        <button onClick={() => handleDelete(t.id)} className="p-1 rounded hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                        </button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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
