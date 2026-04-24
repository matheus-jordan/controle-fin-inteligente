ALTER TABLE public.credit_cards ALTER COLUMN last_digits DROP NOT NULL;
ALTER TABLE public.credit_cards ALTER COLUMN closing_day DROP NOT NULL;
ALTER TABLE public.credit_cards ALTER COLUMN due_day DROP NOT NULL;