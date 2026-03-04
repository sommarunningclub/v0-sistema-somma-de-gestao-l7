-- Add DELETE policy to checkins table for admin use
CREATE POLICY "Allow admin delete check-in"
  ON public.checkins
  FOR DELETE
  USING (true);
