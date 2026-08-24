-- Create codigo_parceiro table for partner authentication
CREATE TABLE IF NOT EXISTS public.codigo_parceiro (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE NOT NULL,
  nome_parceiro TEXT NOT NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_access TIMESTAMP WITH TIME ZONE
);

-- Create index on codigo for faster lookups
CREATE INDEX IF NOT EXISTS idx_codigo_parceiro_codigo ON public.codigo_parceiro(codigo);

-- Enable Row Level Security
ALTER TABLE public.codigo_parceiro ENABLE ROW LEVEL SECURITY;

-- Create policy to allow reading active codes
CREATE POLICY "Allow reading active codes" ON public.codigo_parceiro
  FOR SELECT USING (ativo = true);

-- Insert sample partner code (replace with real code)
INSERT INTO public.codigo_parceiro (codigo, nome_parceiro, ativo)
VALUES ('SOMMA2026', 'Parceiro Oficial', true)
ON CONFLICT (codigo) DO NOTHING;;
