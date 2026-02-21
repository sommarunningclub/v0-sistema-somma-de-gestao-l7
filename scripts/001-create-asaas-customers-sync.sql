-- =====================================================
-- Tabela para sincronização de clientes Asaas
-- =====================================================

CREATE TABLE IF NOT EXISTS asaas_customers_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asaas_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  cpf_cnpj VARCHAR(20),
  mobile_phone VARCHAR(20),
  phone VARCHAR(20),
  postal_code VARCHAR(10),
  address TEXT,
  address_number VARCHAR(10),
  complement TEXT,
  province VARCHAR(100),
  city VARCHAR(100),
  state VARCHAR(2),
  status VARCHAR(50),
  -- Campos para rastreamento de atualização
  additional_emails TEXT[], -- JSON array de emails adicionais
  person_type VARCHAR(50), -- 'FISICA' ou 'JURIDICA'
  deleted BOOLEAN DEFAULT FALSE,
  last_synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Timestamps
  asaas_created_at TIMESTAMP WITH TIME ZONE,
  asaas_updated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_status VARCHAR(50) DEFAULT 'active', -- 'active', 'deleted', 'inactive'
  sync_error TEXT
);

-- Index para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_asaas_customers_asaas_id ON asaas_customers_sync(asaas_id);
CREATE INDEX IF NOT EXISTS idx_asaas_customers_email ON asaas_customers_sync(email);
CREATE INDEX IF NOT EXISTS idx_asaas_customers_cpf_cnpj ON asaas_customers_sync(cpf_cnpj);
CREATE INDEX IF NOT EXISTS idx_asaas_customers_status ON asaas_customers_sync(status);
CREATE INDEX IF NOT EXISTS idx_asaas_customers_created_at ON asaas_customers_sync(created_at);
CREATE INDEX IF NOT EXISTS idx_asaas_customers_sync_status ON asaas_customers_sync(sync_status);

-- Enable RLS (Row Level Security)
ALTER TABLE asaas_customers_sync ENABLE ROW LEVEL SECURITY;

-- Política para leitura (SELECT) - apenas usuários autenticados
CREATE POLICY "asaas_customers_select_auth" ON asaas_customers_sync
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Política para inserção (INSERT) - apenas usuários autenticados
CREATE POLICY "asaas_customers_insert_auth" ON asaas_customers_sync
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Política para atualização (UPDATE) - apenas usuários autenticados
CREATE POLICY "asaas_customers_update_auth" ON asaas_customers_sync
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Política para exclusão (DELETE) - apenas usuários autenticados
CREATE POLICY "asaas_customers_delete_auth" ON asaas_customers_sync
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Tabela de log de sincronização
CREATE TABLE IF NOT EXISTS asaas_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type VARCHAR(50), -- 'manual' ou 'automatic'
  total_customers INT,
  synced_customers INT,
  failed_customers INT,
  error_message TEXT,
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(50) -- 'pending', 'completed', 'failed'
);

-- Index para log
CREATE INDEX IF NOT EXISTS idx_asaas_sync_logs_started_at ON asaas_sync_logs(started_at);
CREATE INDEX IF NOT EXISTS idx_asaas_sync_logs_status ON asaas_sync_logs(status);
