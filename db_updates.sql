-- SQL to add new settings to household_settings
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS show_swish_summary BOOLEAN DEFAULT TRUE;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS show_transfer_summary BOOLEAN DEFAULT TRUE;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS enable_management_buttons BOOLEAN DEFAULT TRUE;
ALTER TABLE household_settings ADD COLUMN IF NOT EXISTS show_private_top_total BOOLEAN DEFAULT TRUE;
