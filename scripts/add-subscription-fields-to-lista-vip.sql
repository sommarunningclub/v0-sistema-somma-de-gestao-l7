-- Adicionar campos para controlar status de assinatura na lista VIP
ALTER TABLE lista_vip_assessoria
ADD COLUMN IF NOT EXISTS has_subscribed BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plan_type VARCHAR(50),
ADD COLUMN IF NOT EXISTS subscription_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Criar índice para melhorar performance de queries
CREATE INDEX IF NOT EXISTS idx_lista_vip_has_subscribed ON lista_vip_assessoria(has_subscribed);
CREATE INDEX IF NOT EXISTS idx_lista_vip_plan_type ON lista_vip_assessoria(plan_type);

-- Comentários para documentação
COMMENT ON COLUMN lista_vip_assessoria.has_subscribed IS 'Indica se a pessoa da lista VIP já assinou';
COMMENT ON COLUMN lista_vip_assessoria.plan_type IS 'Tipo de plano: Mensal, Semestral ou Anual';
COMMENT ON COLUMN lista_vip_assessoria.subscription_date IS 'Data em que a pessoa assinou';
COMMENT ON COLUMN lista_vip_assessoria.notes IS 'Observações adicionais sobre a conversão';
