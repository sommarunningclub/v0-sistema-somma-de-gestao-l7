-- Insider entra no PDV só com o CPF: vincula quem já foi liberado
-- ================================================================
--
-- O Insider Connect em produção pede só o CPF, e quase nenhum Insider tem
-- senha. A primeira versão do login Insider do PDV exigia a senha, então quem
-- foi liberado no painel sem senha de Insider ficou com `insider_id` nulo e
-- não conseguiria entrar só com o CPF.
--
-- Este backfill vincula esses operadores ao registro Insider do mesmo CPF, mas
-- só quando o registro Insider é ANTERIOR à liberação. Registro criado depois
-- continua sem vínculo: o portal Insider é de auto-cadastro, e é exatamente
-- esse o caminho de quem tentaria fabricar um Insider para o CPF de um
-- operador de código.

update public.pos_operators o
set insider_id = d.id,
    updated_at = now()
from public.dados_insiders d
where o.insider_id is null
  and regexp_replace(coalesce(d.cpf, ''), '\D', '', 'g') = o.cpf
  and d.criado_em is not null
  and d.criado_em <= o.created_at
  and coalesce(d.ativo, true);
