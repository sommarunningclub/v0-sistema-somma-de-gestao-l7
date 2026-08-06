"use client"

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { ArrowRight, CheckCircle2, Loader2 } from 'lucide-react'
import { INPUT_CLS, InsiderField, Reveal } from '@/components/insider/insider-form-ui'
import { useCepLookup } from '@/hooks/use-cep-lookup'
import {
  isValidBirthDate,
  isValidCpf,
  maskCep,
  maskCpf,
  maskDate,
  maskPhone,
  maskUf,
  onlyDigits,
  validateSenha,
} from '@/lib/insider/validation'
import type { InsiderPublic } from '@/lib/insider/insider-mapper'

type FormState = {
  cpf: string
  nome: string
  email: string
  telefone: string
  data_nascimento: string
  sexo: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  senha_atual: string
  senha: string
  senha_confirmacao: string
}

const FORM_VAZIO: Omit<FormState, 'cpf'> = {
  nome: '',
  email: '',
  telefone: '',
  data_nascimento: '',
  sexo: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  senha_atual: '',
  senha: '',
  senha_confirmacao: '',
}

type LookupStatus = 'idle' | 'loading' | 'found' | 'new'

export function InsiderCadastroForm() {
  const [form, setForm] = useState<FormState>({ cpf: '', ...FORM_VAZIO })
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>('idle')
  const [nomeEncontrado, setNomeEncontrado] = useState('')
  const [temSenha, setTemSenha] = useState(false)
  const [fotoAtual, setFotoAtual] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [consentLgpd, setConsentLgpd] = useState(false)
  const [consentImagem, setConsentImagem] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState<'novo' | 'atualizado' | null>(null)
  const [senhaLogin, setSenhaLogin] = useState('')
  const [entrando, setEntrando] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)

  const router = useRouter()
  const cep = useCepLookup()
  const ultimoCepBuscado = useRef('')

  const set = (campo: keyof FormState, valor: string) =>
    setForm((f) => ({ ...f, [campo]: valor }))

  /**
   * Zera tudo que não faz parte de FormState/FORM_VAZIO e que, por isso,
   * não é limpo automaticamente por `setForm({ ...FORM_VAZIO, cpf })`:
   * consentimentos e a foto escolhida (com revogação da object URL).
   * Chamada nos dois ramos do efeito de busca de CPF (reset e encontrado)
   * para que nenhum estado fora de FormState sobreviva a uma troca de CPF.
   */
  function limparConsentEFoto() {
    setConsentLgpd(false)
    setConsentImagem(false)
    setFoto(null)
    setFotoPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return ''
    })
    setSenhaLogin('')
    setModoEdicao(false)
  }

  // --- Busca do CPF ---
  useEffect(() => {
    const digits = onlyDigits(form.cpf)

    if (digits.length !== 11 || !isValidCpf(form.cpf)) {
      setLookupStatus('idle')
      setNomeEncontrado('')
      setTemSenha(false)
      setFotoAtual('')
      ultimoCepBuscado.current = ''
      setForm((f) => ({ ...FORM_VAZIO, cpf: f.cpf }))
      limparConsentEFoto()
      return
    }

    let cancelado = false
    setLookupStatus('loading')
    setErro(null)

    fetch('/api/insiders/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cpf: form.cpf }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        return { res, data } as { res: Response; data: { found?: boolean; insider?: InsiderPublic; error?: string } }
      })
      .then(({ res, data }) => {
        if (cancelado) return
        if (!res.ok) {
          setErro(data?.error || 'Erro ao buscar o cadastro.')
          setLookupStatus('idle')
          return
        }
        if (data?.found && data.insider) {
          const i = data.insider
          setForm((f) => ({
            cpf: f.cpf,
            nome: i.nome,
            email: i.email,
            telefone: i.telefone,
            data_nascimento: i.data_nascimento,
            sexo: i.sexo,
            cep: i.cep,
            logradouro: i.logradouro,
            numero: i.numero,
            complemento: i.complemento,
            bairro: i.bairro,
            cidade: i.cidade,
            estado: i.estado,
            senha_atual: '',
            senha: '',
            senha_confirmacao: '',
          }))
          ultimoCepBuscado.current = onlyDigits(i.cep)
          setNomeEncontrado(i.nome.split(' ')[0] || '')
          setTemSenha(i.tem_senha)
          setFotoAtual(i.foto_url)
          limparConsentEFoto()
          setLookupStatus('found')
        } else {
          // CPF válido, mas não encontrado: garante que nada do CPF anterior
          // (campos de texto, consentimentos, foto) sobrevive — inclusive no
          // caso de troca direta de um CPF válido/encontrado para outro
          // válido/não encontrado, que nunca passa pelo ramo de reset acima.
          setNomeEncontrado('')
          setTemSenha(false)
          setFotoAtual('')
          ultimoCepBuscado.current = ''
          setForm((f) => ({ ...FORM_VAZIO, cpf: f.cpf }))
          limparConsentEFoto()
          setLookupStatus('new')
        }
      })
      .catch(() => {
        // Rede falhou: segue como cadastro novo. O servidor refaz a busca
        // por CPF no envio, então não há risco de duplicar.
        if (!cancelado) setLookupStatus('new')
      })

    return () => {
      cancelado = true
    }
  }, [form.cpf])

  // --- Autofill de endereço ---
  async function handleCepChange(valor: string) {
    const formatado = maskCep(valor)
    set('cep', formatado)

    const digits = onlyDigits(formatado)
    if (digits.length !== 8 || digits === ultimoCepBuscado.current) return

    ultimoCepBuscado.current = digits
    const endereco = await cep.buscar(digits)
    if (!endereco) {
      // Falhou: limpa a ref para que retypar o mesmo CEP dispare nova busca.
      ultimoCepBuscado.current = ''
      return
    }

    setForm((f) => ({
      ...f,
      logradouro: endereco.logradouro || f.logradouro,
      bairro: endereco.bairro || f.bairro,
      cidade: endereco.cidade || f.cidade,
      estado: endereco.estado || f.estado,
    }))
  }

  const MAX_FOTO_SIZE = 5 * 1024 * 1024 // 5MB

  function handleFoto(file: File | null) {
    if (file && file.size > MAX_FOTO_SIZE) {
      setErro('A foto deve ter no máximo 5MB.')
      setFoto(null)
      setFotoPreview((anterior) => {
        if (anterior) URL.revokeObjectURL(anterior)
        return ''
      })
      return
    }
    setFoto(file)
    setFotoPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  // Mantém a última object URL acessível para o cleanup de desmontagem sem
  // recriar o efeito a cada troca de foto (evita revogar uma URL ainda em uso).
  const fotoPreviewRef = useRef('')
  fotoPreviewRef.current = fotoPreview

  useEffect(() => {
    return () => {
      if (fotoPreviewRef.current) URL.revokeObjectURL(fotoPreviewRef.current)
    }
  }, [])

  // --- Revelação progressiva ---
  const revelarTudo = lookupStatus === 'found'
  const iniciado = lookupStatus === 'found' || lookupStatus === 'new'
  const modoLogin = lookupStatus === 'found' && temSenha && !modoEdicao

  const nomeOk = form.nome.trim().length >= 3
  const emailOk = /\S+@\S+\.\S+/.test(form.email)
  const nascOk = isValidBirthDate(form.data_nascimento)
  const cepOk = onlyDigits(form.cep).length === 8
  const enderecoOk =
    form.logradouro.trim().length >= 3 &&
    form.numero.trim().length >= 1 &&
    form.bairro.trim().length >= 2 &&
    form.cidade.trim().length >= 2 &&
    form.estado.trim().length === 2
  const telefoneOk = onlyDigits(form.telefone).length >= 10
  const sexoOk = form.sexo === 'masculino' || form.sexo === 'feminino'
  const senhaOk = validateSenha(form.senha, form.senha_confirmacao, !temSenha) === null

  const showNome = iniciado && !modoLogin
  const showEmail = showNome && (revelarTudo || nomeOk)
  const showNascCep = showEmail && (revelarTudo || emailOk)
  const showEndereco = showNascCep && (revelarTudo || (nascOk && cepOk))
  const showTelefone = showEndereco && (revelarTudo || enderecoOk)
  const showSexo = showTelefone && (revelarTudo || telefoneOk)
  const showFotoSenha = showSexo && (revelarTudo || sexoOk)
  const showFinal = showFotoSenha && (revelarTudo || senhaOk)

  async function handleEntrar(e: React.FormEvent) {
    e.preventDefault()
    if (entrando) return
    setErro(null)
    setEntrando(true)
    try {
      const res = await fetch('/api/insiders/entrar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: form.cpf, senha: senhaLogin }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível entrar.')
      }
      router.push('/insider/painel')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setEntrando(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (enviando) return
    setErro(null)

    if (temSenha && !form.senha_atual) {
      setErro('Informe sua senha atual para salvar as alterações.')
      return
    }

    const erroSenha = validateSenha(form.senha, form.senha_confirmacao, !temSenha)
    if (erroSenha) {
      setErro(erroSenha)
      return
    }

    const payload = new FormData()
    Object.entries(form).forEach(([chave, valor]) => payload.append(chave, valor))
    payload.append('consent_lgpd', String(consentLgpd))
    payload.append('consent_imagem', String(consentImagem))
    if (foto) payload.append('foto', foto)

    setEnviando(true)
    try {
      const res = await fetch('/api/insiders/register', { method: 'POST', body: payload })
      const data = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 401) {
          setTemSenha(true)
          setErro('Este CPF já tem senha cadastrada. Informe sua senha atual para continuar.')
          return
        }
        if (data?.error) {
          setErro(data.error)
          return
        }
        if (res.status === 413) {
          setErro('A foto é muito grande. Escolha uma imagem menor.')
          return
        }
        if (res.status === 429) {
          setErro('Muitas tentativas. Aguarde um instante e tente novamente.')
          return
        }
        setErro('Erro ao salvar o cadastro. Tente novamente.')
        return
      }

      setConcluido(data?.atualizado ? 'atualizado' : 'novo')
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar o cadastro.')
    } finally {
      setEnviando(false)
    }
  }

  if (concluido) {
    return (
      <div className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-lg md:p-8">
        <CheckCircle2 className="mx-auto h-12 w-12 text-[#FF2C03]" />
        <h2 className="mt-4 text-xl font-semibold text-[#0A0A0A]">
          {concluido === 'novo' ? 'Cadastro concluído!' : 'Cadastro atualizado!'}
        </h2>
        <p className="mt-2 text-sm text-[#737373]">
          Seus dados foram salvos. Qualquer mudança, é só voltar aqui e digitar seu CPF.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto w-full max-w-md rounded-3xl bg-white p-7 shadow-lg md:p-8"
      noValidate
    >
      <InsiderField id="cpf" label="CPF">
        <div className="relative">
          <input
            id="cpf"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            value={form.cpf}
            onChange={(e) => set('cpf', maskCpf(e.target.value))}
            className={INPUT_CLS}
            placeholder="000.000.000-00"
          />
          {lookupStatus === 'loading' && (
            <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[#737373]" />
          )}
        </div>
      </InsiderField>

      {lookupStatus === 'found' && (
        <p className="mt-2 text-sm text-[#737373]">
          Encontramos seu cadastro{nomeEncontrado ? `, ${nomeEncontrado}` : ''}! Confira e atualize
          os dados.
        </p>
      )}
      {lookupStatus === 'new' && (
        <p className="mt-2 text-sm text-[#737373]">
          CPF não encontrado — vamos fazer o seu cadastro.
        </p>
      )}

      <Reveal show={modoLogin}>
        <InsiderField id="senha_login" label="Senha">
          <input
            id="senha_login"
            type="password"
            autoComplete="current-password"
            value={senhaLogin}
            onChange={(e) => setSenhaLogin(e.target.value)}
            className={INPUT_CLS}
            placeholder="Sua senha de acesso"
          />
        </InsiderField>

        <button
          type="button"
          onClick={handleEntrar}
          disabled={entrando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
        >
          {entrando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          Entrar
          {!entrando && <ArrowRight className="h-4 w-4" />}
        </button>

        <button
          type="button"
          onClick={() => setModoEdicao(true)}
          className="mt-3 w-full text-center text-sm text-[#737373] underline"
        >
          Prefiro atualizar meus dados sem entrar
        </button>
      </Reveal>

      <Reveal show={showNome}>
        <InsiderField id="nome" label="Nome completo">
          <input
            id="nome"
            type="text"
            autoComplete="name"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            className={INPUT_CLS}
            placeholder="João Silva Santos"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showEmail}>
        <InsiderField id="email" label="E-mail">
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={INPUT_CLS}
            placeholder="seu@email.com"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showNascCep}>
        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="data_nascimento" label="Data de nascimento">
            <input
              id="data_nascimento"
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', maskDate(e.target.value))}
              className={INPUT_CLS}
              placeholder="DD/MM/AAAA"
            />
          </InsiderField>
          <InsiderField id="cep" label="CEP">
            <input
              id="cep"
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              value={form.cep}
              onChange={(e) => handleCepChange(e.target.value)}
              className={INPUT_CLS}
              placeholder="00000-000"
            />
          </InsiderField>
        </div>
        {cep.status === 'loading' && (
          <p className="mt-2 text-sm text-[#737373]">Buscando endereço…</p>
        )}
        {cep.status === 'error' && (
          <p className="mt-2 text-sm text-[#737373]">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}
      </Reveal>

      <Reveal show={showEndereco}>
        <InsiderField id="logradouro" label="Endereço">
          <input
            id="logradouro"
            type="text"
            autoComplete="address-line1"
            value={form.logradouro}
            onChange={(e) => set('logradouro', e.target.value)}
            className={INPUT_CLS}
            placeholder="Rua, avenida ou quadra"
          />
        </InsiderField>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <InsiderField id="numero" label="Número">
            <input
              id="numero"
              type="text"
              value={form.numero}
              onChange={(e) => set('numero', e.target.value)}
              className={INPUT_CLS}
              placeholder="101"
            />
          </InsiderField>
          <InsiderField id="complemento" label="Complemento">
            <input
              id="complemento"
              type="text"
              value={form.complemento}
              onChange={(e) => set('complemento', e.target.value)}
              className={INPUT_CLS}
              placeholder="Apto, bloco (opcional)"
            />
          </InsiderField>
        </div>

        <div className="mt-4">
          <InsiderField id="bairro" label="Bairro">
            <input
              id="bairro"
              type="text"
              value={form.bairro}
              onChange={(e) => set('bairro', e.target.value)}
              className={INPUT_CLS}
              placeholder="Asa Norte"
            />
          </InsiderField>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_88px] gap-3">
          <InsiderField id="cidade" label="Cidade">
            <input
              id="cidade"
              type="text"
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
              className={INPUT_CLS}
              placeholder="Brasília"
            />
          </InsiderField>
          <InsiderField id="estado" label="UF">
            <input
              id="estado"
              type="text"
              value={form.estado}
              onChange={(e) => set('estado', maskUf(e.target.value))}
              className={INPUT_CLS}
              placeholder="DF"
            />
          </InsiderField>
        </div>
      </Reveal>

      <Reveal show={showTelefone}>
        <InsiderField id="telefone" label="WhatsApp">
          <input
            id="telefone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefone}
            onChange={(e) => set('telefone', maskPhone(e.target.value))}
            className={INPUT_CLS}
            placeholder="(61) 99999-9999"
          />
        </InsiderField>
      </Reveal>

      <Reveal show={showSexo}>
        <InsiderField id="sexo" label="Sexo">
          <select
            id="sexo"
            value={form.sexo}
            onChange={(e) => set('sexo', e.target.value)}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="">Selecione uma opção</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </InsiderField>
      </Reveal>

      <Reveal show={showFotoSenha}>
        <InsiderField id="foto" label="Foto do perfil">
          <div className="flex items-center gap-3">
            {(fotoPreview || fotoAtual) && (
              <Image
                src={fotoPreview || fotoAtual}
                alt="Prévia da foto de perfil"
                width={56}
                height={56}
                unoptimized
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            )}
            <input
              id="foto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => handleFoto(e.target.files?.[0] ?? null)}
              className="w-full text-sm text-[#737373] file:mr-3 file:rounded-full file:border-0 file:bg-[#0A0A0A] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white"
            />
          </div>
        </InsiderField>

        {temSenha && (
          <div className="mt-4">
            <InsiderField id="senha_atual" label="Senha atual">
              <input
                id="senha_atual"
                type="password"
                autoComplete="current-password"
                value={form.senha_atual}
                onChange={(e) => set('senha_atual', e.target.value)}
                className={INPUT_CLS}
                placeholder="Sua senha de acesso"
              />
            </InsiderField>
            <p className="mt-1.5 text-sm text-[#737373]">
              Confirme sua senha atual para salvar alterações no seu cadastro.
            </p>
          </div>
        )}

        <div className="mt-4">
          <InsiderField id="senha" label={temSenha ? 'Nova senha' : 'Senha de acesso'}>
            <input
              id="senha"
              type="password"
              autoComplete="new-password"
              value={form.senha}
              onChange={(e) => set('senha', e.target.value)}
              className={INPUT_CLS}
              placeholder="Mínimo de 8 caracteres"
            />
          </InsiderField>
          {temSenha && (
            <p className="mt-1.5 text-sm text-[#737373]">
              Deixe em branco para manter a senha atual.
            </p>
          )}
        </div>

        <div className="mt-4">
          <InsiderField id="senha_confirmacao" label="Confirme a senha">
            <input
              id="senha_confirmacao"
              type="password"
              autoComplete="new-password"
              value={form.senha_confirmacao}
              onChange={(e) => set('senha_confirmacao', e.target.value)}
              className={INPUT_CLS}
              placeholder="Repita a senha"
            />
          </InsiderField>
        </div>
      </Reveal>

      <Reveal show={showFinal}>
        <div className="space-y-2.5">
          <label htmlFor="consent_lgpd" className="flex items-center gap-2.5 text-sm text-[#737373]">
            <input
              id="consent_lgpd"
              type="checkbox"
              checked={consentLgpd}
              onChange={(e) => setConsentLgpd(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#FF2C03]"
            />
            <span>
              Li e aceito a{' '}
              <a
                href="https://sommaclub.com.br/politica-de-privacidade"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-[#FF2C03] underline"
              >
                Política de Privacidade
              </a>{' '}
              (LGPD).
            </span>
          </label>

          <label
            htmlFor="consent_imagem"
            className="flex items-center gap-2.5 text-sm text-[#737373]"
          >
            <input
              id="consent_imagem"
              type="checkbox"
              checked={consentImagem}
              onChange={(e) => setConsentImagem(e.target.checked)}
              className="h-5 w-5 shrink-0 accent-[#FF2C03]"
            />
            <span>Autorizo o uso da minha imagem.</span>
          </label>
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
        >
          {enviando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {lookupStatus === 'found' ? 'Salvar alterações' : 'Concluir cadastro'}
          {!enviando && <ArrowRight className="h-4 w-4" />}
        </button>
      </Reveal>

      {erro && (
        <p role="alert" className="mt-4 text-sm font-medium text-[#EF4444]">
          {erro}
        </p>
      )}
    </form>
  )
}
