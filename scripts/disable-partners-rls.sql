-- Disable RLS on partners table to allow public access
-- This allows the app to work without authenticated users

ALTER TABLE partners DISABLE ROW LEVEL SECURITY;

-- Drop existing policies since RLS is disabled
DROP POLICY IF EXISTS "Authenticated users can view all partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON partners;
