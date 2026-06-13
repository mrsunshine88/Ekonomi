-- Lägg till kolumnen för person_account_id i profiles-tabellen
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS person_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL;

-- Berätta för PostgREST att schemat har uppdaterats (frivilligt men bra i Supabase)
NOTIFY pgrst, 'reload schema';
