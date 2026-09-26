-- Operadores da frente de caixa (SOMMA PDV Point)
-- ==============================================
--
-- Quem cobra no PDV entra com CPF + código de acesso, e é o painel Somma
-- (módulo PDV) que cadastra o CPF e gera o código. Por baixo, cada operador
-- continua sendo um usuário do Supabase Auth autorizado por `admin_roles` —
-- que é o que o PDV já checa em toda requisição (lib/auth.ts do
-- somma-pdv-point). O e-mail desse usuário é sintético, derivado do CPF
-- (`<11 dígitos>@pdv.sommaclub.com.br`), e a senha é o código gerado. Nada no
-- login do PDV precisou de uma segunda forma de sessão.
--
-- Esta tabela é o cadastro visível: liga o CPF ao usuário do Auth, guarda o
-- nome para a listagem e registra quando o código foi emitido. O código em si
-- NUNCA fica aqui — só o Auth conhece (como hash), e o painel o mostra uma
-- única vez, na hora em que gera.
--
-- Prefixo `pos_` porque o objeto pertence ao PDV, como as demais tabelas
-- criadas pelo somma-pdv-point (pos_sales, pos_settings, ...).

create table if not exists public.pos_operators (
  id             uuid primary key default gen_random_uuid(),
  -- 11 dígitos, sem máscara. Um CPF, um operador.
  cpf            text not null,
  name           text not null,
  -- Usuário do Supabase Auth que o PDV autentica. Apagar o usuário apaga o
  -- cadastro; o inverso é feito pela rota do painel.
  user_id        uuid not null references auth.users(id) on delete cascade,
  -- false = sem linha em admin_roles e usuário banido no Auth. O histórico de
  -- vendas (pos_sales.operator_user_id) fica intacto.
  active         boolean not null default true,
  -- Última emissão do código de acesso (criação ou "novo código").
  code_issued_at timestamptz not null default now(),
  -- E-mail de quem cadastrou no painel.
  created_by     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint pos_operators_cpf_digits check (cpf ~ '^[0-9]{11}$')
);

create unique index if not exists pos_operators_cpf_key on public.pos_operators (cpf);
create unique index if not exists pos_operators_user_id_key on public.pos_operators (user_id);
create index if not exists pos_operators_created_at_idx on public.pos_operators (created_at desc);

comment on table public.pos_operators is
  'Operadores da frente de caixa (SOMMA PDV Point). Cadastrados no painel Somma, módulo PDV; entram no PDV com CPF + código de acesso.';
comment on column public.pos_operators.cpf is 'CPF do operador, 11 dígitos sem máscara.';
comment on column public.pos_operators.user_id is 'Usuário do Supabase Auth (e-mail sintético <cpf>@pdv.sommaclub.com.br) autorizado via admin_roles.';
comment on column public.pos_operators.code_issued_at is 'Quando o código de acesso vigente foi gerado. O código não é guardado aqui.';

-- Só service_role: painel e PDV acessam com a chave de serviço. `force` para
-- que nem o dono da tabela escape da policy.
alter table public.pos_operators enable row level security;
alter table public.pos_operators force row level security;

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'pos_operators'
  loop
    execute format('drop policy %I on public.pos_operators;', pol.policyname);
  end loop;
end $$;

create policy "Service role full access pos_operators"
  on public.pos_operators
  for all to service_role using (true) with check (true);

revoke all on public.pos_operators from anon, authenticated;
