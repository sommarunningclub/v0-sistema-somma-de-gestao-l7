-- Arquivamento de campanhas de e-mail
-- ===================================
--
-- A listagem do modulo mostra todas as campanhas, sempre. Depois de meses de
-- disparo, as enviadas soterram as que ainda estao em producao — as etapas de
-- um evento que vai acontecer ficam misturadas com campanhas de meses atras.
--
-- Arquivar nao e um status: a campanha enviada continua `enviada`, com metricas
-- e destinatarios intactos. `archived_at` e uma dimensao separada, para que o
-- filtro por status continue significando o que sempre significou. E por isso
-- tambem que arquivar e reversivel — nada e apagado.

alter table email_campaigns add column if not exists archived_at timestamptz;

comment on column email_campaigns.archived_at is
  'Quando a campanha foi tirada da listagem padrao. NULL = ativa. Nao altera status, metricas nem destinatarios.';

-- A listagem padrao e sempre "nao arquivadas, mais recentes primeiro"; o indice
-- parcial cobre exatamente essa consulta e ignora o arquivo, que so e lido
-- quando alguem pede.
create index if not exists email_campaigns_ativas_idx
  on email_campaigns (created_at desc)
  where archived_at is null;
