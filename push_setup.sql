CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_email TEXT NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE admin_push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Admins kan läsa, lägga till och ta bort sina egna prenumerationer
CREATE POLICY "Admins can manage their push subscriptions"
ON admin_push_subscriptions
FOR ALL
TO authenticated
USING (is_user_admin() AND admin_email = LOWER(auth.jwt()->>'email'))
WITH CHECK (is_user_admin() AND admin_email = LOWER(auth.jwt()->>'email'));
