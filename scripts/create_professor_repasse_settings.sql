-- Criação da tabela de configuração de repasse de professores
CREATE TABLE IF NOT EXISTS professor_repasse_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id UUID NOT NULL REFERENCES professors(id) ON DELETE CASCADE,
  enable_repasse BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(professor_id)
);

-- Adicionar comentários
COMMENT ON TABLE professor_repasse_settings IS 'Controla se Somma cobra taxa de comissão do professor (quando false, professor recebe repasse)';
COMMENT ON COLUMN professor_repasse_settings.enable_repasse IS 'true = Somma cobra taxa | false = Professor recebe repasse';
