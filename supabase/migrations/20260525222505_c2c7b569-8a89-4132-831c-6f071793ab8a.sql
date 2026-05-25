ALTER TABLE public.debts 
  ADD COLUMN IF NOT EXISTS debt_kind text NOT NULL DEFAULT 'installments',
  ADD COLUMN IF NOT EXISTS end_date date,
  ADD COLUMN IF NOT EXISTS duration_months integer;