-- sql/009-insider-cadastro.sql
-- Página pública /insider: cadastro e atualização de Insiders.
-- Aditiva: não remove nem renomeia nada existente.

BEGIN;

-- 1. Novas colunas de cadastro em dados_insiders
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS email           text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS telefone        text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS data_nascimento date;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS sexo            text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS cep             text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS logradouro      text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS numero          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS complemento     text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS bairro          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS cidade          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS estado          text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS foto_url        text;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS consent_lgpd    boolean NOT NULL DEFAULT false;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS consent_imagem  boolean NOT NULL DEFAULT false;
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS criado_em       timestamptz NOT NULL DEFAULT now();
ALTER TABLE dados_insiders ADD COLUMN IF NOT EXISTS atualizado_em   timestamptz NOT NULL DEFAULT now();

-- 2. Colunas de benefício ganham DEFAULT '' para que INSERTs que não as
--    mencionam funcionem mesmo se forem NOT NULL. Não altera linhas existentes.
--    Defensivo: só aplica o DEFAULT em colunas que existem e são de tipo texto,
--    para que a migration inteira (dentro de BEGIN/COMMIT) não falhe se alguma
--    dessas colunas estiver ausente ou com outro tipo.
DO $$
DECLARE
  col text;
BEGIN
  FOREACH col IN ARRAY ARRAY[
    'evolve',
    'dopahmina',
    'tex_barbearia',
    'cupom_loja_somma',
    'big_box',
    'assessoria_somma',
    'estamina_recovery'
  ]
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'dados_insiders'
        AND column_name = col
        AND data_type IN ('text', 'character varying', 'character')
    ) THEN
      EXECUTE format('ALTER TABLE dados_insiders ALTER COLUMN %I SET DEFAULT %L', col, '');
    END IF;
  END LOOP;
END $$;

-- 3. Índice para busca por CPF (a API busca com e sem máscara)
CREATE INDEX IF NOT EXISTS idx_dados_insiders_cpf ON dados_insiders(cpf);

-- 4. Credenciais em tabela separada: dados_insiders é lida com a chave anon
--    no browser, então o hash não pode morar lá.
CREATE TABLE IF NOT EXISTS insider_credentials (
  insider_id    uuid PRIMARY KEY REFERENCES dados_insiders(id) ON DELETE CASCADE,
  senha_hash    text NOT NULL,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE insider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on insider_credentials" ON insider_credentials;
CREATE POLICY "Service role full access on insider_credentials"
ON insider_credentials FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- 5. Bucket de fotos de perfil (leitura pública, escrita só service_role)
INSERT INTO storage.buckets (id, name, public)
VALUES ('insider-fotos', 'insider-fotos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public read insider fotos" ON storage.objects;
CREATE POLICY "Public read insider fotos"
ON storage.objects FOR SELECT
USING (bucket_id = 'insider-fotos');

DROP POLICY IF EXISTS "Service role upload insider fotos" ON storage.objects;
CREATE POLICY "Service role upload insider fotos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role update insider fotos" ON storage.objects;
CREATE POLICY "Service role update insider fotos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');

DROP POLICY IF EXISTS "Service role delete insider fotos" ON storage.objects;
CREATE POLICY "Service role delete insider fotos"
ON storage.objects FOR DELETE
USING (bucket_id = 'insider-fotos' AND auth.role() = 'service_role');

COMMIT;
