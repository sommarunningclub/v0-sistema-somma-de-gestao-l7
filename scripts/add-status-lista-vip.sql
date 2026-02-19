-- Adicionar coluna de status na tabela lista_vip_assessoria
ALTER TABLE lista_vip_assessoria
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pendente';

-- Atualizar registros existentes para 'Pendente' se estiverem NULL
UPDATE lista_vip_assessoria
SET status = 'Pendente'
WHERE status IS NULL;

-- Adicionar coluna asaas_customer_id para vincular com clientes no Asaas
ALTER TABLE lista_vip_assessoria
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;

-- Criar índice para melhorar performance nas buscas
CREATE INDEX IF NOT EXISTS idx_lista_vip_status ON lista_vip_assessoria(status);
CREATE INDEX IF NOT EXISTS idx_lista_vip_asaas_customer ON lista_vip_assessoria(asaas_customer_id);
