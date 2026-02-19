-- Create partners table
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cnpj VARCHAR(14) NOT NULL UNIQUE,
  company_name VARCHAR(255) NOT NULL,
  company_legal_name VARCHAR(255),
  company_email VARCHAR(255),
  company_phone VARCHAR(20),
  company_address TEXT,
  company_city VARCHAR(100),
  company_state VARCHAR(2),
  responsible_name VARCHAR(255) NOT NULL,
  responsible_cpf VARCHAR(11) NOT NULL,
  responsible_email VARCHAR(255) NOT NULL,
  responsible_phone VARCHAR(20) NOT NULL,
  status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create index on CNPJ for faster lookups
CREATE INDEX IF NOT EXISTS idx_partners_cnpj ON partners(cnpj);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

-- Create index on responsible email for filtering
CREATE INDEX IF NOT EXISTS idx_partners_responsible_email ON partners(responsible_email);

-- Enable Row Level Security
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Create RLS policy to allow authenticated users to view all partners
CREATE POLICY "Authenticated users can view all partners" 
  ON partners 
  FOR SELECT 
  USING (auth.role() = 'authenticated_user');

-- Create RLS policy to allow authenticated users to insert partners
CREATE POLICY "Authenticated users can insert partners" 
  ON partners 
  FOR INSERT 
  WITH CHECK (auth.role() = 'authenticated_user');

-- Create RLS policy to allow authenticated users to update partners
CREATE POLICY "Authenticated users can update partners" 
  ON partners 
  FOR UPDATE 
  USING (auth.role() = 'authenticated_user')
  WITH CHECK (auth.role() = 'authenticated_user');

-- Create RLS policy to allow authenticated users to delete partners
CREATE POLICY "Authenticated users can delete partners" 
  ON partners 
  FOR DELETE 
  USING (auth.role() = 'authenticated_user');

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_partners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS partners_updated_at_trigger ON partners;
CREATE TRIGGER partners_updated_at_trigger
  BEFORE UPDATE ON partners
  FOR EACH ROW
  EXECUTE FUNCTION update_partners_updated_at();
