-- Skapa tabell för Fast Lön
CREATE TABLE IF NOT EXISTS public.user_salaries (
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id)
);

-- Skapa tabell för Rörlig Lön (per månad)
CREATE TABLE IF NOT EXISTS public.user_variable_salaries (
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    month_id TEXT NOT NULL,
    amount NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (household_id, user_id, month_id)
);

-- RLS (Row Level Security) för user_salaries
ALTER TABLE public.user_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view salaries in their household" ON public.user_salaries FOR SELECT USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert salaries" ON public.user_salaries FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Users can update salaries" ON public.user_salaries FOR UPDATE USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());

-- RLS för user_variable_salaries
ALTER TABLE public.user_variable_salaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view variable salaries" ON public.user_variable_salaries FOR SELECT USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Users can insert variable salaries" ON public.user_variable_salaries FOR INSERT WITH CHECK (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());
CREATE POLICY "Users can update variable salaries" ON public.user_variable_salaries FOR UPDATE USING (household_id IN (SELECT household_id FROM public.profiles WHERE id = auth.uid()) AND user_id = auth.uid());
