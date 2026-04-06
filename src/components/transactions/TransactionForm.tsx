import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCategories, useCreateTransaction } from '@/hooks/useFinanceData';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const priorities = [
  { value: 'essential', label: 'Essencial', color: 'bg-destructive text-destructive-foreground' },
  { value: 'critical', label: 'Crítico', color: 'bg-warning text-warning-foreground' },
  { value: 'important', label: 'Importante', color: 'bg-primary text-primary-foreground' },
  { value: 'optional', label: 'Opcional', color: 'bg-muted text-muted-foreground' },
];

export function TransactionForm({ open, onOpenChange }: TransactionFormProps) {
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [priority, setPriority] = useState('optional');
  const [status, setStatus] = useState('pending');
  const [dueDate, setDueDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<string>('monthly');

  const { data: categories } = useCategories();
  const createTransaction = useCreateTransaction();

  const filteredCategories = categories?.filter(c => c.type === type) ?? [];

  const handleSubmit = async () => {
    if (!amount || !description) {
      toast.error('Preencha o valor e a descrição');
      return;
    }

    try {
      await createTransaction.mutateAsync({
        description,
        amount: parseFloat(amount),
        type,
        category_id: categoryId || undefined,
        date,
        priority: priority as any,
        status,
        due_date: dueDate || undefined,
        is_recurring: isRecurring,
        recurrence_interval: isRecurring ? recurrenceInterval as any : undefined,
      });
      toast.success(type === 'income' ? 'Entrada registrada!' : 'Saída registrada!');
      resetForm();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao salvar transação');
    }
  };

  const resetForm = () => {
    setAmount('');
    setDescription('');
    setCategoryId('');
    setDate(new Date().toISOString().split('T')[0]);
    setPriority('optional');
    setStatus('pending');
    setDueDate('');
    setIsRecurring(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova Transação</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 mt-4">
          {/* Type Toggle */}
          <div className="flex rounded-lg bg-muted p-1 gap-1">
            <button
              onClick={() => setType('expense')}
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                type === 'expense' ? 'bg-destructive text-destructive-foreground' : 'text-muted-foreground'
              )}
            >
              Saída
            </button>
            <button
              onClick={() => setType('income')}
              className={cn('flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                type === 'income' ? 'bg-success text-success-foreground' : 'text-muted-foreground'
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
              placeholder="Ex: Supermercado"
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

          {/* Date & Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Vencimento</Label>
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1" />
            </div>
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

          {/* Recurring */}
          <div className="flex items-center justify-between">
            <Label>Recorrente?</Label>
            <Switch checked={isRecurring} onCheckedChange={setIsRecurring} />
          </div>

          {isRecurring && (
            <Select value={recurrenceInterval} onValueChange={setRecurrenceInterval}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quinzenal</SelectItem>
                <SelectItem value="monthly">Mensal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
          )}

          <Button onClick={handleSubmit} className="w-full h-12 text-base" disabled={createTransaction.isPending}>
            {createTransaction.isPending ? 'Salvando...' : 'Salvar Transação'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
