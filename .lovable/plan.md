

# FinControl — Sistema de Gestão Financeira Pessoal

## Visão Geral
App mobile-first de finanças pessoais com dashboard inteligente, controle de dívidas, cartões e alertas visuais. Moeda BRL, dark/light mode, dados armazenados no Lovable Cloud (Supabase).

---

## 🗃️ Modelagem de Dados (Supabase)

### Tabelas:
1. **categories** — id, name, type (income/expense), icon, color
2. **transactions** — id, user_id, category_id, description, amount, type (income/expense), date, is_recurring, recurrence_interval, priority (essential/critical/important/optional), status (paid/pending), due_date, created_at
3. **fixed_bills** — id, user_id, name, amount, category_id, due_day, priority, is_active, created_at
4. **debts** — id, user_id, name, total_amount, interest_rate, total_installments, paid_installments, installment_amount, priority, status (active/paid_off), start_date, created_at
5. **credit_cards** — id, user_id, name, last_digits, credit_limit, closing_day, due_day, color, created_at
6. **card_expenses** — id, user_id, card_id, description, amount, date, installments, current_installment, category_id, created_at
7. **user_settings** — id, user_id, theme (dark/light), monthly_income_goal, alert_days_before

### Dados iniciais:
- Categorias pré-cadastradas (Moradia, Alimentação, Transporte, Saúde, Lazer, Educação, Salário, Freelance, etc.)
- Transações e dívidas de exemplo

---

## 📱 Telas e Navegação

### Navegação inferior (mobile-first):
**Dashboard** | **Transações** | **+ (Add)** | **Dívidas** | **Cartões**

### 1. Dashboard
- Cards resumo: Saldo atual, Entradas, Saídas, Dívidas, % Comprometimento
- Saldo projetado (fim do mês)
- Lista "Próximos Vencimentos" com badges coloridos (vermelho/amarelo/verde)
- Gráfico de barras: Entradas vs Saídas (últimos 6 meses)
- Gráfico de rosca: Gastos por categoria
- Toggle dark/light mode no header

### 2. Transações
- Lista filtrada por mês com busca
- Filtros: tipo, categoria, prioridade, status
- Cada item mostra: ícone categoria, descrição, valor, data, badge prioridade
- Swipe para editar/excluir (mobile)
- FAB para adicionar

### 3. Formulário Rápido (modal/sheet)
- Tipo: Entrada/Saída (toggle)
- Valor (input numérico grande)
- Descrição, Categoria (select), Data
- Prioridade (chips: Essencial/Crítico/Importante/Opcional)
- Toggle recorrente + intervalo
- Data de vencimento
- Máximo 1 tela, sem scroll excessivo

### 4. Contas Fixas
- Lista de contas mensais com status pago/pendente
- Highlight automático: vermelho (vencida), amarelo (≤3 dias), verde (ok)
- Toggle rápido para marcar como paga
- Acessível via Dashboard ou menu

### 5. Dívidas e Parcelamentos
- Cards por dívida: nome, progresso visual (barra), parcelas pagas/total
- Valor restante e impacto mensal
- Resumo no topo: total de dívidas, impacto mensal total
- Adicionar/editar dívida com formulário

### 6. Cartões de Crédito
- Card visual por cartão (com cor customizada e últimos dígitos)
- Fatura atual: valor total ou lista de gastos detalhados
- Próximo vencimento e dias restantes
- Adicionar gastos ao cartão

### 7. Alertas Visuais (integrado em todas as telas)
- Banner no Dashboard para contas vencidas (vermelho)
- Badges nos itens próximos do vencimento
- Indicador de comprometimento: verde (<50%), amarelo (50-80%), vermelho (>80%)
- Toast notifications para ações

---

## 🧠 Lógica de Cálculos Automáticos
- **Saldo atual** = soma entradas pagas - soma saídas pagas (mês atual)
- **Saldo projetado** = saldo atual - contas pendentes do mês
- **Comprometimento** = (total saídas + parcelas) / total entradas × 100
- **Impacto parcelamentos** = soma de todas parcelas ativas no mês

---

## 🎨 Design System
- Cores de alerta: vermelho (destructive), amarelo (#EAB308), verde (#22C55E)
- Prioridades: Essencial (vermelho), Crítico (laranja), Importante (azul), Opcional (cinza)
- Cards com bordas suaves, sombras sutis
- Tipografia clara com hierarquia definida
- Dark/Light mode com toggle

---

## 🏗️ Estrutura de Componentes
- `components/layout/` — BottomNav, Header, ThemeToggle
- `components/dashboard/` — SummaryCards, UpcomingBills, Charts
- `components/transactions/` — TransactionList, TransactionForm, FilterBar
- `components/debts/` — DebtCard, DebtForm, InstallmentProgress
- `components/cards/` — CreditCardVisual, CardExpenseList, CardForm
- `components/shared/` — PriorityBadge, StatusBadge, AlertBanner, MoneyInput
- `pages/` — Dashboard, Transactions, Debts, CreditCards, Settings
- `hooks/` — useFinanceSummary, useUpcomingBills, useDebts, useCards

---

## Implementação em Fases
**Fase 1:** Setup do banco, autenticação, categorias, tema dark/light
**Fase 2:** Dashboard + Transações (CRUD completo)
**Fase 3:** Contas fixas + Sistema de prioridades + Alertas visuais
**Fase 4:** Dívidas e parcelamentos
**Fase 5:** Cartões de crédito
**Fase 6:** Gráficos, cálculos automáticos, dados de exemplo

