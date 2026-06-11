-- Lägg till tos_accepted kolumn till profiles tabellen
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS tos_accepted BOOLEAN DEFAULT false;

-- Eftersom profile är kopplat till auth.users kan det vara bra att säkerställa 
-- att framtida profiler skapas med tos_accepted = false (vilket DEFAULT löser).
