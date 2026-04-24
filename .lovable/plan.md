

# Ajustes em Recorrência, Dívidas e Cartões

## Resumo
1. Transações recorrentes devem gerar entradas virtuais nos meses futuros automaticamente no calendário/dashboard
2. Dívidas: remover juros, adicionar toggle pontual/parcelada
3. Cartões: simplificar cadastro (só nome e cor), manter como container de transações isolado

---

## Mudanças

### 1. Recorrência no calendário (`useFinanceData.ts`)
- No hook `useTransactions(month)`, após buscar transações reais, gerar "instâncias virtuais" de transações recorrentes de meses anteriores que se projetam no mês selecionado
- Lógica: buscar todas transações recorrentes do usuário (sem filtro de mês), calcular se o intervalo (weekly/biweekly/monthly/yearly) cai dentro do mês alvo, e incluir como itens na lista
- Transações recorrentes com `due_date` preenchido param de se repetir (usam apenas a data original)
- Transações recorrentes sem `due_date` continuam aparecendo nos meses seguintes

### 2. Dívidas (`Debts.tsx` + `useFinanceData.ts`)
- Remover campo de juros (`interest_rate`) do formulário — não precisa de migration pois o campo é nullable no banco
- Adicionar toggle **"Pontual ou Parcelada?"**:
  - **Pontual**: apenas Nome, Valor Total, Prioridade, Data — salva com `total_installments: 1` e `installment_amount: total_amount`
  - **Parcelada**: mostra campos adicionais de Quantidade de Parcelas e Valor de Cada Parcela
- Ajustar `useCreateDebt` para não enviar `interest_rate`

### 3. Cartões (`CreditCards.tsx`)
- Simplificar formulário de cadastro: manter apenas **Nome** e **Cor**
- Remover campos: últimos 4 dígitos, limite, dia de fechamento, dia de vencimento
- No visual do cartão, mostrar apenas nome + cor + lista de transações dentro dele
- Cartão funciona apenas como agrupador de gastos, sem impacto no restante do sistema
- Manter o formulário de "Adicionar Gasto" como está (descrição, valor, parcelas, categoria, data)
- Migration: alterar tabela `credit_cards` para tornar `last_digits`, `closing_day`, `due_day` nullable (dados existentes continuam, mas novos cartões não precisam)

### 4. Ajuste no Dashboard/Timeline
- `useUpcomingPayments` e `useFinanceSummary` já consomem `useTransactions`, então as instâncias virtuais de recorrentes aparecerão automaticamente na Home

---

## Arquivos modificados
- `src/hooks/useFinanceData.ts` — lógica de recorrência virtual + ajuste createDebt
- `src/pages/Debts.tsx` — remover juros, toggle pontual/parcelada
- `src/pages/CreditCards.tsx` — simplificar formulário de cadastro
- Migration SQL — tornar campos do cartão nullable

