-- Auditoria e conciliação de reembolsos integrais dos pedidos.
alter table mafood.orders
  add column if not exists refund_status text,
  add column if not exists refund_mode text,
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refund_reason text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refunded_at timestamptz,
  add column if not exists refund_receipt_url text,
  add column if not exists refund_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_refund_status_check'
      and conrelid = 'mafood.orders'::regclass
  ) then
    alter table mafood.orders
      add constraint orders_refund_status_check
      check (
        refund_status is null
        or refund_status in ('requested', 'pending', 'partial', 'done', 'cancelled', 'failed')
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_refund_mode_check'
      and conrelid = 'mafood.orders'::regclass
  ) then
    alter table mafood.orders
      add constraint orders_refund_mode_check
      check (refund_mode is null or refund_mode in ('asaas', 'manual'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_refund_amount_check'
      and conrelid = 'mafood.orders'::regclass
  ) then
    alter table mafood.orders
      add constraint orders_refund_amount_check
      check (refund_amount is null or refund_amount >= 0);
  end if;
end
$$;

create unique index if not exists orders_asaas_payment_id_unique
  on mafood.orders (asaas_payment_id)
  where asaas_payment_id is not null;

comment on column mafood.orders.refund_status is
  'Estado financeiro do reembolso: requested, pending, partial, done, cancelled ou failed.';
comment on column mafood.orders.refund_mode is
  'asaas para devolução automática; manual para pagamento realizado na tenda.';
comment on column mafood.orders.refund_amount is
  'Valor total cuja devolução foi solicitada ou confirmada.';
comment on column mafood.orders.refund_receipt_url is
  'Comprovante retornado pelo Asaas quando disponível.';;
