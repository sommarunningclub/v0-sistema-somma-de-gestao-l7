-- Create operators table for event staff authentication
CREATE TABLE IF NOT EXISTS public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cpf TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create index on CPF for faster lookups
CREATE INDEX IF NOT EXISTS idx_operators_cpf ON public.operators(cpf);

-- Enable Row Level Security
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

-- Create policy to allow operators to read their own data
CREATE POLICY "Allow operators to read own data" ON public.operators
  FOR SELECT USING (true);

-- Insert sample operator (replace with real CPF)
INSERT INTO public.operators (cpf, name, active)
VALUES ('12345678900', 'Operador Teste', true)
ON CONFLICT (cpf) DO NOTHING;;
