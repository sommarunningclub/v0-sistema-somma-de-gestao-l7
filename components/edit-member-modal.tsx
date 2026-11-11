"use client"

import type React from "react"
import { useId, useMemo, useState } from "react"
import { AlertCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ResponsiveModal, SectionTitle, confirmAction, notify } from "@/components/somma"
import { updateMember, deleteMember } from "@/lib/services/members"
import type { CadastroSite } from "@/lib/supabase-client"
import { maskCep, maskCpf } from "@/lib/insider/validation"
import {
  OPCOES_SEXO,
  diferencas,
  formatarCpf,
  mascararTelefone,
  normalizarAlteracoes,
  paraFormulario,
  type CampoEditavel,
  type FormularioMembro,
} from "@/lib/membros/campos"

interface EditMemberModalProps {
  member: CadastroSite
  onClose: () => void
  onSave: (atualizado?: CadastroSite) => void
}

/**
 * Edição do cadastro completo do membro — todas as colunas de `cadastro_site`.
 *
 * Só os campos alterados vão para o servidor. A base mistura formatos antigos
 * (WhatsApp só com dígitos, nascimento em DD/MM/AAAA); reenviar tudo
 * reescreveria esses valores sem ninguém ter pedido.
 */
export function EditMemberModal({ member, onClose, onSave }: EditMemberModalProps) {
  const formId = useId()
  const inicial = useMemo(() => paraFormulario(member), [member])
  const [formData, setFormData] = useState<FormularioMembro>(inicial)
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [campoComErro, setCampoComErro] = useState<CampoEditavel | null>(null)

  const busy = loading || deleting
  const alterados = diferencas(inicial, formData)
  const qtdAlterados = Object.keys(alterados).length

  // Valores que a tela não consegue mostrar no campo (formato antigo/ilegível).
  // Ficam visíveis como dica, e só mudam se a pessoa preencher o campo.
  const nascimentoIlegivel = !inicial.data_nascimento && (member.data_nascimento ?? "").trim()
  const cadastroIlegivel = !inicial.data_de_cadastro && (member.data_de_cadastro ?? "").trim()
  const sexoForaDaLista =
    inicial.sexo && !OPCOES_SEXO.some((o) => o.valor === inicial.sexo) ? inicial.sexo : null

  const atualizar = (campo: CampoEditavel, valor: string) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }))
    if (campoComErro === campo) {
      setCampoComErro(null)
      setError(null)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const campo = e.target.name as CampoEditavel
    const { value } = e.target
    if (campo === "cpf") return atualizar(campo, maskCpf(value))
    if (campo === "whatsapp") return atualizar(campo, mascararTelefone(value))
    if (campo === "cep") return atualizar(campo, maskCep(value))
    atualizar(campo, value)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return

    setError(null)
    setCampoComErro(null)

    if (qtdAlterados === 0) {
      notify.info("Nada para salvar", { description: "Nenhum campo foi alterado." })
      onClose()
      return
    }

    // Mesma regra que o servidor aplica: o erro aparece antes de ir à rede.
    const previa = normalizarAlteracoes(alterados)
    if (!previa.ok) {
      setError(previa.erro)
      setCampoComErro(previa.campo)
      return
    }

    setLoading(true)
    try {
      const atualizado = await updateMember(member.id, alterados)
      notify.success("Membro atualizado", {
        description: `${qtdAlterados} ${qtdAlterados === 1 ? "campo salvo" : "campos salvos"} de ${
          atualizado?.nome_completo ?? formData.nome_completo.trim()
        }.`,
      })
      onSave(atualizado)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar as alterações")
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (busy) return

    const confirmed = await confirmAction({
      title: "Excluir membro?",
      description:
        "O cadastro será removido permanentemente da base. Esta ação não pode ser desfeita e o histórico do membro deixa de aparecer nas listagens.",
      detail: `${member.nome_completo} — ID ${member.id}`,
      tone: "danger",
      confirmLabel: "Excluir membro",
    })
    if (!confirmed) return

    setError(null)
    setDeleting(true)
    try {
      await deleteMember(member.id)
      notify.success("Membro excluído", { description: `${member.nome_completo} foi removido da base.` })
      onSave()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao deletar membro")
    } finally {
      setDeleting(false)
    }
  }

  const campo = (
    nome: CampoEditavel,
    rotulo: string,
    props: React.ComponentProps<typeof Input> = {},
    dica?: React.ReactNode,
  ) => (
    <div>
      <label htmlFor={`${formId}-${nome}`} className="ds-label mb-1.5 flex items-center gap-2">
        {rotulo}
        {nome in alterados ? <span className="text-xs font-normal text-brand">alterado</span> : null}
      </label>
      <Input
        id={`${formId}-${nome}`}
        name={nome}
        value={formData[nome]}
        onChange={handleInputChange}
        disabled={busy}
        aria-invalid={campoComErro === nome ? true : undefined}
        {...props}
      />
      {dica ? <p className="mt-1 text-xs text-ink-muted">{dica}</p> : null}
    </div>
  )

  return (
    <ResponsiveModal
      open
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
      title="Editar membro"
      description={`${member.nome_completo} · ID ${member.id}`}
      size="lg"
      dismissible={!busy}
      footer={
        <>
          <Button
            type="button"
            variant="destructive"
            onClick={handleDelete}
            loading={deleting}
            disabled={loading}
            block
            className="sm:mr-auto sm:w-auto"
          >
            <Trash2 aria-hidden="true" />
            Excluir
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={busy} block className="sm:w-auto">
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={loading} disabled={deleting} block className="sm:w-auto">
            {qtdAlterados > 0 ? `Salvar alterações (${qtdAlterados})` : "Salvar alterações"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSave} className="space-y-6" noValidate>
        {error ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-danger-border bg-danger-soft p-3 text-sm text-danger"
          >
            <AlertCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <section>
          <SectionTitle title="Identificação" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {campo("nome_completo", "Nome completo", { autoComplete: "off", placeholder: "Nome completo" })}
            </div>

            {campo(
              "cpf",
              "CPF",
              {
                inputMode: "numeric",
                autoComplete: "off",
                placeholder: "000.000.000-00",
                maxLength: 14,
                className: "font-mono tabular-nums",
              },
              "O CPF é único: não pode ser o de outro membro.",
            )}

            {campo(
              "data_nascimento",
              "Data de nascimento",
              { type: "date", autoComplete: "off" },
              nascimentoIlegivel ? `Valor atual no cadastro: "${nascimentoIlegivel}" (formato não reconhecido).` : null,
            )}

            <div>
              <label htmlFor={`${formId}-sexo`} className="ds-label mb-1.5 flex items-center gap-2">
                Sexo
                {"sexo" in alterados ? <span className="text-xs font-normal text-brand">alterado</span> : null}
              </label>
              <select
                id={`${formId}-sexo`}
                name="sexo"
                value={formData.sexo}
                onChange={handleInputChange}
                disabled={busy}
                aria-invalid={campoComErro === "sexo" ? true : undefined}
                className="flex h-11 w-full rounded-lg border border-line bg-surface-sunken px-3.5 text-base text-ink transition-colors hover:border-line-strong focus-visible:border-brand focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-50 lg:h-10 lg:text-sm"
              >
                <option value="">Não informado</option>
                {OPCOES_SEXO.map((o) => (
                  <option key={o.valor} value={o.valor}>
                    {o.rotulo}
                  </option>
                ))}
                {sexoForaDaLista ? (
                  <option value={sexoForaDaLista}>{`"${sexoForaDaLista}" (valor antigo)`}</option>
                ) : null}
              </select>
            </div>
          </div>
        </section>

        <section>
          <SectionTitle title="Contato" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {campo("email", "E-mail", {
                type: "email",
                inputMode: "email",
                autoComplete: "off",
                autoCapitalize: "none",
                spellCheck: false,
                placeholder: "email@exemplo.com",
              })}
            </div>

            {campo("whatsapp", "WhatsApp", {
              type: "tel",
              inputMode: "tel",
              autoComplete: "off",
              placeholder: "(00) 00000-0000",
              maxLength: 15,
              className: "font-mono tabular-nums",
            })}

            {campo("cep", "CEP", {
              inputMode: "numeric",
              autoComplete: "off",
              placeholder: "00000-000",
              maxLength: 9,
              className: "font-mono tabular-nums",
            })}
          </div>
        </section>

        <section>
          <SectionTitle title="Registro" as="h3" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              {campo(
                "data_de_cadastro",
                "Data de cadastro",
                { type: "datetime-local", autoComplete: "off" },
                cadastroIlegivel
                  ? `Valor atual no cadastro: "${cadastroIlegivel}" (formato não reconhecido).`
                  : "Horário de Brasília.",
              )}
            </div>

            <div>
              <p className="ds-label mb-1.5">ID</p>
              <p className="flex h-11 items-center rounded-lg border border-line bg-surface-sunken px-3.5 font-mono text-sm tabular-nums text-ink-muted lg:h-10">
                {member.id}
              </p>
            </div>

            <div>
              <p className="ds-label mb-1.5">CPF normalizado</p>
              <p className="flex h-11 items-center rounded-lg border border-line bg-surface-sunken px-3.5 font-mono text-sm tabular-nums text-ink-muted lg:h-10">
                {(member.cpf_digits ?? "").trim() || formatarCpf(member.cpf).replace(/\D/g, "") || "—"}
              </p>
              <p className="mt-1 text-xs text-ink-muted">Gerado pelo banco a partir do CPF.</p>
            </div>
          </div>
        </section>
      </form>
    </ResponsiveModal>
  )
}
