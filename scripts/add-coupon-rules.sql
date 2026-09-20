-- Regras de cupom que hoje só existem no código do site
-- =======================================================
--
-- O checkout da assessoria (NOVO-SITE-SOMMA-V3, lib/checkout/cupons.ts) resolve
-- o cupom em duas camadas: primeiro a tabela `coupons` daqui, depois uma lista
-- hardcoded no próprio site. Só a lista hardcoded sabe restringir um cupom a um
-- professor, a um tipo de plano ou à primeira mensalidade — a tabela não tem
-- essas colunas.
--
-- Sem elas, migrar os cupons para o painel ALARGARIA descontos em silêncio:
-- JO150 (hoje só com Joseph) passaria a valer com qualquer professor, e ANALU
-- (20% na 1ª mensalidade do mensal) viraria 20% em todas as mensalidades de
-- todos os planos. Estas três colunas fecham esse buraco.
--
-- Rodar ANTES de publicar o site com a leitura das novas colunas e ANTES do
-- seed (scripts/seed-coupons-legados.sql). É aditivo: todas as colunas são
-- opcionais e nenhum cupom existente muda de comportamento.

alter table coupons add column if not exists professor        varchar(120);
alter table coupons add column if not exists plan_type        varchar(20);
alter table coupons add column if not exists first_month_only boolean not null default false;

comment on column coupons.professor is
  'Restringe o cupom a um professor (nome canônico: Alexandre Alves, Joseph Pereira, Mateus Fonseca). NULL = vale para todos.';
comment on column coupons.plan_type is
  'Restringe ao tipo de plano: recurring (mensal) ou installment (semestral/anual). NULL = vale para os dois.';
comment on column coupons.first_month_only is
  'Só em plano recorrente: o desconto vale na 1ª mensalidade e o valor volta ao cheio a partir do 2º ciclo.';

-- Só os dois valores que o checkout conhece; qualquer outro é um cupom que
-- nunca casaria e ninguém descobriria até o cliente reclamar do preço.
alter table coupons drop constraint if exists coupons_plan_type_check;
alter table coupons add constraint coupons_plan_type_check
  check (plan_type is null or plan_type in ('recurring', 'installment'));

-- O código é a chave pela qual o checkout procura (`.eq('code', ...).single()`):
-- dois cupons com o mesmo código fariam a consulta falhar e o cliente veria
-- "cupom não encontrado" para um cupom que existe.
create unique index if not exists coupons_code_unique on coupons (upper(code));

-- Contagem de uso
-- ---------------
-- `usage_limit` sempre existiu na tabela, mas `usage_count` nunca era
-- incrementado por ninguém — um cupom "limitado a 50 usos" era aceito para
-- sempre. O incremento tem que ser atômico (dois checkouts simultâneos lendo
-- o mesmo valor contariam um uso só), e PostgREST não faz aritmética em UPDATE,
-- então precisa ser função.
create or replace function increment_coupon_usage(coupon_code text)
returns integer
language sql
security definer
set search_path = public
as $$
  update coupons
     set usage_count = coalesce(usage_count, 0) + 1,
         updated_at  = now()
   where upper(code) = upper(coupon_code)
  returning usage_count;
$$;

comment on function increment_coupon_usage(text) is
  'Soma 1 ao uso do cupom e devolve o novo total. Chamada pelo checkout do site quando a cobrança é criada com sucesso.';
