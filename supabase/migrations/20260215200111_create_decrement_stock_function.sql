
CREATE OR REPLACE FUNCTION decrement_stock(p_variacao_id UUID, p_quantidade INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE produto_variacoes
  SET estoque = GREATEST(0, estoque - p_quantidade)
  WHERE id = p_variacao_id;
END;
$$;
;
