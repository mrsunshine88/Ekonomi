-- Skapa ny tabell för alla inkomster (fasta och rörliga)
CREATE TABLE IF NOT EXISTS public.user_incomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    type TEXT NOT NULL CHECK (type IN ('fixed', 'variable')),
    pay_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS (Row Level Security) för user_incomes
ALTER TABLE public.user_incomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view incomes" 
ON public.user_incomes FOR SELECT 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Users can insert incomes" 
ON public.user_incomes FOR INSERT 
WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update incomes" 
ON public.user_incomes FOR UPDATE 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can delete incomes" 
ON public.user_incomes FOR DELETE 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

-- Datamigrering från den gamla tabellen user_monthly_salaries till den nya user_incomes
INSERT INTO public.user_incomes (household_id, user_id, name, amount, type, pay_date)
SELECT household_id, user_id, 'Lön', amount, 'variable', pay_date::DATE 
FROM public.user_monthly_salaries
ON CONFLICT DO NOTHING;
