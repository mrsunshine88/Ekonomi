-- 1. Skapa ENUMs
CREATE TYPE public.learning_category_enum AS ENUM ('BILL', 'FIXED_INCOME', 'VARIABLE_INCOME');
CREATE TYPE public.learning_source_enum AS ENUM ('ONBOARDING', 'BANK_IMPORT', 'MANUAL_ENTRY');
CREATE TYPE public.transaction_direction_enum AS ENUM ('IN', 'OUT');

-- 2. Skapa tabellen global_learning_votes
CREATE TABLE IF NOT EXISTS public.global_learning_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    normalized_name TEXT NOT NULL,
    transaction_direction public.transaction_direction_enum NOT NULL,
    category public.learning_category_enum NOT NULL,
    source public.learning_source_enum NOT NULL,
    normalization_version INTEGER NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT true,
    first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT global_learning_votes_unique_vote UNIQUE (household_id, normalized_name, transaction_direction, category)
);

-- 3. Skapa index för snabbare uppslag och aggregering
CREATE INDEX IF NOT EXISTS idx_glv_name ON public.global_learning_votes(normalized_name);
CREATE INDEX IF NOT EXISTS idx_glv_active ON public.global_learning_votes(is_active);

-- 4. Enable RLS (Row Level Security)
ALTER TABLE public.global_learning_votes ENABLE ROW LEVEL SECURITY;

-- 5. Policies för tabellen
-- Användare kan läsa och skriva sina egna hushålls röster
CREATE POLICY "Users can insert their own learning votes"
ON public.global_learning_votes
FOR INSERT
TO authenticated
WITH CHECK (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can update their own learning votes"
ON public.global_learning_votes
FOR UPDATE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Users can select their own learning votes"
ON public.global_learning_votes
FOR SELECT
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

CREATE POLICY "Admins can select all learning votes"
ON public.global_learning_votes
FOR SELECT
TO authenticated
USING (
    public.is_user_admin() = true
);

-- 6. Skapa View för Konsensusmotorn
-- OBS: Vyn kräver inte RLS eftersom adminpanelen byggs separat med applikationslogik
CREATE OR REPLACE VIEW public.global_learning_candidates_view AS
SELECT 
    normalized_name,
    transaction_direction,
    category,
    COUNT(DISTINCT household_id) as household_count,
    MIN(first_seen_at) as first_discovered_at
FROM public.global_learning_votes
WHERE is_active = true
GROUP BY normalized_name, transaction_direction, category
HAVING COUNT(DISTINCT household_id) >= 1;

-- 7. RPC för att låta admins godkänna regler (förbi RLS insert-begränsningen)
CREATE OR REPLACE FUNCTION public.admin_approve_system_rule(
    p_normalized_name TEXT,
    p_transaction_direction TEXT,
    p_category TEXT,
    p_household_count INTEGER
) RETURNS void AS $$
BEGIN
    -- Dubbelkolla admin-status
    IF NOT public.is_user_admin() THEN
        RAISE EXCEPTION 'Access denied';
    END IF;

    -- Skapa SYSTEM-regel
    INSERT INTO public.household_import_rules (
        household_id, 
        search_string, 
        target_id, 
        rule_target_type, 
        is_bill, 
        rule_type, 
        usage_count, 
        matched_examples
    )
    VALUES (
        null, 
        p_normalized_name, 
        null, 
        'SYSTEM', 
        (p_category = 'BILL'), 
        'SYSTEM', 
        p_household_count, 
        '[]'::jsonb
    );

    -- Avaktivera rösterna så den försvinner från kandidat-listan
    UPDATE public.global_learning_votes
    SET is_active = false
    WHERE normalized_name = p_normalized_name
      AND transaction_direction::TEXT = p_transaction_direction
      AND category::TEXT = p_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
