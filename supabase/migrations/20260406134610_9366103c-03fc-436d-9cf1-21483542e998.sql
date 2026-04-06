
-- Create priority enum
CREATE TYPE public.priority_level AS ENUM ('essential', 'critical', 'important', 'optional');

-- Create transaction type enum
CREATE TYPE public.transaction_type AS ENUM ('income', 'expense');

-- Create recurrence interval enum
CREATE TYPE public.recurrence_interval AS ENUM ('monthly', 'weekly', 'biweekly', 'yearly');

-- Create categories table
CREATE TABLE public.categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  type transaction_type NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  color TEXT NOT NULL DEFAULT '#6B7280',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create transactions table
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  type transaction_type NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval recurrence_interval,
  priority priority_level NOT NULL DEFAULT 'optional',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('paid', 'pending')),
  due_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create fixed_bills table
CREATE TABLE public.fixed_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  category_id UUID REFERENCES public.categories(id),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  priority priority_level NOT NULL DEFAULT 'important',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create debts table
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  total_installments INTEGER NOT NULL,
  paid_installments INTEGER NOT NULL DEFAULT 0,
  installment_amount DECIMAL(12,2) NOT NULL,
  priority priority_level NOT NULL DEFAULT 'important',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off')),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create credit_cards table
CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  last_digits TEXT NOT NULL CHECK (LENGTH(last_digits) = 4),
  credit_limit DECIMAL(12,2) NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  color TEXT NOT NULL DEFAULT '#3B82F6',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create card_expenses table
CREATE TABLE public.card_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  card_id UUID REFERENCES public.credit_cards(id) ON DELETE CASCADE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  installments INTEGER NOT NULL DEFAULT 1,
  current_installment INTEGER NOT NULL DEFAULT 1,
  category_id UUID REFERENCES public.categories(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_settings table
CREATE TABLE public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  theme TEXT NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
  monthly_income_goal DECIMAL(12,2) DEFAULT 0,
  alert_days_before INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.card_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Categories: readable by all authenticated users
CREATE POLICY "Categories are readable by authenticated users" ON public.categories FOR SELECT TO authenticated USING (true);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON public.transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own transactions" ON public.transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own transactions" ON public.transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own transactions" ON public.transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Fixed bills policies
CREATE POLICY "Users can view own fixed bills" ON public.fixed_bills FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own fixed bills" ON public.fixed_bills FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own fixed bills" ON public.fixed_bills FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own fixed bills" ON public.fixed_bills FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Debts policies
CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debts" ON public.debts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Credit cards policies
CREATE POLICY "Users can view own credit cards" ON public.credit_cards FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own credit cards" ON public.credit_cards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own credit cards" ON public.credit_cards FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own credit cards" ON public.credit_cards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Card expenses policies
CREATE POLICY "Users can view own card expenses" ON public.card_expenses FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own card expenses" ON public.card_expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own card expenses" ON public.card_expenses FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own card expenses" ON public.card_expenses FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- User settings policies
CREATE POLICY "Users can view own settings" ON public.user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create own settings" ON public.user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own settings" ON public.user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Insert default categories
INSERT INTO public.categories (name, type, icon, color) VALUES
  ('Salário', 'income', 'briefcase', '#22C55E'),
  ('Freelance', 'income', 'laptop', '#10B981'),
  ('Investimentos', 'income', 'trending-up', '#06B6D4'),
  ('Outros Receitas', 'income', 'plus-circle', '#8B5CF6'),
  ('Moradia', 'expense', 'home', '#EF4444'),
  ('Alimentação', 'expense', 'utensils', '#F97316'),
  ('Transporte', 'expense', 'car', '#EAB308'),
  ('Saúde', 'expense', 'heart', '#EC4899'),
  ('Educação', 'expense', 'book-open', '#3B82F6'),
  ('Lazer', 'expense', 'gamepad-2', '#A855F7'),
  ('Assinaturas', 'expense', 'repeat', '#6366F1'),
  ('Roupas', 'expense', 'shirt', '#14B8A6'),
  ('Outros Despesas', 'expense', 'circle', '#6B7280');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for user_settings
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to auto-create user settings on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
