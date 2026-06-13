-- Lägger till fast_avgift på lån
ALTER TABLE public.bills ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC DEFAULT 0;
ALTER TABLE public.private_bills ADD COLUMN IF NOT EXISTS fixed_fee NUMERIC DEFAULT 0;

-- Lägger till detaljerad lånespårning i månadernas uträkningar (Gemensamt)
ALTER TABLE public.month_bill_amounts ADD COLUMN IF NOT EXISTS amortization NUMERIC DEFAULT 0;
ALTER TABLE public.month_bill_amounts ADD COLUMN IF NOT EXISTS interest NUMERIC DEFAULT 0;
ALTER TABLE public.month_bill_amounts ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;

-- Lägger till detaljerad lånespårning i månadernas uträkningar (Privat)
ALTER TABLE public.private_month_amounts ADD COLUMN IF NOT EXISTS amortization NUMERIC DEFAULT 0;
ALTER TABLE public.private_month_amounts ADD COLUMN IF NOT EXISTS interest NUMERIC DEFAULT 0;
ALTER TABLE public.private_month_amounts ADD COLUMN IF NOT EXISTS fee NUMERIC DEFAULT 0;
