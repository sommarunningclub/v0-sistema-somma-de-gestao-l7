-- ─────────────────────────────────────────────────────────────────────────────
-- 022 — View `campanha_base_geral`: cadastro_site + checkins, sem quem
-- descadastrou pelo site. Base `base_geral` do módulo de E-mail Marketing.
--
-- As bases `membros` e `checkins` leem as tabelas cruas. A supressão deste
-- módulo (`email_suppressions`) e o descadastro dos e-mails do site
-- (`descadastros_globais`) são listas diferentes, e nenhuma conhece a outra:
-- mandar para "a base toda" pelas duas bases cruas reenviaria para quem pediu
-- para sair pelo rodapé de um e-mail do site. Isso é LGPD, não preferência.
--
-- A view não deduplica: `checkins` tem uma linha por participação, e o dedupe
-- por e-mail já é feito no disparo (`dedupeRecipients`). Ela só une as duas
-- fontes e tira os descadastrados.
--
-- Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace view public.campanha_base_geral
-- Roda com os privilégios de quem consulta: a RLS das tabelas de origem
-- continua valendo, e só o service_role do admin lê tudo.
with (security_invoker = true)
as
select b.email, b.nome, b.segmento
from (
  select s.email, s.nome_completo as nome, 'cadastro-site'::text as segmento
  from public.cadastro_site s
  union all
  select c.email, c.nome_completo as nome, 'checkins'::text as segmento
  from public.checkins c
) b
where b.email is not null
  and btrim(b.email) <> ''
  and not exists (
    select 1
    from public.descadastros_globais d
    where lower(d.email) = lower(btrim(b.email))
  );

comment on view public.campanha_base_geral is
  'cadastro_site + checkins sem quem descadastrou pelo site. Consumida pelo E-mail Marketing do admin (AUDIENCE_SOURCES.base_geral).';

revoke all on public.campanha_base_geral from anon, authenticated;
grant select on public.campanha_base_geral to service_role;
