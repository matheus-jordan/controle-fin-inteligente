# Dívida Recorrente com Duração

## Resumo
Adicionar um terceiro tipo de dívida: **Recorrente** (ex: moradia, mensalidade), com duração definida em meses ou data de término. Após o término, a dívida para de aparecer nos meses seguintes mas continua registrada (quitada) nos meses anteriores.

## Mudanças

### 1. Banco de dados (migration)
Adicionar colunas na tabela `debts`:
- `debt_kind` (text): `'single' | 'installments' | 'recurring'` — default `'installments'` para compatibilidade
- `end_date` (date, nullable): data calculada de término da dívida recorrente
- `duration_months` (integer, nullable): qtd de meses que a dívida recorrente dura (null = sem fim definido)

### 2. Formulário de Dívida (`Debts.tsx`)
Toggle com 3 opções: **Pontual / Parcelada / Recorrente**

- **Pontual**: Nome, Valor Total, Prioridade, Data (já existe)
- **Parcelada**: Nome, Valor Total, Qtd Parcelas, Valor Parcela, Prioridade, Data Início (já existe)
- **Recorrente** (novo): Nome, Valor Mensal, Prioridade, Data Início, **Duração em meses** (opcional — se vazio, sem fim)
  - Ao salvar: calcula `end_date = start_date + duration_months` quando informado

### 3. Card de dívida na listagem
- Recorrente: mostra "Recorrente · R$ X/mês" + "até MM/AAAA" se houver `end_date`
- Botão "Pagar mês" funciona como parcela (incrementa `paid_installments`)

### 4. Projeção mensal (`useFinanceData.ts`)
Dívidas recorrentes geram impacto mensal no dashboard apenas enquanto:
- O mês selecionado está entre `start_date` e `end_date` (se definido)
- Após `end_date`: não aparece mais no impacto/timeline, mas o registro continua na lista de dívidas com status `'paid_off'` automaticamente
- Meses anteriores ao `end_date`: continuam contabilizados normalmente

### 5. Cálculos
- `monthlyImpact` na tela de Dívidas: soma o `installment_amount` apenas de recorrentes ativas no mês atual + parceladas ativas
- `totalDebtAmount`: para recorrentes com `end_date`, calcula meses restantes × valor mensal

## Arquivos modificados
- Migration SQL — adicionar `debt_kind`, `end_date`, `duration_months`
- `src/pages/Debts.tsx` — toggle de 3 tipos, campo de duração, exibição
- `src/hooks/useFinanceData.ts` — `useCreateDebt` aceita novos campos; lógica de impacto mensal considera `end_date`
