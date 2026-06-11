ALTER TABLE household_settings 
ADD COLUMN IF NOT EXISTS show_top_total BOOLEAN DEFAULT false;
