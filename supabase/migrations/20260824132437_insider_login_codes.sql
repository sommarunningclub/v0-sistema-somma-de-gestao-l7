-- Códigos de login por e-mail do Insider.
--
-- O insider pede um código em /api/insiders/codigo, recebe 6 dígitos no
-- e-mail cadastrado e digita em /api/insiders/entrar-codigo. Convive com a
-- senha: quem já tem senha continua entrando por ela, e este caminho também
-- serve de recuperação, que antes não existia.
--
-- O código NUNCA é guardado em texto: só o hash bcrypt. Com 6 dígitos o
-- espaço é de 1 milhão, então a proteção real vem da combinação de validade
-- curta (10 min), teto de tentativas (5) e uso único — o bcrypt é o que
-- impede varrer esse espaço offline caso a tabela vaze.

create table if not exists public.insider_login_codes (
  id           uuid primary key default gen_random_uuid(),
  insider_id   uuid not null,
  codigo_hash  text not null,
  expira_em    timestamptz not null,
  tentativas   smallint not null default 0,
  consumido_em timestamptz,
  criado_em    timestamptz not null default now()
);

-- Busca do código vigente de um insider.
create index if not exists insider_login_codes_insider_idx
  on public.insider_login_codes (insider_id, criado_em desc);

-- Faxina dos expirados (a rota apaga oportunisticamente).
create index if not exists insider_login_codes_expira_idx
  on public.insider_login_codes (expira_em);

-- Só service_role: a tabela guarda o material que autentica alguém. `force`
-- para que nem o dono escape da policy.
alter table public.insider_login_codes enable row level security;
alter table public.insider_login_codes force row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'insider_login_codes'
  loop
    execute format('drop policy %I on public.insider_login_codes;', pol.policyname);
  end loop;
end $$;

create policy "Service role full access insider_login_codes"
  on public.insider_login_codes
  for all to service_role using (true) with check (true);

revoke all on public.insider_login_codes from anon, authenticated;
