-- Endurece o RLS de `partners`.
--
-- A versão anterior deste script criava policies `USING (true)` sem cláusula
-- `TO`, o que vale para PUBLIC — inclusive `anon`. Como a anon key é pública,
-- isso expunha CNPJ, CPF e contatos dos responsáveis na API REST do Supabase.
-- O acesso legítimo é sempre server-side com service_role, atrás de
-- requirePermission('parceiro').
--
-- Equivalente ao bloco de `partners` em sql/021-harden-legacy-rls.sql, mantido
-- aqui porque é este arquivo que ainda circula entre quem opera o banco.

DROP POLICY IF EXISTS "Allow all for authenticated users" ON partners;
DROP POLICY IF EXISTS "Allow select for all" ON partners;
DROP POLICY IF EXISTS "Allow insert for all" ON partners;
DROP POLICY IF EXISTS "Allow update for all" ON partners;
DROP POLICY IF EXISTS "Allow delete for all" ON partners;
DROP POLICY IF EXISTS "Authenticated users can view all partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can insert partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can update partners" ON partners;
DROP POLICY IF EXISTS "Authenticated users can delete partners" ON partners;

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access partners" ON partners;
CREATE POLICY "Service role full access partners" ON partners
  FOR ALL TO service_role USING (true) WITH CHECK (true);

REVOKE ALL ON partners FROM anon, authenticated;
