
-- Alterar coluna telefone de numeric para VARCHAR
ALTER TABLE checkins
  ALTER COLUMN telefone TYPE VARCHAR(20);

-- Alterar coluna nome para VARCHAR se necessário
ALTER TABLE checkins
  ALTER COLUMN nome TYPE VARCHAR(255);
;
