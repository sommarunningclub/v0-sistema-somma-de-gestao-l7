import { isValidCpf, maskCep, maskCpf, onlyDigits } from '@/lib/insider/validation'

/**
 * Campos do cadastro de membro (`public.cadastro_site`).
 *
 * Lógica pura, usada no formulário do painel E na rota que grava: a mesma
 * regra valida dos dois lados, e o servidor nunca confia no que a tela mandou.
 *
 * Formatos gravados — os mesmos do site (NOVO-SITE-SOMMA-V3, rota
 * /api/cadastro-site) e do PDV, para que um registro editado aqui continue
 * legível por quem já lê a tabela:
 *
 *   cpf               999.999.999-99   (coluna char(14); 7.488 de 7.498 já assim)
 *   whatsapp          (99) 99999-9999
 *   cep               99999-999
 *   data_nascimento   AAAA-MM-DD
 *   sexo              feminino | masculino | outro
 *   data_de_cadastro  AAAA-MM-DDTHH:mm:ss-03:00  (Brasília, sem horário de verão)
 *
 * A base tem formatos antigos misturados (WhatsApp só com dígitos, nascimento
 * em DD/MM/AAAA). Por isso a tela só envia os campos que a pessoa de fato
 * alterou: o que ninguém tocou fica gravado exatamente como estava.
 */

/** Todas as colunas da tabela. `id` e `cpf_digits` são só leitura. */
export const COLUNAS_MEMBRO =
  'id, nome_completo, email, cpf, data_nascimento, whatsapp, cep, sexo, data_de_cadastro, cpf_digits'

export const CAMPOS_EDITAVEIS = [
  'nome_completo',
  'email',
  'cpf',
  'data_nascimento',
  'sexo',
  'whatsapp',
  'cep',
  'data_de_cadastro',
] as const

export type CampoEditavel = (typeof CAMPOS_EDITAVEIS)[number]

export const OPCOES_SEXO = [
  { valor: 'feminino', rotulo: 'Feminino' },
  { valor: 'masculino', rotulo: 'Masculino' },
  { valor: 'outro', rotulo: 'Outro' },
] as const

/** Linha da tabela como chega da API. Tudo pode vir nulo em cadastros antigos. */
export type DadosMembro = {
  id?: number
  nome_completo?: string | null
  email?: string | null
  cpf?: string | null
  data_nascimento?: string | null
  whatsapp?: string | null
  cep?: string | null
  sexo?: string | null
  data_de_cadastro?: string | null
  cpf_digits?: string | null
}

/** Valores do formulário: sempre texto, '' quando vazio. */
export type FormularioMembro = Record<CampoEditavel, string>

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/* ------------------------------------------------------------- telefone */

/** Dígitos do celular, sem +55 e sem zero na frente do DDD. */
export function digitosTelefone(valor: string | null | undefined): string {
  let d = onlyDigits(valor ?? '')
  if (d.startsWith('55') && d.length > 11) d = d.slice(2)
  if (d.startsWith('0') && (d.length === 11 || d.length === 12)) d = d.slice(1)
  return d.slice(0, 11)
}

/** Máscara progressiva, para digitação. */
export function mascararTelefone(valor: string): string {
  const d = onlyDigits(valor).slice(0, 11)
  if (d.length <= 2) return d
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/* --------------------------------------------------------------- datas */

function dataExiste(ano: number, mes: number, dia: number): boolean {
  const dt = new Date(Date.UTC(ano, mes - 1, dia))
  return dt.getUTCFullYear() === ano && dt.getUTCMonth() === mes - 1 && dt.getUTCDate() === dia
}

const dois = (n: number) => String(n).padStart(2, '0')

/**
 * Nascimento em AAAA-MM-DD, aceitando os formatos que existem na base:
 * AAAA-MM-DD, DD/MM/AAAA e DD/MM/AA. Devolve '' quando não dá para ler.
 */
export function nascimentoParaIso(valor: string | null | undefined, anoAtual = new Date().getFullYear()): string {
  const v = (valor ?? '').trim()
  let ano: number
  let mes: number
  let dia: number

  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v)
  if (m) {
    ano = Number(m[1])
    mes = Number(m[2])
    dia = Number(m[3])
  } else if ((m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v))) {
    dia = Number(m[1])
    mes = Number(m[2])
    ano = Number(m[3])
  } else if ((m = /^(\d{2})\/(\d{2})\/(\d{2})$/.exec(v))) {
    dia = Number(m[1])
    mes = Number(m[2])
    // Ano com 2 dígitos: século atual se não cair no futuro, senão o anterior.
    const curto = Number(m[3])
    ano = 2000 + curto <= anoAtual ? 2000 + curto : 1900 + curto
  } else {
    return ''
  }

  if (!dataExiste(ano, mes, dia)) return ''
  return `${ano}-${dois(mes)}-${dois(dia)}`
}

/**
 * Data de cadastro no formato do campo datetime-local (AAAA-MM-DDTHH:mm), em
 * horário de Brasília. Aceita AAAA-MM-DD, o formato -03:00 do site e ISO com Z.
 */
export function cadastroParaInput(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  if (!v) return ''

  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v}T00:00`

  const local = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?-03:00$/.exec(v)
  if (local) return `${local[1]}T${local[2]}`

  const ms = Date.parse(v)
  if (Number.isNaN(ms)) return ''
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(ms))
      .map((p) => [p.type, p.value])
  )
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`
}

/** datetime-local → formato gravado pelo site (Brasília, -03:00). null se inválido. */
export function inputParaCadastro(valor: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(valor.trim())
  if (!m) return null
  const [ano, mes, dia, hora, minuto, segundo] = [m[1], m[2], m[3], m[4], m[5], m[6] ?? '00'].map(Number)
  if (!dataExiste(ano, mes, dia) || hora > 23 || minuto > 59 || segundo > 59) return null
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${dois(segundo)}-03:00`
}

/* ----------------------------------------------------------- exibição */

export function formatarCpf(valor: string | null | undefined): string {
  const d = onlyDigits(valor ?? '')
  if (d.length === 11) return maskCpf(d)
  return (valor ?? '').trim() || '—'
}

export function formatarTelefone(valor: string | null | undefined): string {
  const d = digitosTelefone(valor)
  if (d.length === 10 || d.length === 11) return mascararTelefone(d)
  return (valor ?? '').trim() || '—'
}

export function formatarCep(valor: string | null | undefined): string {
  const d = onlyDigits(valor ?? '')
  if (d.length === 8) return maskCep(d)
  return (valor ?? '').trim() || '—'
}

export function formatarNascimento(valor: string | null | undefined): string {
  const iso = nascimentoParaIso(valor)
  if (!iso) return (valor ?? '').trim() || '—'
  const [ano, mes, dia] = iso.split('-')
  return `${dia}/${mes}/${ano}`
}

export function formatarCadastro(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  const local = cadastroParaInput(v)
  if (!local) return v || '—'
  const [data, hora] = local.split('T')
  const [ano, mes, dia] = data.split('-')
  // Cadastro antigo sem hora: mostrar 00:00 daria a impressão de um horário real.
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${dia}/${mes}/${ano}` : `${dia}/${mes}/${ano} ${hora}`
}

export function rotuloSexo(valor: string | null | undefined): string {
  const v = (valor ?? '').trim()
  return OPCOES_SEXO.find((o) => o.valor === v.toLowerCase())?.rotulo ?? (v || '—')
}

/* --------------------------------------------------------- formulário */

/** Valores iniciais do formulário a partir da linha da tabela. */
export function paraFormulario(m: DadosMembro): FormularioMembro {
  const telefone = digitosTelefone(m.whatsapp)
  return {
    nome_completo: (m.nome_completo ?? '').trim(),
    email: (m.email ?? '').trim(),
    cpf: maskCpf((m.cpf ?? '').trim()),
    data_nascimento: nascimentoParaIso(m.data_nascimento),
    sexo: (m.sexo ?? '').trim(),
    whatsapp: telefone ? mascararTelefone(telefone) : '',
    cep: maskCep((m.cep ?? '').trim()),
    data_de_cadastro: cadastroParaInput(m.data_de_cadastro),
  }
}

/** Só o que mudou em relação aos valores iniciais. */
export function diferencas(inicial: FormularioMembro, atual: FormularioMembro): Partial<FormularioMembro> {
  const saida: Partial<FormularioMembro> = {}
  for (const campo of CAMPOS_EDITAVEIS) {
    if (atual[campo].trim() !== inicial[campo].trim()) saida[campo] = atual[campo]
  }
  return saida
}

/* --------------------------------------------------------- normalização */

export type ResultadoNormalizacao =
  | { ok: true; campos: Partial<Record<CampoEditavel, string | null>> }
  | { ok: false; erro: string; campo: CampoEditavel | null }

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/**
 * Valida e converte para o formato gravado. Só considera os campos editáveis
 * presentes no corpo; `id`, `cpf_digits` e qualquer outra chave são ignorados.
 * Vazio vira null, exceto nome e CPF, que a tabela exige.
 */
export function normalizarAlteracoes(corpo: unknown, hoje: Date = new Date()): ResultadoNormalizacao {
  const fonte = corpo && typeof corpo === 'object' ? (corpo as Record<string, unknown>) : {}
  const campos: Partial<Record<CampoEditavel, string | null>> = {}
  const falha = (campo: CampoEditavel, erro: string): ResultadoNormalizacao => ({ ok: false, erro, campo })

  for (const campo of CAMPOS_EDITAVEIS) {
    if (!(campo in fonte) || fonte[campo] === undefined) continue
    const bruto = fonte[campo]
    if (bruto !== null && typeof bruto !== 'string') return falha(campo, 'Valor inválido.')
    const v = texto(bruto)

    switch (campo) {
      case 'nome_completo': {
        const nome = v.replace(/\s+/g, ' ')
        if (nome.length < 2) return falha(campo, 'Informe o nome completo.')
        if (nome.length > 200) return falha(campo, 'Nome muito longo.')
        campos.nome_completo = nome
        break
      }
      case 'email': {
        if (!v) {
          campos.email = null
          break
        }
        const email = v.toLowerCase()
        if (email.length > 254 || !EMAIL.test(email)) return falha(campo, 'E-mail inválido.')
        campos.email = email
        break
      }
      case 'cpf': {
        const d = onlyDigits(v)
        if (!isValidCpf(d)) return falha(campo, 'CPF inválido — confira os dígitos.')
        campos.cpf = maskCpf(d)
        break
      }
      case 'data_nascimento': {
        if (!v) {
          campos.data_nascimento = null
          break
        }
        const iso = nascimentoParaIso(v, hoje.getFullYear())
        if (!iso) return falha(campo, 'Data de nascimento inválida.')
        const ano = Number(iso.slice(0, 4))
        const hojeIso = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`
        if (ano < 1900 || iso > hojeIso) return falha(campo, 'Data de nascimento fora do intervalo possível.')
        campos.data_nascimento = iso
        break
      }
      case 'sexo': {
        if (!v) {
          campos.sexo = null
          break
        }
        const sexo = v.toLowerCase()
        if (!OPCOES_SEXO.some((o) => o.valor === sexo)) return falha(campo, 'Sexo inválido.')
        campos.sexo = sexo
        break
      }
      case 'whatsapp': {
        if (!v) {
          campos.whatsapp = null
          break
        }
        const d = digitosTelefone(v)
        if (d.length !== 10 && d.length !== 11) return falha(campo, 'WhatsApp inválido — informe DDD e número.')
        campos.whatsapp = mascararTelefone(d)
        break
      }
      case 'cep': {
        if (!v) {
          campos.cep = null
          break
        }
        const d = onlyDigits(v)
        if (d.length !== 8) return falha(campo, 'CEP inválido — são 8 dígitos.')
        campos.cep = maskCep(d)
        break
      }
      case 'data_de_cadastro': {
        if (!v) {
          campos.data_de_cadastro = null
          break
        }
        const gravado = inputParaCadastro(v)
        if (!gravado) return falha(campo, 'Data de cadastro inválida.')
        campos.data_de_cadastro = gravado
        break
      }
    }
  }

  return { ok: true, campos }
}
