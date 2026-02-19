-- Tabela de configuração de comissões
CREATE TABLE IF NOT EXISTS commission_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  somma_fixed_fee DECIMAL(10,2) NOT NULL DEFAULT 50.00,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT
);

-- Inserir configuração padrão
INSERT INTO commission_config (somma_fixed_fee) 
VALUES (50.00)
ON CONFLICT DO NOTHING;

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_commission_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER commission_config_updated_at
  BEFORE UPDATE ON commission_config
  FOR EACH ROW
  EXECUTE FUNCTION update_commission_config_updated_at();
