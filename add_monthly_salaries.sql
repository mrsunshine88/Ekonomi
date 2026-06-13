-- Skapa tabell för den nya Lön-strukturen (Månadslön via datum)
CREATE TABLE IF NOT EXISTS public.user_monthly_salaries (
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    pay_date TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id, pay_date)
);

-- RLS (Row Level Security) för user_monthly_salaries
ALTER TABLE public.user_monthly_salaries ENABLE ROW LEVEL SECURITY;

-- Man får läsa alla löner inom sitt hushåll
CREATE POLICY "Users can view monthly salaries" 
ON public.user_monthly_salaries 
FOR SELECT 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));

-- Man får lägga till sin egen lön
CREATE POLICY "Users can insert monthly salaries" 
ON public.user_monthly_salaries 
FOR INSERT 
WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

-- Man får uppdatera sin egen lön
CREATE POLICY "Users can update monthly salaries" 
ON public.user_monthly_salaries 
FOR UPDATE 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

-- Man får radera sin egen lön
CREATE POLICY "Users can delete monthly salaries" 
ON public.user_monthly_salaries 
FOR DELETE 
USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());
