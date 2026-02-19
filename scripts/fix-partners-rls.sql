-- Fix RLS policies for partners table
-- Allow all operations for authenticated users and service role

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for authenticated users" ON partners;
DROP POLICY IF EXISTS "Allow select for all" ON partners;
DROP POLICY IF EXISTS "Allow insert for all" ON partners;
DROP POLICY IF EXISTS "Allow update for all" ON partners;
DROP POLICY IF EXISTS "Allow delete for all" ON partners;

-- Create permissive policies for all operations
-- SELECT policy
CREATE POLICY "Allow select for all" ON partners
  FOR SELECT
  USING (true);

-- INSERT policy
CREATE POLICY "Allow insert for all" ON partners
  FOR INSERT
  WITH CHECK (true);

-- UPDATE policy  
CREATE POLICY "Allow update for all" ON partners
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- DELETE policy
CREATE POLICY "Allow delete for all" ON partners
  FOR DELETE
  USING (true);
