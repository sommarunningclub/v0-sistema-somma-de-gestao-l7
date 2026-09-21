-- ─────────────────────────────────────────────────────────────────────────────
-- 023 — View `campanha_desafio_esteiras_2409_base`: a base geral menos quem já
-- fez check in no Desafio das Esteiras de 24/09/2026 (Evolve Águas Claras 2).
-- Base `desafio_esteiras_2409` do módulo de E-mail Marketing.
--
-- A régua do evento tem nove envios em quatro dias e uma regra: quem converteu
-- sai da sequência. Como a audiência é resolvida na hora do disparo
-- (`prepareCampaign`), basta a view ler `checkins` ao vivo: o check in feito às
-- 15h já tira a pessoa do e-mail das 19h, sem ninguém editar campanha nenhuma.
--
-- Parte de `campanha_base_geral` (sql/022), então herda a retirada de quem
-- está em `descadastros_globais`. Também não deduplica: o dedupe por e-mail é
-- do disparo (`dedupeRecipients`).
--
-- O evento é fixado pelo id, não pelo título: o título pode ser editado no
-- painel de eventos e a régua não pode voltar a escrever para quem converteu
-- por causa disso.
--
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.campanha_desafio_esteiras_2409_base
with (security_invoker = true)
as
select b.email, b.nome, b.segmento
from public.campanha_base_geral b
where not exists (
  select 1
  from public.checkins c
  where c.evento_id = 'dc3fa9f8-e347-4c30-81bd-faa392a4e4c0'::uuid
    and lower(btrim(c.email)) = lower(btrim(b.email))
);

comment on view public.campanha_desafio_esteiras_2409_base is
  'campanha_base_geral menos quem já fez check in no Desafio das Esteiras de 24/09/2026. Consumida pelo E-mail Marketing do admin (AUDIENCE_SOURCES.desafio_esteiras_2409).';

revoke all on public.campanha_desafio_esteiras_2409_base from anon, authenticated;
grant select on public.campanha_desafio_esteiras_2409_base to service_role;
