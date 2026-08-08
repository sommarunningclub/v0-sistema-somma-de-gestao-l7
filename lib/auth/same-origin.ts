/**
 * Recusa requisições de escrita vindas de outro site.
 *
 * `entrar` e `criar-senha` são públicas e emitem cookie de sessão. Sem esta
 * checagem, um formulário hospedado em outro domínio consegue disparar um
 * POST com corpo em formato JSON (usando enctype="text/plain") e logar a
 * vítima na conta do atacante — o SameSite=Lax impede o cookie de ser
 * enviado, mas não impede a resposta de gravar um novo.
 *
 * Compara o Origin (ou o Referer, quando o Origin não vem) com o host da
 * própria requisição. Ausência dos dois é recusa: um navegador sempre manda
 * Origin em POST cross-site, então requisição sem nenhum dos dois não veio
 * de um formulário legítimo do site.
 */
export function isSameOrigin(req: Request): boolean {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!host) return false

  const bruto = req.headers.get('origin') || req.headers.get('referer')
  if (!bruto) return false

  try {
    return new URL(bruto).host === host
  } catch {
    return false
  }
}
