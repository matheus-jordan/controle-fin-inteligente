import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useCategories, useCreateTransaction, useUpdateTransactionFull, useSplitRecurringTransaction } from '@/hooks/useFinanceData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export interface TransactionToEdit {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  category_id: string | null;
  date: string;
  due_date: string | null;
  priority: string;
  status: string;
  is_recurring: boolean;
  recurrence_interval: string | null;
  recurrence_end_date?: string | null;
  // Set when editing a projected month of a recurring series
  occurrence_date?: string;
  series_date?: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editTransaction?: TransactionToEdit | null;
}

const priorities = [
  { value: 'essential', label: 'Essencial', color: 'bg-destructive text-destructive-foreground' },
  { value: 'critical', label: 'Crítico', color: 'bg-warning text-warning-foreground' },
  { value: 'important', label: 'Importante', color: 'bg-primary text-primary-foreground' },
  { value: 'optional', label: 'Opcional', color: 'bg-muted text-muted-foreground' },
];

export function TransactionForm({ open, onOpenChange, editTransaction }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState('optional');
  const [status, setStatus] = useState('pending');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<string>('monthly');
  const [hasRecurrenceEnd, setHasRecurrenceEnd] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState('');
  const [hasDueDate, setHasDueDate] = useState(true);
  const [dueDate, setDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [editScope, setEditScope] = useState<'all' | 'forward'>('forward');

  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();
  const updateTransaction = useUpdateTransactionFull();
  const splitTransaction = useSplitRecurringTransaction();

  const isEditing = !!editTransaction;
  const filteredCategories = categories?.filter(c => c.type === type) ?? [];
  const isIncome = type === 'income';
  const isFutureOccurrence = isEditing && editTransaction!.is_recurring && !!editTransaction!.occurrence_date;

  useEffect(() => {
    if (editTransaction) {
      setType(editTransaction.type);
      setAmount(String(editTransaction.amount));
      setDescription(editTransaction.description);
      setCategoryId(editTransaction.category_id || '');
      setDate(editTransaction.date);
      setPriority(editTransaction.priority);
      setStatus(editTransaction.status);
      setIsRecurring(editTransaction.is_recurring);
      setRecurrenceInterval(editTransaction.recurrence_interval || 'monthly');
      setHasRecurrenceEnd(!!editTransaction.recurrence_end_date);
      setRecurrenceEndDate(editTransaction.recurrence_end_date || '');
      setHasDueDate(!!editTransaction.due_date);
      setDueDate(editTransaction.due_date || new Date().toISOString().split('T')[0]);
      setEditScope('forward');
    } else {
      resetForm();
    }
  }, [editTransaction, open]);

  const handleSubmit = async () => {
    if (!amount || !description) {
      toast.error('Preencha o valor e a descrição');
      return;
    }

    const payload = {
      description,
      amount: parseFloat(amount),
      type,
      category_id: categoryId || undefined,
      date: date,
      due_date: (!isIncome && hasDueDate) ? dueDate : null,
      priority: isIncome ? 'optional' : priority as any,
      status: isIncome ? 'paid' : status,
      is_recurring: isRecurring,
      recurrence_interval: isRecurring ? recurrenceInterval as any : undefined,
      recurrence_end_date: isRecurring && hasRecurrenceEnd && recurrenceEndDate ? recurrenceEndDate : null,
    };

    try {
      if (isFutureOccurrence && editScope === 'forward' && isRecurring) {
        const { date: fromDate, is_recurring, ...data } = payload;
        await splitTransaction.mutateAsync({ id: editTransaction!.id, fromDate, data });
        toast.success('Atualizado deste mês em diante!');
      } else if (isEditing) {
        // Editing all months from a projected month: keep the series start date unless it was changed
        const keepStart = isFutureOccurrence && date === editTransaction!.occurrence_date;
        await updateTransaction.mutateAsync({
          id: editTransaction!.id,
          ...payload,
          date: keepStart ? editTransaction!.series_date! : payload.date,
        });
        toast.success('Transação atualizada!');
      } else {
        await createTransaction.mutateAsync(payload);
        toast.success(isIncome ? 'Entrada registrada!' : 'Saída registrada!');
      }
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar transação');
    }
  };

  const resetForm = () => {
    setType('expense');
    setAmount('');
    setDescription('');
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('optional');
    setStatus('pending');
    setIsRecurring(false);
    setRecurrenceInterval('monthly');
    setHasRecurrenceEnd(false);
    setRecurrenceEndDate('');
    setHasDueDate(true);
    setDueDate(new Date().toISOString().split('T')[0]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Editar Transação' : 'Nova Transação'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Edit scope for recurring series */}
          {isFutureOccurrence && (
            <div>
              <Label>Aplicar alteração a</Label>
              <div className="flex rounded-lg bg-muted p-1 gap-1 mt-1">
                <button
                  onClick={() => setEditScope('forward')}
                  className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    editScope === 'forward' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  Deste mês em diante
                </button>
                <button
                  onClick={() => setEditScope('all')}
                  className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                    editScope === 'all' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                  )}
                >
                  Todos os meses
                </button>
              </div>
            </div>
          )}

          {/* Type Toggle */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            <button
              onClick={() => !isEditing && setType('expense')}
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                type === 'expense' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground',
                isEditing && 'opacity-60 cursor-not-allowed'
              )}
            >
              Saída
            </button>
            <button
              onClick={() => !isEditing && setType('income')}
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                type === 'income' ? 'bg-success text-success-foreground' : 'text-muted-foreground',
                isEditing && 'opacity-60 cursor-not-allowed'
              )}
            >
              Entrada
            </button>
          </div>

          {/* Amount */}
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number"
              step="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="text-2xl font-bold h-14 mt-1"
            />
          </div>

          {/* Description */}
          <div>
            <Label>Descrição</Label>
            <Input
              placeholder={isIncome ? 'Ex: Salário' : 'Ex: Supermercado'}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1"
            />
          </div>

          {/* Category */}
          <div>
            <Label>Categoria</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {filteredCategories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date — always shown */}
          <div>
            <Label>{isIncome ? 'Data' : 'Data do registro'}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <Label>Recorrente?</Label>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <div className="space-y-3 rounded-lg border border-border/60 p-3">
              <div>
                <Label className="text-xs">Frequência</Label>
                <Select value={recurrenceInterval} onValueChange={setRecurrenceInterval}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="biweekly">Quinzenal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="has-recurrence-end"
                  checked={hasRecurrenceEnd}
                  onCheckedChange={(checked) => setHasRecurrenceEnd(checked === true)}
                />
                <Label htmlFor="has-recurrence-end" className="cursor-pointer text-sm">
                  Tem data de término? (opcional)
                </Label>
              </div>
              {hasRecurrenceEnd && (
                <Input
                  type="date"
                  value={recurrenceEndDate}
                  onChange={(e) => setRecurrenceEndDate(e.target.value)}
                />
              )}
            </div>
          )}

          {/* Expense-only fields */}
          {!isIncome && (
            <>
              {/* Due date checkbox + field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-due-date"
                    checked={hasDueDate}
                    onCheckedChange={(checked) => setHasDueDate(checked === true)}
                  />
                  <Label htmlFor="has-due-date" className="cursor-pointer">Tem data de vencimento?</Label>
                </div>
                {hasDueDate && (
                  <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                )}
              </div>

              {/* Priority */}
              <div>
                <Label>Prioridade</Label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {priorities.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setPriority(p.value)}
                      className={cn('px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        priority === p.value ? p.color : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center justify-between">
                <Label>Já foi pago?</Label>
                <Switch checked={status === 'paid'} onCheckedChange={(c) => setStatus(c ? 'paid' : 'pending')} />
              </div>
            </>
          )}

          <Button
            onClick={handleSubmit}
            className="w-full h-12 text-base"
            disabled={createTransaction.isPending || updateTransaction.isPending || splitTransaction.isPending}
          >
            {(createTransaction.isPending || updateTransaction.isPending || splitTransaction.isPending)
              ? 'Salvando...'
              : isEditing ? 'Atualizar' : 'Salvar Transação'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
