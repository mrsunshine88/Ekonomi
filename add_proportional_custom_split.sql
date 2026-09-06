ALTER TABLE public.user_incomes ADD COLUMN IF NOT EXISTS include_in_proportional_split BOOLEAN DEFAULT TRUE;
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS custom_split JSONB DEFAULT '{}'::jsonb;
