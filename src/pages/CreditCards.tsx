import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import {
  useCreditCards, useCreateCreditCard, useUpdateCreditCard, useCardExpenses, useCreateCardExpense, useCategories,
  useCardInvoices, usePayCardInvoice,
} from '@/hooks/useFinanceData';
import { cardOpenBalance } from '@/lib/cardInvoice';
import { formatCurrency } from '@/lib/format';
import { MonthNav } from '@/components/shared/MonthNav';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, CreditCard as CreditCardIcon, Receipt, Settings2, AlertTriangle, Check, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const shortDate = (d: Date | null) => (d ? d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null);

export default function CreditCards() {
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const currentMonth = `${targetDate.getFullYear()}-${(targetDate.getMonth() + 1).toString().padStart(2, '0')}`;
  const monthLabel = 'Faturas de ' + targetDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  const { data: cards, isLoading } = useCreditCards();
  const { data: allExpenses } = useCardExpenses();
  const { data: categories } = useCategories();
  const { invoices } = useCardInvoices(currentMonth);
  const createCard = useCreateCreditCard();
  const updateCard = useUpdateCreditCard();
  const createExpense = useCreateCardExpense();
  const payInvoice = usePayCardInvoice();

  const [showCardForm, setShowCardForm] = useState(false);
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string>('');

  // Card form state
  const [cardName, setCardName] = useState('');
  const [cardColor, setCardColor] = useState('#3B82F6');
  const [cardLimit, setCardLimit] = useState('');
  const [cardClosing, setCardClosing] = useState('');
  const [cardDue, setCardDue] = useState('');

  // Expense form state
  const [expDesc, setExpDesc] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expInstallments, setExpInstallments] = useState('1');
  const [expCategoryId, setExpCategoryId] = useState('');

  const expenseCategories = categories?.filter(c => c.type === 'expense') ?? [];

  const openCardForm = (card?: any) => {
    setEditingCardId(card?.id ?? null);
    setCardName(card?.name ?? '');
    setCardColor(card?.color ?? '#3B82F6');
    setCardLimit(card?.credit_limit ? String(card.credit_limit) : '');
    setCardClosing(card?.closing_day ? String(card.closing_day) : '');
    setCardDue(card?.due_day ? String(card.due_day) : '');
    setShowCardForm(true);
  };

  const handleSaveCard = async () => {
    if (!cardName) {
      toast.error('Informe o nome do cartão');
      return;
    }
    const day = (v: string) => {
      const n = parseInt(v);
      return n >= 1 && n <= 31 ? n : null;
    };
    const data = {
      name: cardName,
      color: cardColor,
      credit_limit: cardLimit ? parseFloat(cardLimit) : 0,
      closing_day: day(cardClosing),
      due_day: day(cardDue),
    };
    try {
      if (editingCardId) await updateCard.mutateAsync({ id: editingCardId, ...data });
      else await createCard.mutateAsync(data as any);
      toast.success(editingCardId ? 'Cartão atualizado!' : 'Cartão cadastrado!');
      setShowCardForm(false);
    } catch {
      toast.error('Erro ao salvar cartão');
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
        date: expDate, installments: parseInt(expInstallments) || 1, category_id: expCategoryId || undefined,
      });
      toast.success('Gasto registrado!');
      setShowExpenseForm(false);
      setExpDesc(''); setExpAmount(''); setExpInstallments('1'); setExpCategoryId('');
    } catch {
      toast.error('Erro ao registrar');
    }
  };

  const handlePayInvoice = async (invoice: (typeof invoices)[0]) => {
    try {
      await payInvoice.mutateAsync(invoice);
      toast.success(`Fatura ${invoice.cardName} marcada como paga!`);
    } catch {
      toast.error('Erro ao registrar pagamento');
    }
  };

  const colors = ['#3B82F6', '#0EA5E9', '#6366F1', '#A855F7', '#EC4899', '#EF4444', '#F97316', '#22C55E', '#14B8A6', '#1E293B'];
  const installmentAmount = expAmount && parseInt(expInstallments) > 1 ? parseFloat(expAmount) / parseInt(expInstallments) : null;

  return (
    <AppLayout>
      <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Cartões de Crédito</h2>
          <Button size="sm" onClick={() => openCardForm()} className="rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Novo
          </Button>
        </div>

        <MonthNav label={monthLabel} onPrev={() => setMonthOffset(o => o - 1)} onNext={() => setMonthOffset(o => o + 1)} />

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : !cards?.length ? (
          <div className="text-center py-12">
            <CreditCardIcon className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
            <p className="text-muted-foreground">Nenhum cartão cadastrado</p>
          </div>
        ) : (
          <div className="space-y-6">
            {cards.map(card => {
              const invoice = invoices.find(i => i.cardId === card.id);
              if (!invoice) return null;
              const limit = Number(card.credit_limit) || 0;
              const used = cardOpenBalance(card, allExpenses ?? [], now.getFullYear(), now.getMonth());
              const usedPct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
              const configured = !!card.closing_day && !!card.due_day;
              const reg = invoice.registered;
              const diff = reg ? Number(reg.amount) - invoice.amount : 0;

              return (
                <div key={card.id} className="space-y-3">
                  {/* Visual Card */}
                  <div
                    className="rounded-3xl p-5 text-white relative overflow-hidden border border-white/15 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.8)]"
                    style={{ background: `linear-gradient(135deg, ${card.color}, ${card.color}99 55%, #0b1224)` }}
                  >
                    <div className="pointer-events-none absolute -top-16 -right-10 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
                    <div className="flex justify-between items-start relative">
                      <div>
                        <p className="text-xs opacity-80">Fatura de {targetDate.toLocaleDateString('pt-BR', { month: 'long' })}</p>
                        <p className="font-bold text-lg">{card.name}</p>
                      </div>
                      <button onClick={() => openCardForm(card)} className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center" title="Configurar cartão">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </div>
                    <p className="font-bold text-3xl font-mono mt-5 relative">{formatCurrency(reg ? Number(reg.amount) : invoice.amount)}</p>
                    <p className="text-xs opacity-80 mt-1 relative">
                      {configured
                        ? `Fecha ${shortDate(invoice.closingDate)} · Vence ${shortDate(invoice.dueDate)}`
                        : 'Fechamento e vencimento não configurados'}
                    </p>
                    {limit > 0 && (
                      <div className="mt-4 relative">
                        <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
                          <div className="h-full rounded-full bg-white" style={{ width: `${usedPct}%` }} />
                        </div>
                        <p className="text-xs opacity-80 mt-1.5">
                          Limite usado {formatCurrency(used)} de {formatCurrency(limit)} · disponível {formatCurrency(Math.max(0, limit - used))}
                        </p>
                      </div>
                    )}
                  </div>

                  {!configured && (
                    <button onClick={() => openCardForm(card)} className="w-full flex items-center gap-2 px-4 py-3 rounded-2xl bg-warning/10 border border-warning/30 text-warning text-sm text-left">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      Configure o dia de fechamento e vencimento para as faturas caírem no mês certo
                    </button>
                  )}

                  {/* Invoice status */}
                  <div className="glass-flat rounded-2xl p-4 space-y-3">
                    {reg ? (
                      <div className="flex items-start gap-2 text-sm">
                        <Link2 className="h-4 w-4 mt-0.5 shrink-0 text-[hsl(var(--glow))]" />
                        <div className="min-w-0">
                          <p>
                            Lançada nas transações como <span className="font-medium">"{reg.description}"</span>{' '}
                            <span className={reg.status === 'paid' ? 'text-success' : 'text-warning'}>
                              ({reg.status === 'paid' ? 'paga' : 'pendente'})
                            </span>
                          </p>
                          {invoice.amount > 0 && Math.abs(diff) >= 0.01 && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Pelos gastos registrados aqui a fatura daria {formatCurrency(invoice.amount)} ({diff > 0 ? '+' : '−'}{formatCurrency(Math.abs(diff))} de diferença)
                            </p>
                          )}
                        </div>
                      </div>
                    ) : invoice.amount > 0 ? (
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm text-muted-foreground">Fatura calculada pelos gastos, ainda não paga</p>
                        <Button size="sm" variant="outline" className="rounded-full shrink-0" onClick={() => handlePayInvoice(invoice)} disabled={payInvoice.isPending}>
                          <Check className="h-4 w-4 mr-1" /> Paguei
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Nenhum gasto nesta fatura</p>
                    )}

                    {invoice.items.length > 0 && (
                      <div className="divide-y divide-border">
                        {invoice.items.map(item => (
                          <div key={item.id} className="flex items-center justify-between py-2">
                            <div className="min-w-0">
                              <p className="text-sm truncate">{item.description}</p>
                              <p className="text-xs text-muted-foreground">
                                {item.installments > 1 ? `Parcela ${item.installment}/${item.installments}` : 'À vista'}
                              </p>
                            </div>
                            <p className="text-sm font-semibold font-mono">{formatCurrency(item.amount)}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <Button variant="ghost" size="sm" className="w-full rounded-full" onClick={() => { setSelectedCardId(card.id); setShowExpenseForm(true); }}>
                      <Receipt className="h-4 w-4 mr-1" /> Adicionar gasto
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Card Form */}
      <Sheet open={showCardForm} onOpenChange={setShowCardForm}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto max-w-2xl mx-auto">
          <SheetHeader><SheetTitle>{editingCardId ? 'Configurar Cartão' : 'Novo Cartão'}</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Nome do Cartão</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Ex: Nubank" className="mt-1" />
              <p className="text-xs text-muted-foreground mt-1">Use o mesmo nome que aparece nas transações da fatura (ex: "Fatura Nubank").</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Dia de fechamento</Label>
                <Input type="number" min={1} max={31} value={cardClosing} onChange={(e) => setCardClosing(e.target.value)} placeholder="Ex: 5" className="mt-1" />
              </div>
              <div>
                <Label>Dia de vencimento</Label>
                <Input type="number" min={1} max={31} value={cardDue} onChange={(e) => setCardDue(e.target.value)} placeholder="Ex: 12" className="mt-1" />
              </div>
            </div>
            <div>
              <Label>Limite (R$)</Label>
              <Input type="number" step="0.01" value={cardLimit} onChange={(e) => setCardLimit(e.target.value)} placeholder="Opcional" className="mt-1" />
            </div>
            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1 flex-wrap">
                {colors.map(c => (
                  <button key={c} type="button" onClick={() => setCardColor(c)}
                    className={cn('w-8 h-8 rounded-full border-2 transition-all', cardColor === c ? 'border-foreground scale-110' : 'border-transparent')}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>
            <Button onClick={handleSaveCard} className="w-full h-12" disabled={createCard.isPending || updateCard.isPending}>
              {createCard.isPending || updateCard.isPending ? 'Salvando...' : editingCardId ? 'Salvar' : 'Cadastrar Cartão'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Expense Form */}
      <Sheet open={showExpenseForm} onOpenChange={setShowExpenseForm}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto max-w-2xl mx-auto">
          <SheetHeader><SheetTitle>Novo Gasto no Cartão</SheetTitle></SheetHeader>
          <div className="space-y-4 mt-4">
            <div>
              <Label>Descrição</Label>
              <Input value={expDesc} onChange={(e) => setExpDesc(e.target.value)} placeholder="Ex: Amazon" className="mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor total (R$)</Label>
                <Input type="number" step="0.01" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label>Parcelas</Label>
                <Input type="number" min={1} value={expInstallments} onChange={(e) => setExpInstallments(e.target.value)} className="mt-1" />
              </div>
            </div>
            {installmentAmount !== null && (
              <p className="text-xs text-muted-foreground -mt-2">{expInstallments}x de {formatCurrency(installmentAmount)}</p>
            )}
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
              <Label>Data da compra</Label>
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
