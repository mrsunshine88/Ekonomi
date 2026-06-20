-- 001_add_scale_indexes.sql
-- Förhindrar Sequential Scans vid tunga cron-jobb och edge functions
CREATE INDEX IF NOT EXISTS idx_household_settings_reminder ON household_settings(reminder_day);
CREATE INDEX IF NOT EXISTS idx_month_handled_payments_hh_month ON month_handled_payments(household_id, month_id);
CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON profiles(household_id);
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON push_subscriptions(user_id);
