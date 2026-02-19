-- Adicionar coluna professor_id na tabela lista_vip_assessoria
ALTER TABLE lista_vip_assessoria
ADD COLUMN IF NOT EXISTS professor_id uuid REFERENCES professors(id);

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_lista_vip_professor_id ON lista_vip_assessoria(professor_id);

-- Adicionar comentário
COMMENT ON COLUMN lista_vip_assessoria.professor_id IS 'Professor vinculado ao cliente da lista VIP';
