-- Quem usou cada cupom
-- ====================
--
-- `coupons.usage_count` diz quantas vezes um cupom foi usado, mas não quem
-- usou. A tabela `coupon_redemptions` já existia para isso (e tem um trigger
-- que soma 1 em `usage_count` a cada linha), só que ninguém gravava nela e ela
-- só guardava ids: `customer_id`/`payment_id` apontam para tabelas legadas que
-- o checkout do site nunca preencheu.
--
-- Esta migration faz a tabela guardar o que a tela precisa mostrar (nome,
-- e-mail, plano, professor, desconto) e cria `register_coupon_redemption`, que
-- o checkout chama quando a cobrança nasce no Asaas. O trigger continua sendo
-- quem incrementa `usage_count`; por isso o site deixa de chamar
-- `increment_coupon_usage` quando passa a gravar aqui — senão contaria em dobro.
--
-- `increment_coupon_usage` fica: o site em produção ainda chama até o deploy
-- que troca para a função nova.

alter table coupon_redemptions
  add column if not exists coupon_code          varchar(50),
  add column if not exists customer_name        varchar(200),
  add column if not exists customer_email       varchar(200),
  add column if not exists plano                varchar(60),
  add column if not exists professor            varchar(120),
  add column if not exists billing              varchar(20),
  add column if not exists asaas_customer_id    varchar(50),
  add column if not exists asaas_payment_id     varchar(50),
  add column if not exists asaas_subscription_id varchar(50),
  add column if not exists asaas_status         varchar(30),
  add column if not exists source               varchar(20) not null default 'checkout';

comment on column coupon_redemptions.coupon_code is
  'Código digitado no checkout. Fica mesmo se o cupom for excluído (coupon_id vira NULL).';
comment on column coupon_redemptions.billing is
  'recurring (mensal no cartão), installment (semestral/anual no cartão) ou pix (à vista).';
comment on column coupon_redemptions.source is
  'checkout = gravado pelo site na hora da compra; asaas = importado do histórico do Asaas.';

-- O checkout do site não conhece as tabelas legadas `payments`/`customers`,
-- e o histórico importado do Asaas não tem como saber o desconto exato.
alter table coupon_redemptions alter column payment_id drop not null;
alter table coupon_redemptions alter column customer_id drop not null;
alter table coupon_redemptions alter column discount_applied drop not null;

-- Uma compra conta uma vez: reprocessar o histórico do Asaas não duplica.
create unique index if not exists coupon_redemptions_asaas_payment_unique
  on coupon_redemptions (asaas_payment_id) where asaas_payment_id is not null;
create unique index if not exists coupon_redemptions_asaas_subscription_unique
  on coupon_redemptions (asaas_subscription_id) where asaas_subscription_id is not null;

create index if not exists idx_coupon_redemptions_coupon_data
  on coupon_redemptions (coupon_id, redeemed_at desc);

-- Registro de um uso
-- ------------------
-- Resolve o cupom pelo código (o site só sabe o código) e grava a linha; o
-- trigger `trigger_coupon_redemption` soma 1 em `usage_count`. Devolve o id da
-- linha, ou NULL quando a compra já estava registrada.
--
-- Nunca lança erro por duplicidade: o checkout chama isto depois de o cliente
-- já ter pago, e um erro aqui não pode virar erro de venda.
create or replace function register_coupon_redemption(
  p_code                  text,
  p_customer_name         text default null,
  p_customer_email        text default null,
  p_asaas_customer_id     text default null,
  p_asaas_payment_id      text default null,
  p_asaas_subscription_id text default null,
  p_plano                 text default null,
  p_professor             text default null,
  p_billing               text default null,
  p_discount              numeric default null,
  p_source                text default 'checkout',
  p_asaas_status          text default null,
  p_redeemed_at           timestamp default now()
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code      text := upper(trim(coalesce(p_code, '')));
  v_coupon_id uuid;
  v_id        uuid;
begin
  if v_code = '' then
    return null;
  end if;

  select id into v_coupon_id from coupons where upper(code) = v_code limit 1;

  insert into coupon_redemptions (
    coupon_id, coupon_code, customer_name, customer_email, asaas_customer_id,
    asaas_payment_id, asaas_subscription_id, plano, professor, billing,
    discount_applied, source, asaas_status, redeemed_at
  ) values (
    v_coupon_id, v_code, nullif(trim(p_customer_name), ''), nullif(lower(trim(p_customer_email)), ''),
    nullif(p_asaas_customer_id, ''), nullif(p_asaas_payment_id, ''), nullif(p_asaas_subscription_id, ''),
    nullif(p_plano, ''), nullif(p_professor, ''), nullif(p_billing, ''),
    p_discount, coalesce(nullif(p_source, ''), 'checkout'), nullif(p_asaas_status, ''),
    coalesce(p_redeemed_at, now())
  )
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    return null;
end;
$$;

comment on function register_coupon_redemption is
  'Grava um uso de cupom (quem, quando, plano, professor, desconto). O trigger da tabela soma 1 em coupons.usage_count. Chamada pelo checkout do site e pela importação do histórico do Asaas.';

-- Só o service_role (checkout do site e importação) chama; a tela lê a tabela.
revoke all on function register_coupon_redemption from public, anon, authenticated;
grant execute on function register_coupon_redemption to service_role;
