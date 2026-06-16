-- 1. Byt namn på target_account_id till target_id
ALTER TABLE public.household_import_rules 
RENAME COLUMN target_account_id TO target_id;

-- 2. Lägg till rule_target_type med 'ACCOUNT' som standardvärde
ALTER TABLE public.household_import_rules 
ADD COLUMN rule_target_type text NOT NULL DEFAULT 'ACCOUNT';

-- 3. Uppdatera eventuella befintliga inkomst-regler om det fanns några (för säkerhets skull)
UPDATE public.household_import_rules 
SET rule_target_type = 'USER' 
WHERE is_bill = false;
