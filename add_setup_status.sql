-- Lägg till setup_status kolumn till profiles tabellen för att driva PLG-onboarding flödet
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS setup_status TEXT DEFAULT 'new_user';

-- Sätt befintliga användare med hushåll till 'subscriber' för bakåtkompatibilitet
UPDATE profiles
SET setup_status = 'subscriber'
WHERE household_id IS NOT NULL AND setup_status = 'new_user';
