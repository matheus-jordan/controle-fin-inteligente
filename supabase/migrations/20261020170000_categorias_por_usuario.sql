-- Categorias próprias por usuário, editáveis por ele.
-- As categorias padrão (user_id NULL) viram modelo: cada usuário recebe uma cópia e os lançamentos passam a apontar para ela.
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Cópia das categorias padrão para cada usuário existente
INSERT INTO public.categories (name, type, icon, color, user_id)
SELECT g.name, g.type, g.icon, g.color, u.id
FROM public.categories g
CROSS JOIN auth.users u
WHERE g.user_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.categories c
    WHERE c.user_id = u.id AND c.name = g.name AND c.type = g.type
  );

-- Lançamentos, contas fixas e gastos de cartão passam a usar a cópia do próprio usuário
UPDATE public.transactions t SET category_id = c.id
FROM public.categories g, public.categories c
WHERE t.category_id = g.id AND g.user_id IS NULL
  AND c.user_id = t.user_id AND c.name = g.name AND c.type = g.type;

UPDATE public.fixed_bills f SET category_id = c.id
FROM public.categories g, public.categories c
WHERE f.category_id = g.id AND g.user_id IS NULL
  AND c.user_id = f.user_id AND c.name = g.name AND c.type = g.type;

UPDATE public.card_expenses e SET category_id = c.id
FROM public.categories g, public.categories c
WHERE e.category_id = g.id AND g.user_id IS NULL
  AND c.user_id = e.user_id AND c.name = g.name AND c.type = g.type;

-- Contas novas já nascem com a própria cópia das categorias padrão
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  INSERT INTO public.categories (name, type, icon, color, user_id)
  SELECT name, type, icon, color, NEW.id FROM public.categories WHERE user_id IS NULL;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Cada usuário vê e edita só as próprias categorias
DROP POLICY IF EXISTS "Categories are readable by authenticated users" ON public.categories;
DROP POLICY IF EXISTS "Users can view global and own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can view own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can create own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can update own categories" ON public.categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON public.categories;
CREATE POLICY "Users can view own categories" ON public.categories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
