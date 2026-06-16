-- SQL Script for creating household_import_rules

CREATE TABLE IF NOT EXISTS public.household_import_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID REFERENCES public.households(id) ON DELETE CASCADE,
    search_string TEXT NOT NULL,
    target_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    is_bill BOOLEAN NOT NULL DEFAULT false,
    rule_type TEXT NOT NULL CHECK (rule_type IN ('SYSTEM', 'USER')),
    usage_count INTEGER NOT NULL DEFAULT 1,
    matched_examples JSONB NOT NULL DEFAULT '[]'::jsonb,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by household
CREATE INDEX IF NOT EXISTS idx_household_import_rules_household_id ON public.household_import_rules(household_id);

-- Enable RLS
ALTER TABLE public.household_import_rules ENABLE ROW LEVEL SECURITY;

-- Policies
-- Read: Users can read SYSTEM rules, and rules belonging to their household
CREATE POLICY "Users can read SYSTEM rules and own household rules"
ON public.household_import_rules
FOR SELECT
TO authenticated
USING (
    rule_type = 'SYSTEM' OR 
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Insert: Users can insert rules for their household
CREATE POLICY "Users can insert rules for their household"
ON public.household_import_rules
FOR INSERT
TO authenticated
WITH CHECK (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Update: Users can update rules for their household
CREATE POLICY "Users can update rules for their household"
ON public.household_import_rules
FOR UPDATE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- Delete: Users can delete rules for their household
CREATE POLICY "Users can delete rules for their household"
ON public.household_import_rules
FOR DELETE
TO authenticated
USING (
    household_id IN (
        SELECT household_id FROM public.household_members WHERE user_id = auth.uid()
    )
);

-- Insert some default SYSTEM rules for testing
INSERT INTO public.household_import_rules (search_string, is_bill, rule_type, usage_count, matched_examples)
VALUES 
('SPOTIFY', true, 'SYSTEM', 0, '["SPOTIFY AB"]'::jsonb),
('NETFLIX', true, 'SYSTEM', 0, '["NETFLIX.COM"]'::jsonb),
('TELIA', true, 'SYSTEM', 0, '["TELIA SVERIGE AB", "TELIA AUTOGIRO"]'::jsonb),
('FOLKSAM', true, 'SYSTEM', 0, '["FOLKSAM ÖMSESIDIG SAK", "FOLKSAM LIV"]'::jsonb),
('CSN', true, 'SYSTEM', 0, '["CSN"]'::jsonb),
('KLARNA', true, 'SYSTEM', 0, '["KLARNA BANK AB"]'::jsonb),
('TRYGG HANSA', true, 'SYSTEM', 0, '["TRYGG HANSA"]'::jsonb)
ON CONFLICT DO NOTHING; -- Assuming no unique constraint, but we shouldn't run this multiple times anyway.
