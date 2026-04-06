import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useCreditCards, useCreateCreditCard, useCardExpenses, useCreateCardExpense, useCategories } from '@/hooks/useFinanceData';
import { formatCurrency, getDaysUntilDue } from '@/lib/format';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, CreditCard as CreditCardIcon, Receipt } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function CreditCards() {
  const { data: cards, isLoading } = useCreditCards();
  const { data: allExpenses } = useCardExpenses();
  const { data: categories } = useCategories();
  const createCard = useCreateCreditCard();
  const createExpense = useCreateCardExpense();

  const [showCardForm, setShowCardForm] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  // Card form state
  const [cardName, setCardName] = useState('');
  const [lastDigits, setLastDigits] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closingDay, setClosingDay] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [cardColor, setCardColor] = useState('#3B82F6');

  // Expense form state
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expInstallments, setExpInstallments] = useState('1');
  const [expCategoryId, setExpCategoryId] = useState('');

  const expenseCategories = categories?.filter(c => c.type === 'expense') ?? [];

  const handleCreateCard = async () => {
    if (!cardName || !lastDigits || !closingDay || !dueDay) {
      toast.error('Preencha todos os campos');
      return;
    }
    try {
      await createCard.mutateAsync({
        name: cardName, last_digits: lastDigits, credit_limit: parseFloat(creditLimit || '0'),
        closing_day: parseInt(closingDay), due_day: parseInt(dueDay), color: cardColor,
      });
      toast.success('Cartão cadastrado!');
      setShowCardForm(false);
      setCardName(''); setLastDigits(''); setCreditLimit(''); setClosingDay(''); setDueDay('');
    } catch {
      toast.error('Erro ao cadastrar');
    }
  };

  const handleCreateExpense = async () => {
    if (!selectedCardId || !expDesc || !expAmount) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }
    try {
      await createExpense.mutateAsync({
        card_id: selectedCardId, description: expDesc, amount: parseFloat(expAmount),
        date: expDate, installments: parseInt(expInstallments), category_id: expCategoryId || undefined,
      });
      toast.success('Gasto registrado!');
      setShowExpenseForm(false);
      setExpDesc(''); setExpAmount(''); setExpInstallments('1'); setExpCategoryId('');
    } catch {
      toast.error('Erro ao registrar');
    }
  };

  const colors = ['#3B82F6', '#EF4444', '#22C55E', '#A855F7', '#F97316', '#EC4899', '#6366F1', '#14B8A6'];

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cartões de Crédito</h2>
          <Button size="sm" onClick={() => setShowCardForm(true)}>
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : (cards ?? []).length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {(cards ?? []).map(card => {
              const cardExpenses = (allExpenses ?? []).filter(e => e.card_id === card.id);
              const currentInvoice = cardExpenses.reduce((s, e) => s + Number(e.amount), 0);
              const daysUntilDue = getDaysUntilDue(card.due_day);
              const usagePercent = card.credit_limit > 0 ? (currentInvoice / Number(card.credit_limit)) * 100 : 0;

              return (
                <div key={card.id} className="space-y-2">
                  {/* Visual Card */}
                  <div
                    className="rounded-xl p-5 text-white shadow-lg relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}CC)` }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs opacity-80">Cartão</p>
                        <p className="font-bold text-lg">{card.name}</p>
                      </div>
                      <CreditCardIcon className="h-8 w-8 opacity-50" />
                    </div>
                    <p className="mt-4 text-lg font-mono tracking-widest">•••• •••• •••• {card.last_digits}</p>
                    <div className="flex justify-between mt-4 text-xs">
                      <div>
                        <p className="opacity-70">Fatura Atual</p>
                        <p className="font-bold text-base">{formatCurrency(currentInvoice)}</p>
                      </div>
                      <div className="text-right">
                        <p className="opacity-70">Vencimento</p>
                        <p className="font-bold">Dia {card.due_day} ({daysUntilDue}d)</p>
                      </div>
                    </div>
                    {card.credit_limit > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-[10px] opacity-70">
                          <span>Limite: {formatCurrency(Number(card.credit_limit))}</span>
                          <span>{usagePercent.toFixed(0)}% usado</span>
                        </div>
                        <div className="w-full bg-white/20 rounded-full h-1.5 mt-1">
                          <div className="bg-white rounded-full h-1.5 transition-all" style={{ width: `${Math.min(usagePercent, 100)}%` }} />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Add expense button */}
                  <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedCardId(card.id); setShowExpenseForm(true); }}>
                    <Receipt className="h-4 w-4 mr-1" /> Adicionar Gasto
                  </Button>

                  {/* Card expenses */}
                  {cardExpenses.length > 0 && (
                    <div className="space-y-1">
                      {cardExpenses.slice(0, 5).map(exp => (
                        <div key={exp.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50">
                          <div>
                            <p className="text-sm">{exp.description}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {exp.installments > 1 ? `${exp.current_installment}/${exp.installments}x` : 'À vista'}
                            </p>
                          </div>
                          <p className="text-sm font-bold font-mono">{formatCurrency(Number(exp.amount))}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Form */}
      <Sheet open={showCardForm} onOpenChange={setShowCardForm}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Novo Cartão</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome do Cartão</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Últimos 4 dígitos</Label>
                <Input value={lastDigits} onChange={(e) => setLastDigits(e.target.value.slice(0, 4))} maxLength={4} className="mt-1" />
              </div>
              <div>
                <Label>Limite (R$)</Label>
                <Input type="number" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia Fechamento</Label>
                <Input type="number" min={1} max={31} value={closingDay} onChange={(e) => setClosingDay(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Dia Vencimento</Label>
                <Input type="number" min={1} max={31} value={dueDay} onChange={(e) => setDueDay(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {colors.map(c => (
                  <button key={c} onClick={() => setCardColor(c)}
                    className={cn('w-8 h-8 rounded-full border-2 transition-all', cardColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Button onClick={handleCreateCard} className="w-full h-12" disabled={createCard.isPending}>
              {createCard.isPending ? 'Salvando...' : 'Cadastrar Cartão'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Expense Form */}
      <Sheet open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Novo Gasto no Cartão</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Descrição</Label>
              <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Ex: Amazon" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$)</Label>
                <Input type="number" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} value={expInstallments} onChange={(e) => setExpInstallments(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={expCategoryId} onValueChange={setExpCategoryId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data</Label>
              <Input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="mt-1" />
            </div>
            <Button onClick={handleCreateExpense} className="w-full h-12" disabled={createExpense.isPending}>
              {createExpense.isPending ? 'Salvando...' : 'Registrar Gasto'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}
