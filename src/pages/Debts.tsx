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
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function Debts() {
  const { data: debts, isLoading } = useDebts();
  const createDebt = useCreateDebt();
  const updateDebt = useUpdateDebt();
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [interestRate, setInterestRate] = useState('');
  const [totalInstallments, setTotalInstallments] = useState('');
  const [installmentAmount, setInstallmentAmount] = useState('');
  const [priority, setPriority] = useState('important');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);

  const activeDebts = (debts ?? []).filter(d => d.status === 'active');
  const totalDebtAmount = activeDebts.reduce((s, d) => s + (Number(d.total_amount) - Number(d.installment_amount) * d.paid_installments), 0);
  const monthlyImpact = activeDebts.reduce((s, d) => s + Number(d.installment_amount), 0);

  const handleSubmit = async () => {
    if (!name || !totalAmount || !totalInstallments || !installmentAmount) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      await createDebt.mutateAsync({
        name, total_amount: parseFloat(totalAmount),
        interest_rate: interestRate ? parseFloat(interestRate) : undefined,
        total_installments: parseInt(totalInstallments),
        installment_amount: parseFloat(installmentAmount),
        priority, start_date: startDate,
      });
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
    setName(''); setTotalAmount(''); setInterestRate('');
    setTotalInstallments(''); setInstallmentAmount(''); setPriority('important');
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
              const progress = (debt.paid_installments / debt.total_installments) * 100;
              const remaining = Number(debt.total_amount) - Number(debt.installment_amount) * debt.paid_installments;
              return (
                <Card key={debt.id}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-semibold text-sm">{debt.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <PriorityBadge priority={debt.priority} />
                          <StatusBadge status={debt.status as any} />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono">{formatCurrency(remaining)}</p>
                        <p className="text-[10px] text-muted-foreground">restante</p>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                        <span>{debt.paid_installments}/{debt.total_installments} parcelas</span>
                        <span>{formatCurrency(Number(debt.installment_amount))}/mês</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    {debt.status === 'active' && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => handlePayInstallment(debt)}>
                        Pagar Parcela ({debt.paid_installments + 1}/{debt.total_installments})
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
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financiamento do carro" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor Total (R$)</Label>
                <Input type="number" step="0.01" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Juros (% a.m.)</Label>
                <Input type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Total de Parcelas</Label>
                <Input type="number" value={totalInstallments} onChange={(e) => setTotalInstallments(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Valor da Parcela (R$)</Label>
                <Input type="number" step="0.01" value={installmentAmount} onChange={(e) => setInstallmentAmount(e.target.value)} className="mt-1" />
              </div>
            </div>
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
