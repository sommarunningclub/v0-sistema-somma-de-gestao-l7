import type { StatusTone } from '@/components/somma'

/**
 * Etapas da triagem de candidatos (`candidatos_vagas.status`).
 *
 * O tom fica aqui, e não em `toneForStatus`, porque este vocabulário é só do
 * módulo Vagas — "entrevista" e "reprovado" não significam nada nos outros
 * módulos, e mexer no mapa central recoloriria registros alheios que por acaso
 * usem as mesmas palavras.
 */
export const ETAPAS = [
  { value: 'novo', label: 'Novo', tone: 'info' },
  { value: 'em_analise', label: 'Em análise', tone: 'warning' },
  { value: 'entrevista', label: 'Entrevista', tone: 'brand' },
  { value: 'aprovado', label: 'Aprovado', tone: 'success' },
  { value: 'reprovado', label: 'Reprovado', tone: 'danger' },
] as const satisfies ReadonlyArray<{ value: string; label: string; tone: StatusTone }>

export type EtapaValue = (typeof ETAPAS)[number]['value']

export const ETAPA_VALUES = ETAPAS.map((e) => e.value) as readonly EtapaValue[]

export function isEtapa(value: unknown): value is EtapaValue {
  return typeof value === 'string' && (ETAPA_VALUES as readonly string[]).includes(value)
}

export function etapaLabel(value: string | null | undefined): string {
  return ETAPAS.find((e) => e.value === value)?.label ?? 'Novo'
}

export function etapaTone(value: string | null | undefined): StatusTone {
  return ETAPAS.find((e) => e.value === value)?.tone ?? 'neutral'
}

/**
 * Monta o link do WhatsApp para o telefone que o candidato cadastrou.
 *
 * Devolve `null` quando o número não dá para discar, para o botão nascer
 * desabilitado em vez de abrir uma conversa vazia com número inválido.
 *
 * O teste de DDI é por comprimento, não só pelo prefixo: "55" também é o DDD de
 * Caxias do Sul, então `55999999999` (11 dígitos) é um celular gaúcho sem país,
 * e não um número já internacionalizado.
 */
export function whatsappHref(
  telefone: string | null | undefined,
  mensagem?: string,
): string | null {
  const digitos = (telefone ?? '').replace(/\D/g, '')
  if (digitos.length < 10) return null

  const comPais = digitos.startsWith('55') && digitos.length >= 12 ? digitos : `55${digitos}`
  if (comPais.length < 12 || comPais.length > 13) return null

  const query = mensagem ? `?text=${encodeURIComponent(mensagem)}` : ''
  return `https://wa.me/${comPais}${query}`
}

/**
 * Primeira mensagem sugerida. O WhatsApp só preenche o campo de texto — quem
 * envia ainda lê e edita antes de mandar.
 */
export function mensagemWhatsapp(nome: string, vagaTitulo: string): string {
  const primeiroNome = nome.trim().split(/\s+/)[0] || nome
  return `Olá, ${primeiroNome}! Aqui é do Somma Club. Recebemos a sua candidatura para a vaga de ${vagaTitulo} e queremos conversar com você.`
}

/** Linha de `candidatos_vagas` como o painel a consome. */
export interface CandidatoVaga {
  id: string
  criado_em: string
  vaga_slug: string
  vaga_titulo: string
  nome: string
  email: string
  telefone: string
  data_nascimento: string | null
  cep: string | null
  logradouro: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  complemento: string | null
  instituicao: string
  semestre: string
  indicado: boolean | null
  indicado_por: string | null
  curriculo_path: string | null
  curriculo_nome: string | null
  status: string
  observacoes: string | null
  origem: string
}
