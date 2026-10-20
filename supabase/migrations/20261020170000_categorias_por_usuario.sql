-- Categorias próprias por usuário. As categorias padrão continuam globais (user_id NULL).
ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

DROP POLICY IF EXISTS "Categories are readable by authenticated users" ON public.categories;
CREATE POLICY "Users can view global and own categories" ON public.categories
  FOR SELECT TO authenticated USING (user_id IS NULL OR auth.uid() = user_id);
CREATE POLICY "Users can create own categories" ON public.categories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.categories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.categories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
