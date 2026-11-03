-- Login em duas etapas do painel (Google Authenticator)
-- =====================================================
--
-- Toda conta de `public.users` passa a precisar de um código TOTP depois da
-- senha. Esta tabela guarda, por usuário, o segredo do app autenticador:
--
--   secret_enc      segredo base32 CIFRADO (AES-256-GCM, chave
--                   MFA_ENCRYPTION_KEY no servidor). Nunca em claro.
--   enabled_at      null = cadastro iniciado, ainda não confirmado com um
--                   código. Preenchido = a conta já usa o autenticador.
--   last_used_step  passo de 30 s do último código aceito. Código de passo
--                   igual ou anterior é recusado: um código não vale duas vezes.
--
-- Sem linha (ou com enabled_at nulo), o próximo login pede o cadastro do
-- autenticador antes de liberar a sessão. Apagar a linha é o "redefinir 2FA"
-- do painel de administração: a pessoa cadastra de novo no próximo acesso.

create table if not exists public.user_totp (
  user_id        uuid primary key references public.users(id) on delete cascade,
  secret_enc     text not null,
  enabled_at     timestamptz,
  last_used_step bigint,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.user_totp is
  'Segredo do Google Authenticator por usuário do painel (cifrado). Sem linha confirmada, o login pede o cadastro.';

-- Só service_role: a tabela guarda o que autentica alguém. `force` para que
-- nem o dono da tabela escape da policy.
alter table public.user_totp enable row level security;
alter table public.user_totp force row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_totp'
  loop
    execute format('drop policy %I on public.user_totp;', pol.policyname);
  end loop;
end $$;

create policy "Service role full access user_totp"
  on public.user_totp
  for all to service_role using (true) with check (true);

revoke all on public.user_totp from anon, authenticated;
