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

-- Histórico: contas de cartão (nome de um cartão cadastrado pelo usuário, ou "cartão"/"fatura" na descrição)
UPDATE public.transactions t
SET category_id = (SELECT id FROM public.categories WHERE name = 'Cartão de Crédito' AND type = 'expense' LIMIT 1)
WHERE t.type = 'expense'
  AND (
    t.description ~* '(cart[ãa]o|fatura)'
    OR EXISTS (
      SELECT 1 FROM public.credit_cards cc
      WHERE cc.user_id = t.user_id AND t.description ILIKE '%' || cc.name || '%'
    )
  );

-- Histórico: valores emprestados com a mãe
UPDATE public.transactions t
SET category_id = (SELECT id FROM public.categories WHERE name = 'Pagamento Emprestado' AND type = t.type LIMIT 1)
WHERE t.description ~* '\m(m[ãa]e)\M';
