

# Melhorias no Formulário de Saídas e Filtro de Data na Home

## Mudanças

### 1. Formulário de Saída (`TransactionForm.tsx`)
- Adicionar toggle **"Pontual / Recorrente"** para saídas (já existe o switch de recorrente)
- Quando **recorrente**: mostrar intervalo (mensal, semanal, etc.)
- Adicionar **checkbox "Tem data de vencimento?"**:
  - Desmarcado: campo de vencimento fica oculto, `due_date` salvo como `null`
  - Marcado: exibe campo de data de vencimento
- Remover o campo de vencimento fixo que aparece sempre para saídas
- Entradas mantêm comportamento atual (apenas data simples)

### 2. Dashboard — Filtro de data (`Dashboard.tsx`)
- Adicionar navegação por mês no topo (setas esquerda/direita + label do mês), igual já existe em Transações
- `useUpcomingPayments` e `useFinanceSummary` passam a receber o mês selecionado como parâmetro
- A lista de contas mostra TODAS as contas do mês selecionado (não apenas os próximos 14 dias), ordenadas por data de vencimento

### 3. Hook `useFinanceData.ts`
- `useUpcomingPayments(month)` — aceita mês como parâmetro para filtrar transações
- `useFinanceSummary(month)` — aceita mês como parâmetro
- Saídas sem `due_date` aparecem na lista mas sem indicador de urgência (neutro/cinza)

### 4. PaymentTimeline
- Ajustar para funcionar com o mês selecionado (não apenas "próximos 14 dias" a partir de hoje)

## Arquivos modificados
- `src/components/transactions/TransactionForm.tsx` — checkbox de vencimento
- `src/pages/Dashboard.tsx` — filtro de mês
- `src/hooks/useFinanceData.ts` — parâmetro de mês nos hooks
- `src/components/dashboard/PaymentTimeline.tsx` — adaptar ao mês selecionado

