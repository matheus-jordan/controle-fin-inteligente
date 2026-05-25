import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useDebts, useCreateDebt, useUpdateDebt } from '@/hooks/useFinanceData';
import { formatCurrency } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { PriorityBadge } from '@/components/shared/PriorityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, Landmark } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function Debts() {
  const { data: debts, isLoading } = useDebts();
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const [showForm, setShowForm] = useState(false);
  const [debtType, setDebtType] = useState<'single' | 'installments' | 'recurring'>('installments');
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [monthlyAmount, setMonthlyAmount] = useState('');
  const [durationMonths, setDurationMonths] = useState('');
  const [priority, setPriority] = useState('important');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Active = not finished. Recurring is active while today <= end_date (or no end_date).
  const isDebtActive = (d: any) => {
    if (d.status !== 'active') return false;
    if (d.debt_kind === 'recurring' && d.end_date && d.end_date < todayStr) return false;
    return true;
  };

  const activeDebts = (debts ?? []).filter(isDebtActive);
  const totalDebtAmount = activeDebts.reduce((s, d) => {
    if (d.debt_kind === 'recurring') {
      if (!d.end_date) return s; // sem fim definido — não soma valor total
      // meses restantes (incluindo o atual)
      const end = new Date(d.end_date + 'T00:00:00');
      const monthsLeft = Math.max(0, (end.getFullYear() - today.getFullYear()) * 12 + (end.getMonth() - today.getMonth()) + 1);
      return s + monthsLeft * Number(d.installment_amount);
    }
    return s + (Number(d.total_amount) - Number(d.installment_amount) * d.paid_installments);
  }, 0);
  const monthlyImpact = activeDebts.reduce((s, d) => s + Number(d.installment_amount), 0);

  const handleSubmit = async () => {
    if (!name) {
      toast.error('Preencha o nome');
      return;
    }
    if (debtType === 'installments' && (!totalAmount || !totalInstallments || !installmentAmount)) {
      toast.error('Preencha os campos da parcela');
      return;
    }
    if (debtType === 'single' && !totalAmount) {
      toast.error('Preencha o valor total');
      return;
    }
    if (debtType === 'recurring' && !monthlyAmount) {
      toast.error('Preencha o valor mensal');
      return;
    }
    try {
      if (debtType === 'recurring') {
        const monthly = parseFloat(monthlyAmount);
        const duration = durationMonths ? parseInt(durationMonths) : null;
        let endDate: string | null = null;
        if (duration && duration > 0) {
          const start = new Date(startDate + 'T00:00:00');
          // end = start + duration months - 1 day
          const end = new Date(start.getFullYear(), start.getMonth() + duration, 0);
          endDate = end.toISOString().split('T')[0];
        }
        await createDebt.mutateAsync({
          name,
          total_amount: duration ? monthly * duration : monthly,
          total_installments: duration ?? 9999,
          installment_amount: monthly,
          priority,
          start_date: startDate,
          debt_kind: 'recurring',
          duration_months: duration,
          end_date: endDate,
        });
      } else {
        const total = parseFloat(totalAmount);
        await createDebt.mutateAsync({
          name,
          total_amount: total,
          total_installments: debtType === 'single' ? 1 : parseInt(totalInstallments),
          installment_amount: debtType === 'single' ? total : parseFloat(installmentAmount),
          priority,
          start_date: startDate,
          debt_kind: debtType,
        });
      }
      toast.success('Dívida cadastrada!');
      setShowForm(false);
      resetForm();
    } catch {
      toast.error('Erro ao cadastrar');
    }
  };

  const handlePayInstallment = async (debt: any) => {
    const newPaid = debt.paid_installments + 1;
    const isComplete = newPaid >= debt.total_installments;
    try {
      await updateDebt.mutateAsync({
        id: debt.id,
        paid_installments: newPaid,
        ...(isComplete ? { status: 'paid_off' } : {}),
      });
      toast.success(isComplete ? 'Dívida quitada! 🎉' : 'Parcela paga!');
    } catch {
      toast.error('Erro ao atualizar');
    }
  };

  const resetForm = () => {
    setName(''); setTotalAmount('');
    setTotalInstallments(''); setInstallmentAmount('');
    setMonthlyAmount(''); setDurationMonths('');
    setPriority('important');
    setDebtType('installments');
  };

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Dívidas & Parcelas</h2>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Nova
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total em Dívidas</p>
              <p className="text-lg font-bold font-mono">{formatCurrency(totalDebtAmount)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Impacto Mensal</p>
              <p className="text-lg font-bold font-mono text-destructive">{formatCurrency(monthlyImpact)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Debt List */}
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (debts ?? []).length === 0 ? (
          <div className="text-center py-12">
            <Landmark className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhuma dívida cadastrada</p>
          </div>
        ) : (
          <div className="space-y-3">
            {(debts ?? []).map(debt => {
              const kind = (debt as any).debt_kind ?? (debt.total_installments <= 1 ? 'single' : 'installments');
              const isSingle = kind === 'single';
              const isRecurring = kind === 'recurring';
              const endDate = (debt as any).end_date as string | null;
              const isFinished = isRecurring && endDate && endDate < todayStr;
              const progress = isRecurring
                ? (endDate ? Math.min(100, (debt.paid_installments / (debt as any).duration_months) * 100) : 0)
                : (debt.paid_installments / debt.total_installments) * 100;
              const remaining = isRecurring
                ? (endDate
                    ? Math.max(0, ((debt as any).duration_months - debt.paid_installments)) * Number(debt.installment_amount)
                    : Number(debt.installment_amount))
                : Number(debt.total_amount) - Number(debt.installment_amount) * debt.paid_installments;
              return (
                <Card key={debt.id} className={cn(isFinished && 'opacity-60')}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{debt.name}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <PriorityBadge priority={debt.priority} />
                          <StatusBadge status={(isFinished ? 'paid_off' : debt.status) as any} />
                          {isRecurring && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                              Recorrente
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono">
                          {isRecurring && !endDate
                            ? `${formatCurrency(Number(debt.installment_amount))}/mês`
                            : formatCurrency(remaining)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {isRecurring && !endDate ? 'sem fim' : 'restante'}
                        </p>
                      </div>
                    </div>

                    {isRecurring && endDate && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{debt.paid_installments}/{(debt as any).duration_months} meses · até {new Date(endDate + 'T00:00:00').toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}</span>
                          <span>{formatCurrency(Number(debt.installment_amount))}/mês</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {isRecurring && !endDate && (
                      <p className="text-[10px] text-muted-foreground">{debt.paid_installments} meses pagos</p>
                    )}

                    {!isRecurring && !isSingle && (
                      <div>
                        <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                          <span>{debt.paid_installments}/{debt.total_installments} parcelas</span>
                          <span>{formatCurrency(Number(debt.installment_amount))}/mês</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {debt.status === 'active' && !isFinished && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => handlePayInstallment(debt)}>
                        {isSingle
                          ? 'Marcar como Quitada'
                          : isRecurring
                            ? `Pagar mês (${debt.paid_installments + 1}${endDate ? `/${(debt as any).duration_months}` : ''})`
                            : `Pagar Parcela (${debt.paid_installments + 1}/${debt.total_installments})`}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Debt Form */}
      <Sheet open={showForm} onOpenChange={setShowForm}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Nova Dívida</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 mt-4">
            {/* Type toggle */}
            <div>
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => setDebtType('single')}
                  className={cn(
                    'h-10 rounded-md border text-sm font-medium transition-colors',
                    debtType === 'single' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input'
                  )}
                >
                  Pontual
                </button>
                <button
                  type="button"
                  onClick={() => setDebtType('installments')}
                  className={cn(
                    'h-10 rounded-md border text-sm font-medium transition-colors',
                    debtType === 'installments' ? 'bg-primary text-primary-foreground border-primary' : 'bg-background border-input'
                  )}
                >
                  Parcelada
                </button>
              </div>
            </div>

            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financiamento do carro" className="mt-1" />
            </div>

            <div>
              <Label>Valor Total (R$)</Label>
              <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-1" />
            </div>

            {debtType === 'installments' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Qtd. Parcelas</Label>
                  <Input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Valor da Parcela (R$)</Label>
                  <Input type="number" step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="mt-1" />
                </div>
              </div>
            )}

            <div>
              <Label>Prioridade</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential">Essencial</SelectItem>
                  <SelectItem value="critical">Crítico</SelectItem>
                  <SelectItem value="important">Importante</SelectItem>
                  <SelectItem value="optional">Opcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Início</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleSubmit} className="w-full h-12" disabled={createDebt.isPending}>
              {createDebt.isPending ? 'Salvando...' : 'Cadastrar Dívida'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
