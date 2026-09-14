/**
 * Links de divulgação do NPS.
 *
 * Três camadas, cada uma respondendo uma pergunta diferente no relatório:
 * - rodada (`/assessoria/nps/<slug>`): de qual bimestre é a resposta;
 * - canal (`?origem=`): por onde a pessoa chegou (grupo, Instagram, domingo…),
 *   gravado em `source`;
 * - pessoal (`/assessoria/nps/convite/<token>`): quem é o aluno, para cobrar
 *   quem não respondeu e ter o NPS por professor com segurança.
 */

export const SITE_URL = 'https://sommaclub.com.br'

export function linkGeral(): string {
  return `${SITE_URL}/assessoria/nps`
}

export function linkDaRodada(slug: string): string {
  return `${SITE_URL}/assessoria/nps/${encodeURIComponent(slug)}`
}

export function linkPessoal(token: string): string {
  return `${SITE_URL}/assessoria/nps/convite/${encodeURIComponent(token)}`
}

/** Mesma normalização que o site aplica ao gravar `source`. */
export function slugDeOrigem(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '')
}

export function comOrigem(link: string, origem: string): string {
  const valor = slugDeOrigem(origem)
  if (!valor) return link
  const url = new URL(link)
  url.searchParams.set('origem', valor)
  return url.toString()
}

export interface Canal {
  id: string
  rotulo: string
  descricao: string
}

export const CANAIS: Canal[] = [
  { id: 'whatsapp-grupos', rotulo: 'Grupos de WhatsApp', descricao: 'Mensagem fixada nos grupos da assessoria' },
  { id: 'whatsapp-professor', rotulo: 'Professor no privado', descricao: 'Cada professor envia para os próprios alunos' },
  { id: 'instagram', rotulo: 'Instagram', descricao: 'Stories e link na bio' },
  { id: 'email', rotulo: 'E-mail', descricao: 'Disparo pelo E-mail Marketing' },
  { id: 'domingo-qr', rotulo: 'Encontro de domingo', descricao: 'QR code impresso no ponto de encontro' },
]

const ROTULO_ORIGEM: Record<string, string> = {
  direct: 'Link sem origem',
  invite: 'Link pessoal',
  ...Object.fromEntries(CANAIS.map((c) => [c.id, c.rotulo])),
}

export function rotuloDaOrigem(origem: string | null | undefined): string {
  if (!origem) return 'Link sem origem'
  return ROTULO_ORIGEM[origem] ?? origem
}

/** Celular brasileiro no formato do wa.me: 55 + DDD + número. */
export function normalizarTelefoneBr(raw: string | null | undefined): string | null {
  const digitos = String(raw ?? '').replace(/\D/g, '')
  if (digitos.length === 10 || digitos.length === 11) return `55${digitos}`
  if ((digitos.length === 12 || digitos.length === 13) && digitos.startsWith('55')) return digitos
  return null
}

export function mensagemConvite(primeiroNome: string, link: string, rotuloRodada: string): string {
  const nome = primeiroNome.trim()
  return (
    `Oi${nome ? `, ${nome}` : ''}! Queremos ouvir você sobre a Assessoria Somma (rodada ${rotuloRodada}). ` +
    `Leva poucos minutos e este link é só seu: ${link}`
  )
}

export function linkWhatsapp(telefone: string | null | undefined, mensagem: string): string | null {
  const numero = normalizarTelefoneBr(telefone)
  if (!numero) return null
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`
}
