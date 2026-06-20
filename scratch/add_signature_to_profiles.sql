-- ============================================================
-- SQL SCRIPT: Lägg till för- och efternamn på profiler
-- ============================================================

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;
