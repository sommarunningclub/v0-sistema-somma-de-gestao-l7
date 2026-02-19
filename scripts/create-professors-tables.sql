-- Tabela de Professores/Treinadores
CREATE TABLE IF NOT EXISTS professors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(20),
  specialty VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  client_type VARCHAR(50) DEFAULT 'cliente_somma' CHECK (client_type IN ('cliente_somma', 'cliente_professor')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de Vinculações Professor-Cliente
CREATE TABLE IF NOT EXISTS professor_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  asaas_customer_id VARCHAR(100) NOT NULL,
  customer_name VARCHAR(255) NOT NULL,
  customer_email VARCHAR(255),
  customer_cpf_cnpj VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  linked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  unlinked_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(professor_id, asaas_customer_id)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_professors_status ON professors(status);
CREATE INDEX IF NOT EXISTS idx_professors_email ON professors(email);
CREATE INDEX IF NOT EXISTS idx_professor_clients_professor_id ON professor_clients(professor_id);
CREATE INDEX IF NOT EXISTS idx_professor_clients_asaas_customer_id ON professor_clients(asaas_customer_id);
CREATE INDEX IF NOT EXISTS idx_professor_clients_status ON professor_clients(status);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at em professors
DROP TRIGGER IF EXISTS update_professors_updated_at ON professors;
CREATE TRIGGER update_professors_updated_at
  BEFORE UPDATE ON professors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comentários nas tabelas
COMMENT ON TABLE professors IS 'Tabela de professores/treinadores da assessoria de corrida';
COMMENT ON TABLE professor_clients IS 'Vinculação entre professores e clientes do Asaas';
COMMENT ON COLUMN professors.client_type IS 'Tipo de cliente: cliente_somma ou cliente_professor';
COMMENT ON COLUMN professor_clients.asaas_customer_id IS 'ID do cliente no sistema Asaas';
