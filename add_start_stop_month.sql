-- Lägg till end_month i bills
ALTER TABLE public.bills
ADD COLUMN end_month text;

-- Lägg till end_month i private_bills
ALTER TABLE public.private_bills
ADD COLUMN end_month text;
