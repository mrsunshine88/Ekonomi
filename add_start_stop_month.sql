-- Lägg till start_month och end_month i bills
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS start_month text,
ADD COLUMN IF NOT EXISTS end_month text;

-- Lägg till start_month och end_month i private_bills
ALTER TABLE public.private_bills
ADD COLUMN IF NOT EXISTS start_month text,
ADD COLUMN IF NOT EXISTS end_month text;
