"use client"

import { useRef, useState } from 'react'
import Image from 'next/image'
import { Check, Loader2 } from 'lucide-react'
import { INPUT_CLS, InsiderField } from '@/components/insider/insider-form-ui'
import { useCepLookup } from '@/hooks/use-cep-lookup'
import {
  isValidBirthDate,
  maskCep,
  maskDate,
  maskPhone,
  maskUf,
  onlyDigits,
} from '@/lib/insider/validation'
import type { InsiderPublic } from '@/lib/insider/insider-mapper'

type Campos = {
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
}

export function PortalMeusDados({ insider }: { insider: InsiderPublic }) {
  const [form, setForm] = useState<Campos>({
    nome: insider.nome,
    email: insider.email,
    telefone: insider.telefone,
    data_nascimento: insider.data_nascimento,
    sexo: insider.sexo,
    cep: insider.cep,
    logradouro: insider.logradouro,
    numero: insider.numero,
    complemento: insider.complemento,
    bairro: insider.bairro,
    cidade: insider.cidade,
    estado: insider.estado,
  })
  const [foto, setFoto] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [salvo, setSalvo] = useState(false)

  const cep = useCepLookup()
  const ultimoCep = useRef(onlyDigits(insider.cep))

  const set = (campo: keyof Campos, valor: string) => {
    setForm((f) => ({ ...f, [campo]: valor }))
    setSalvo(false)
  }

  async function handleCepChange(valor: string) {
    const formatado = maskCep(valor)
    set('cep', formatado)

    const digits = onlyDigits(formatado)
    if (digits.length !== 8 || digits === ultimoCep.current) return

    ultimoCep.current = digits
    const endereco = await cep.buscar(digits)
    if (!endereco) {
      ultimoCep.current = ''
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

  function handleFoto(file: File | null) {
    setSalvo(false)
    if (file && file.size > 5 * 1024 * 1024) {
      setErro('A foto deve ter no máximo 5MB.')
      return
    }
    setErro(null)
    setFoto(file)
    setFotoPreview((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return file ? URL.createObjectURL(file) : ''
    })
  }

  async function salvar() {
    if (salvando) return
    setErro(null)

    if (!isValidBirthDate(form.data_nascimento)) {
      setErro('Data de nascimento inválida.')
      return
    }

    const payload = new FormData()
    Object.entries(form).forEach(([chave, valor]) => payload.append(chave, valor))
    if (foto) payload.append('foto', foto)

    setSalvando(true)
    try {
      const res = await fetch('/api/insiders/eu', { method: 'PUT', body: payload })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.error || 'Não foi possível salvar.')
      }
      setSalvo(true)
      setFoto(null)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível salvar.')
    } finally {
      setSalvando(false)
    }
  }

  const fotoMostrada = fotoPreview || insider.foto_url

  return (
    <div className="rounded-2xl bg-white p-6 shadow-lg md:p-8">
      <div className="flex items-center gap-4">
        {fotoMostrada ? (
          <Image
            src={fotoMostrada}
            alt="Sua foto de perfil"
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#FF2C03] text-lg font-semibold text-white">
            {iniciais(insider.nome)}
          </div>
        )}
        <div>
          <label
            htmlFor="foto_perfil"
            className="cursor-pointer text-sm font-medium text-[#FF2C03] underline"
          >
            Trocar foto
          </label>
          <input
            id="foto_perfil"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => handleFoto(e.target.files?.[0] ?? null)}
            className="sr-only"
          />
          <p className="mt-1 text-sm text-[#737373]">JPG, PNG ou WebP, até 5MB.</p>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <InsiderField id="md_nome" label="Nome completo">
          <input
            id="md_nome"
            type="text"
            autoComplete="name"
            value={form.nome}
            onChange={(e) => set('nome', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <InsiderField id="md_email" label="E-mail">
          <input
            id="md_email"
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="md_telefone" label="WhatsApp">
            <input
              id="md_telefone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={form.telefone}
              onChange={(e) => set('telefone', maskPhone(e.target.value))}
              className={INPUT_CLS}
              placeholder="(61) 99999-9999"
            />
          </InsiderField>
          <InsiderField id="md_nascimento" label="Data de nascimento">
            <input
              id="md_nascimento"
              type="text"
              inputMode="numeric"
              autoComplete="bday"
              value={form.data_nascimento}
              onChange={(e) => set('data_nascimento', maskDate(e.target.value))}
              className={INPUT_CLS}
              placeholder="DD/MM/AAAA"
            />
          </InsiderField>
        </div>

        <InsiderField id="md_sexo" label="Sexo">
          <select
            id="md_sexo"
            value={form.sexo}
            onChange={(e) => set('sexo', e.target.value)}
            className={`${INPUT_CLS} bg-white`}
          >
            <option value="">Selecione uma opção</option>
            <option value="masculino">Masculino</option>
            <option value="feminino">Feminino</option>
          </select>
        </InsiderField>

        <InsiderField id="md_cep" label="CEP">
          <input
            id="md_cep"
            type="text"
            inputMode="numeric"
            autoComplete="postal-code"
            value={form.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            className={INPUT_CLS}
            placeholder="00000-000"
          />
        </InsiderField>
        {cep.status === 'loading' && (
          <p className="text-sm text-[#737373]">Buscando endereço…</p>
        )}
        {cep.status === 'error' && (
          <p className="text-sm text-[#737373]">
            CEP não encontrado — preencha o endereço manualmente.
          </p>
        )}

        <InsiderField id="md_logradouro" label="Endereço">
          <input
            id="md_logradouro"
            type="text"
            autoComplete="address-line1"
            value={form.logradouro}
            onChange={(e) => set('logradouro', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-2 gap-3">
          <InsiderField id="md_numero" label="Número">
            <input
              id="md_numero"
              type="text"
              value={form.numero}
              onChange={(e) => set('numero', e.target.value)}
              className={INPUT_CLS}
            />
          </InsiderField>
          <InsiderField id="md_complemento" label="Complemento">
            <input
              id="md_complemento"
              type="text"
              value={form.complemento}
              onChange={(e) => set('complemento', e.target.value)}
              className={INPUT_CLS}
              placeholder="Apto, bloco (opcional)"
            />
          </InsiderField>
        </div>

        <InsiderField id="md_bairro" label="Bairro">
          <input
            id="md_bairro"
            type="text"
            value={form.bairro}
            onChange={(e) => set('bairro', e.target.value)}
            className={INPUT_CLS}
          />
        </InsiderField>

        <div className="grid grid-cols-[1fr_88px] gap-3">
          <InsiderField id="md_cidade" label="Cidade">
            <input
              id="md_cidade"
              type="text"
              value={form.cidade}
              onChange={(e) => set('cidade', e.target.value)}
              className={INPUT_CLS}
            />
          </InsiderField>
          <InsiderField id="md_estado" label="UF">
            <input
              id="md_estado"
              type="text"
              value={form.estado}
              onChange={(e) => set('estado', maskUf(e.target.value))}
              className={INPUT_CLS}
              placeholder="DF"
            />
          </InsiderField>
        </div>
      </div>

      {erro && <p role="alert" className="mt-4 text-sm font-medium text-[#EF4444]">{erro}</p>}

      <button
        type="button"
        onClick={salvar}
        disabled={salvando}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-[#FF2C03] px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-[#FB4C00] disabled:opacity-70"
      >
        {salvando ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
        {salvo && !salvando ? <Check className="h-5 w-5" /> : null}
        {salvo && !salvando ? 'Dados salvos' : 'Salvar alterações'}
      </button>
    </div>
  )
}

function iniciais(nome: string): string {
  const partes = String(nome ?? '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  const primeira = partes[0][0] ?? ''
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] ?? '' : ''
  return (primeira + ultima).toUpperCase()
}
