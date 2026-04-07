

# Ajuste do FinControl — Foco em Contas a Pagar

## Resumo
Transformar o sistema de "carteira financeira" para "gestor de contas a pagar". Entradas ficam simples (sem prioridade/vencimento/status). Dashboard centrado em lista de contas pendentes com alertas visuais. Saldo vira referência secundária.

---

## Mudanças

### 1. Formulário de Transação (`TransactionForm.tsx`)
- Quando tipo = **entrada**: mostrar apenas Nome, Valor, Data, Toggle recorrente + intervalo
- Esconder: Prioridade, Vencimento, Status (pago/pendente)
- Quando tipo = **saída**: manter todos os campos atuais
- Entradas são salvas automaticamente com `status: 'paid'`, `priority: 'optional'`, sem `due_date`

### 2. Dashboard (`Dashboard.tsx`) — Redesign completo
- **Topo**: 3 cards compactos — Entradas do mês, Saídas cadastradas, Estimativa restante
- Remover card de "Saldo Atual" como destaque principal (mover para texto secundário)
- Remover card de "Dívidas" e "% Comprometido" do topo (ficam em seções menores)
- **Seção principal**: "Contas a Pagar" — lista de todas saídas pendentes + fixed_bills, ordenada por:
  1. Status (pendente primeiro)
  2. Data de vencimento (mais próximo primeiro)  
  3. Prioridade (essential > critical > important > optional)
- Cada item com borda colorida: vermelho (vencido/hoje), amarelo (≤3 dias), verde (ok)
- Toggle rápido para marcar como pago direto da lista
- **Seção "Linha do Tempo"**: próximos 7-14 dias com marcadores de pagamentos futuros (visual simples)
- Mover gráficos para baixo como informação complementar

### 3. Transações (`Transactions.tsx`)
- Na listagem de entradas: não mostrar PriorityBadge nem StatusBadge
- Entradas exibem apenas: descrição, valor, data, categoria
- Saídas mantêm todos os badges e ações (toggle pago, excluir)

### 4. Hook `useFinanceData.ts`
- Adicionar hook `useUpcomingPayments()` que combina transações pendentes + fixed_bills do mês, ordena por vencimento e retorna lista unificada com status de urgência
- Ajustar `useFinanceSummary` para calcular "estimativa restante" = entradas - saídas cadastradas (sem pretensão de precisão)

### 5. Componente novo: `PaymentTimeline.tsx`
- Componente visual simples mostrando próximos pagamentos nos próximos 14 dias
- Marcadores coloridos por urgência
- Scrollável horizontalmente no mobile

### 6. Dados resilientes
- Garantir que todos os componentes funcionem com dados parciais (nullish coalescing em todos os campos opcionais)
- Formulários aceitam submissão mesmo sem categoria ou data de vencimento

---

## Arquivos modificados
- `src/components/transactions/TransactionForm.tsx` — condicionar campos por tipo
- `src/pages/Dashboard.tsx` — redesign com foco em contas a pagar
- `src/pages/Transactions.tsx` — diferenciação visual entrada/saída
- `src/hooks/useFinanceData.ts` — novo hook `useUpcomingPayments`
- `src/components/dashboard/PaymentTimeline.tsx` — novo componente
- `src/lib/format.ts` — helper para urgência por data (já existe parcialmente)

