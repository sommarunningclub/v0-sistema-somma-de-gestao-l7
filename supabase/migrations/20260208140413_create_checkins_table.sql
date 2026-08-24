-- Create checkins table
CREATE TABLE IF NOT EXISTS public.checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  cpf TEXT,
  event TEXT NOT NULL,
  event_date TEXT,
  event_time TEXT,
  qr_code TEXT UNIQUE NOT NULL,
  validated BOOLEAN DEFAULT false,
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on qr_code for faster lookups
CREATE INDEX IF NOT EXISTS idx_checkins_qr_code ON public.checkins(qr_code);

-- Enable Row Level Security
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Create policy to allow public inserts (for check-in)
CREATE POLICY "Allow public check-in" ON public.checkins
  FOR INSERT WITH CHECK (true);

-- Create policy to allow public reads (for validation)
CREATE POLICY "Allow public validation read" ON public.checkins
  FOR SELECT USING (true);

-- Create policy to allow public updates (for marking as validated)
CREATE POLICY "Allow public validation update" ON public.checkins
  FOR UPDATE USING (true);;
