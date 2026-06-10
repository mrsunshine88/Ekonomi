-- 1. Lägg till reminder_day i household_settings om det inte finns
ALTER TABLE public.household_settings 
ADD COLUMN IF NOT EXISTS reminder_day integer CHECK (reminder_day >= 1 AND reminder_day <= 31);

-- 2. Skapa tabell för push-prenumerationer
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);

-- RLS för push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Användaren får bara hantera sina egna prenumerationer
CREATE POLICY "Users can manage their own subscriptions" 
ON public.push_subscriptions 
FOR ALL 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Vi tillåter Edge Functions att läsa (service_role kringgår RLS oavsett, 
-- men det är bra praxis att dokumentera)
