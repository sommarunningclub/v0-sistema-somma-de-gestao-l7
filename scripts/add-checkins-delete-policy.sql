-- Permite DELETE de check-in pelo painel.
--
-- A versão anterior criava a policy sem cláusula `TO`, ou seja, valia para
-- PUBLIC: qualquer portador da anon key podia apagar check-ins. O painel
-- apaga via rota server (service_role) atrás de requirePermission('checkin'),
-- então a policy só precisa cobrir service_role.
--
-- RLS não é ligado aqui: este painel só LÊ `checkins`; quem insere é o site
-- público de eventos, que compartilha este banco. Ligar RLS sem uma policy de
-- INSERT para esse fluxo derrubaria o check-in do evento. Ver a auditoria
-- pendente anotada em sql/021-harden-legacy-rls.sql.

DROP POLICY IF EXISTS "Allow admin delete check-in" ON public.checkins;

CREATE POLICY "Service role delete check-in"
  ON public.checkins
  FOR DELETE
  TO service_role
  USING (true);
