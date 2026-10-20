-- Novas categorias: Cartão de Crédito e Pagamento Emprestado
INSERT INTO public.categories (name, type, icon, color)
SELECT v.name, v.type::transaction_type, v.icon, v.color
FROM (VALUES
  ('Cartão de Crédito', 'expense', 'credit-card', '#0EA5E9'),
  ('Pagamento Emprestado', 'expense', 'hand-coins', '#D946EF'),
  ('Pagamento Emprestado', 'income', 'hand-coins', '#D946EF')
) AS v(name, type, icon, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.categories c WHERE c.name = v.name AND c.type = v.type::transaction_type
);

