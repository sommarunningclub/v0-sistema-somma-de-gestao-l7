-- Fecha a tabela `public.users` para a anon key.
--
-- ACHADO (confirmado por sondagem em produção antes desta migration):
-- `select=*&limit=1` com `Prefer: count=exact` e a anon key devolvia
-- `content-range: 0-0/10` — as 10 contas do painel. `select=password_hash`,
-- `select=role` e `select=permissions` também respondiam 200. Ou seja: a
-- chave pública, que vai no bundle JavaScript de qualquer visitante, dava
-- acesso aos hashes bcrypt, aos e-mails e ao mapa de permissões dos
-- administradores. Com RLS evidentemente inativa na tabela, o mesmo vale
-- para escrita — bastaria um UPDATE para virar admin ou trocar a senha de
-- outra pessoa.
--
-- Não existe uso legítimo de `users` pela anon key: toda leitura e escrita
-- acontece server-side com service_role, em /api/auth/* e /api/admin/users/*.
-- O único ponto que fugia disso era `components/user-profile-edit.tsx`, que
-- passou a usar `PATCH /api/auth/me` (rota que já existia e tira o id da
-- sessão, nunca do corpo).
--
-- Idempotente: pode reexecutar.

DO $$
DECLARE pol record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'users'
  ) THEN
    RAISE NOTICE 'tabela public.users não existe — pulando';
    RETURN;
  END IF;

  -- Derruba qualquer policy permissiva herdada.
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'users'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.users;', pol.policyname);
  END LOOP;

  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
  -- FORCE para que nem o dono da tabela escape da policy: a conta de
  -- migração não deve ser um caminho alternativo de leitura dos hashes.
  ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

  CREATE POLICY "Service role full access users" ON public.users
    FOR ALL TO service_role USING (true) WITH CHECK (true);

  -- Sem GRANT, um erro futuro de policy não reabre a tabela.
  REVOKE ALL ON public.users FROM anon, authenticated;
END $$;

-- `eventos` e `popups` continuam com leitura pública (sql/001 e sql/006): o
-- site público depende delas. Mas leitura é tudo que precisam — só o painel
-- escreve, sempre com service_role. Revogar apenas a escrita não afeta
-- nenhum leitor e fecha a porta para alguém injetar um pop-up de phishing
-- no domínio do painel.
DO $$
DECLARE alvo text;
BEGIN
  FOREACH alvo IN ARRAY ARRAY['eventos', 'popups']
  LOOP
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = alvo) THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.%I FROM anon, authenticated;', alvo);
    END IF;
  END LOOP;
END $$;

-- Conferência: com a anon key, `users` deve passar a responder
-- "permission denied", e `eventos`/`popups` devem seguir lendo normalmente.
