"use client"

import type React from "react"
import { useId, useState } from "react"
import { Loader2, Plus, Tag, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { SectionTitle, Skeleton, notify } from "@/components/somma"
import { cn } from "@/lib/utils"
import { useEntityTags, type EntityType } from "@/hooks/use-entity-tags"

const TAG_TONES: Record<string, string> = {
  alunoprofessor: "border-info-border bg-info-soft text-info",
  alunosomma: "border-brand-border bg-brand-soft text-brand-strong",
}

const DEFAULT_TAG_TONE = "border-line bg-surface-hover text-ink"

function getTagTone(tag: string) {
  return TAG_TONES[tag.toLowerCase()] || DEFAULT_TAG_TONE
}

interface TagManagerProps {
  entityType: EntityType
  entityId: string
  compact?: boolean // modo compacto para usar dentro de linhas de tabela
}

const PRESET_TAGS = ["alunoprofessor", "alunosomma"]

export function TagManager({ entityType, entityId, compact = false }: TagManagerProps) {
  const { tags, tagDefinitions, loading, addTag, removeTag, saveTagDefinition } = useEntityTags(entityType, entityId)
  const inputId = useId()
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [saving, setSaving] = useState(false)

  const handleAddPreset = async (tag: string) => {
    if (saving) return
    setSaving(true)
    const ok = await addTag(tag)
    setSaving(false)
    if (ok) {
      notify.success(`Tag #${tag} adicionada`)
    } else {
      notify.error(`Não foi possível adicionar a tag #${tag}`)
    }
  }

  const handleAddCustom = async () => {
    if (!inputValue.trim() || saving) return
    setSaving(true)
    const tag = inputValue.trim().replace(/^#/, "")
    const ok = await addTag(tag)
    if (ok) {
      await saveTagDefinition(tag)
      setInputValue("")
      setShowInput(false)
      notify.success(`Tag #${tag} criada`)
    } else {
      notify.error(`Não foi possível criar a tag #${tag}`)
    }
    setSaving(false)
  }

  const handleRemove = async (id: string, tag: string) => {
    const ok = await removeTag(id)
    if (ok === false) {
      notify.error(`Não foi possível remover a tag #${tag}`)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleAddCustom()
    }
    if (e.key === "Escape") {
      setShowInput(false)
      setInputValue("")
    }
  }

  const existingTagNames = tags.map((t) => t.tag.toLowerCase())

  const suggestions = [
    ...PRESET_TAGS,
    ...tagDefinitions.map((d) => d.tag).filter((t) => !PRESET_TAGS.includes(t)),
  ].filter((t) => !existingTagNames.includes(t.toLowerCase()))

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <Skeleton className="h-5 w-16 rounded-full" />
        ) : (
          <>
            {tags.map((t) => (
              <span
                key={t.id}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6875rem] font-semibold",
                  getTagTone(t.tag),
                )}
              >
                #{t.tag}
                <button
                  type="button"
                  aria-label={`Remover tag ${t.tag}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(t.id, t.tag)
                  }}
                  className="opacity-60 transition-opacity hover:opacity-100"
                >
                  <X aria-hidden="true" className="h-2.5 w-2.5" />
                </button>
              </span>
            ))}
            {showInput ? (
              <input
                autoFocus
                aria-label="Nova tag"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!inputValue) setShowInput(false)
                }}
                placeholder="#tag"
                className="w-24 rounded-md border border-line bg-surface-sunken px-2 py-1 text-xs text-ink outline-none focus-visible:border-brand"
              />
            ) : (
              <button
                type="button"
                aria-label="Adicionar tag"
                onClick={(e) => {
                  e.stopPropagation()
                  setShowInput(true)
                }}
                className="rounded-md p-1 text-ink-subtle transition-colors hover:bg-surface-hover hover:text-ink"
              >
                <Plus aria-hidden="true" className="h-3 w-3" />
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <section aria-label="Tags do registro" className="space-y-3">
      <SectionTitle
        title={
          <span className="inline-flex items-center gap-2">
            <Tag aria-hidden="true" className="h-4 w-4 text-brand" />
            Tags
          </span>
        }
        as="h3"
        meta={tags.length > 0 ? `${tags.length} aplicada${tags.length > 1 ? "s" : ""}` : undefined}
        className="mb-0"
      />

      <div className="flex flex-wrap gap-2" aria-busy={loading || undefined}>
        {loading ? (
          <>
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </>
        ) : tags.length === 0 ? (
          <p className="text-meta text-ink-subtle">Nenhuma tag adicionada</p>
        ) : (
          tags.map((t) => (
            <span
              key={t.id}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
                getTagTone(t.tag),
              )}
            >
              #{t.tag}
              <button
                type="button"
                aria-label={`Remover tag ${t.tag}`}
                onClick={() => handleRemove(t.id, t.tag)}
                className="flex h-4 w-4 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {suggestions.length > 0 ? (
        <div className="space-y-1.5">
          <p className="ds-eyebrow">Adicionar tag</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => handleAddPreset(tag)}
                disabled={saving}
                className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-muted transition-colors hover:border-line-strong hover:text-ink-strong disabled:opacity-50"
              >
                <Plus aria-hidden="true" className="h-3 w-3" />#{tag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {showInput ? (
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            Nova tag personalizada
          </label>
          <Input
            id={inputId}
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite uma nova tag..."
            className="flex-1"
          />
          <Button type="button" size="sm" onClick={handleAddCustom} disabled={saving || !inputValue.trim()}>
            {saving ? <Loader2 aria-hidden="true" className="animate-spin" /> : null}
            Salvar
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Cancelar nova tag"
            onClick={() => {
              setShowInput(false)
              setInputValue("")
            }}
          >
            <X aria-hidden="true" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="ghost" size="sm" onClick={() => setShowInput(true)}>
          <Plus aria-hidden="true" />
          Nova tag personalizada
        </Button>
      )}
    </section>
  )
}
