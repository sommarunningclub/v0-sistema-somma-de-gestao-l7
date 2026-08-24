-- Endurecimento das RLS legadas (aplicado via `supabase db push`).
-- Fecha as policies permissivas criadas pelos scripts legados em `scripts/`.
--
-- Os scripts antigos publicaram policies com `USING (true)` sem cláusula
-- `TO`, o que em Postgres vale para PUBLIC — ou seja, também para `anon` e
-- `authenticated`. Como a anon key é pública por definição (viaja no bundle
-- do browser), qualquer pessoa com a URL do projeto podia ler e escrever
-- nessas tabelas direto na API REST do Supabase, sem passar pela camada de
-- autenticação do Next.
--
-- Padrão adotado aqui é o mesmo de sql/013 e sql/020: RLS ligado e acesso
-- exclusivo de `service_role`, que é a única chave usada pelas rotas server.
-- `service_role` ignora RLS de qualquer forma; as policies existem para
-- documentar a intenção e para o caso de a chave ser usada com RLS forçado.
--
-- Idempotente: pode rodar mais de uma vez.

DO $$
DECLARE
  alvo text;
  pol record;
BEGIN
  FOREACH alvo IN ARRAY ARRAY[
    'partners',
    'cobrancas_membros',
    'assinaturas_membros',
    'entity_tags',
    'tag_definitions',
    'coupons',
    'coupon_redemptions'
  ]
  LOOP
    -- Tabelas que não existem neste banco simplesmente são puladas.
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = alvo
    ) THEN
      RAISE NOTICE 'tabela public.% não existe — pulando', alvo;
      CONTINUE;
    END IF;

    -- Derruba TODA policy existente: as legadas têm nomes variados
    -- ("Enable read for all users", "Allow select for all", ...) e listar
    -- um a um deixaria sobras silenciosas.
    FOR pol IN
      SELECT policyname FROM pg_policies
      WHERE schemaname = 'public' AND tablename = alvo
    LOOP
      EXECUTE format('DROP POLICY %I ON public.%I;', pol.policyname, alvo);
    END LOOP;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', alvo);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO service_role USING (true) WITH CHECK (true);',
      'Service role full access ' || alvo,
      alvo
    );

    -- Cinto e suspensório: sem RLS permissiva E sem GRANT, um erro futuro de
    -- policy não reabre a tabela para a anon key.
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated;', alvo);
  END LOOP;
END $$;

-- `checkins` recebe tratamento à parte, de propósito.
--
-- Este painel apenas LÊ a tabela: nenhuma rota daqui insere check-in. Quem
-- insere é o site público de eventos, que compartilha este mesmo banco (ver
-- comentário em sql/013) e provavelmente usa a anon key. Revogar anon aqui
-- derrubaria o check-in do evento, então só a policy de DELETE — que estava
-- aberta a PUBLIC e permitia a qualquer um apagar check-ins — é corrigida.
--
-- RLS não é LIGADO aqui de propósito: se estiver desligado hoje, ligar sem
-- policy de INSERT para anon derrubaria o check-in do evento em produção.
--
--   AUDITORIA PENDENTE (obrigatória): conferir no Dashboard
--   (a) se `checkins` tem RLS habilitado e (b) quem insere na tabela.
--   Enquanto RLS estiver DESLIGADO, trocar a policy abaixo não protege nada —
--   a tabela segue totalmente aberta à anon key. O fim da história é ligar RLS
--   com uma policy de INSERT restrita ao fluxo público e o resto em
--   service_role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'checkins') THEN
    DROP POLICY IF EXISTS "Allow admin delete check-in" ON public.checkins;

    DROP POLICY IF EXISTS "Service role delete check-in" ON public.checkins;
    CREATE POLICY "Service role delete check-in" ON public.checkins
      FOR DELETE TO service_role USING (true);
  END IF;
END $$;

-- Conferência pós-execução: não deve sobrar nenhuma linha para estas tabelas
-- com roles diferentes de {service_role}.
--
--   SELECT tablename, policyname, roles, qual
--   FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('partners','cobrancas_membros','assinaturas_membros',
--                       'entity_tags','tag_definitions',
--                       'coupons','coupon_redemptions')
--   ORDER BY tablename, policyname;
