"use client"

import { useState } from "react"
import { X, Tag, Plus, Loader2 } from "lucide-react"
import { useEntityTags, type EntityType } from "@/hooks/use-entity-tags"

const TAG_COLORS: Record<string, string> = {
  alunoprofessor: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  alunosomma: "bg-orange-500/20 text-orange-300 border-orange-500/40",
}

const DEFAULT_TAG_COLOR = "bg-neutral-500/20 text-neutral-300 border-neutral-500/40"

function getTagColor(tag: string) {
  return TAG_COLORS[tag.toLowerCase()] || DEFAULT_TAG_COLOR
}

interface TagManagerProps {
  entityType: EntityType
  entityId: string
  compact?: boolean // modo compacto para usar dentro de linhas de tabela
}

export function TagManager({ entityType, entityId, compact = false }: TagManagerProps) {
  const { tags, tagDefinitions, loading, addTag, removeTag, saveTagDefinition } = useEntityTags(entityType, entityId)
  const [showInput, setShowInput] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [saving, setSaving] = useState(false)

  const PRESET_TAGS = ["alunoprofessor", "alunosomma"]

  const handleAddPreset = async (tag: string) => {
    setSaving(true)
    await addTag(tag)
    setSaving(false)
  }

  const handleAddCustom = async () => {
    if (!inputValue.trim()) return
    setSaving(true)
    const tag = inputValue.trim().replace(/^#/, "")
    const ok = await addTag(tag)
    if (ok) {
      await saveTagDefinition(tag)
      setInputValue("")
      setShowInput(false)
    }
    setSaving(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAddCustom()
    if (e.key === "Escape") { setShowInput(false); setInputValue("") }
  }

  const existingTagNames = tags.map((t) => t.tag.toLowerCase())

  // Lista de sugestões: pré-definidas + customizadas salvas, excluindo as que já existem
  const suggestions = [
    ...PRESET_TAGS,
    ...tagDefinitions.map((d) => d.tag).filter((t) => !PRESET_TAGS.includes(t)),
  ].filter((t) => !existingTagNames.includes(t.toLowerCase()))

  if (compact) {
    return (
      <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
        {loading ? (
          <Loader2 className="w-3 h-3 text-neutral-500 animate-spin" />
        ) : (
          <>
            {tags.map((t) => (
              <span
                key={t.id}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs border ${getTagColor(t.tag)}`}
              >
                #{t.tag}
                <button
                  onClick={(e) => { e.stopPropagation(); removeTag(t.id) }}
                  className="opacity-60 hover:opacity-100"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <div className="relative">
              {showInput ? (
                <input
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={() => { if (!inputValue) setShowInput(false) }}
                  placeholder="#tag"
                  className="w-20 text-xs bg-neutral-700 border border-neutral-600 text-white rounded px-1.5 py-0.5 outline-none"
                />
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowInput(true) }}
                  className="p-0.5 rounded text-neutral-500 hover:text-neutral-300 hover:bg-neutral-700"
                  title="Adicionar tag"
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Tag className="w-4 h-4 text-neutral-400" />
        <span className="text-sm font-medium text-white">Tags</span>
      </div>

      {/* Tags existentes */}
      <div className="flex flex-wrap gap-2">
        {loading ? (
          <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
        ) : tags.length === 0 ? (
          <span className="text-xs text-neutral-500">Nenhuma tag adicionada</span>
        ) : (
          tags.map((t) => (
            <span
              key={t.id}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border ${getTagColor(t.tag)}`}
            >
              #{t.tag}
              <button
                onClick={() => removeTag(t.id)}
                className="opacity-60 hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))
        )}
      </div>

      {/* Sugestões de tags */}
      {suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-neutral-500">Adicionar tag:</p>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((tag) => (
              <button
                key={tag}
                onClick={() => handleAddPreset(tag)}
                disabled={saving}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border border-neutral-600 text-neutral-400 hover:border-neutral-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <Plus className="w-2.5 h-2.5" />#{tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input para nova tag personalizada */}
      <div className="flex gap-2 items-center">
        {showInput ? (
          <>
            <input
              autoFocus
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite uma nova tag..."
              className="flex-1 text-sm bg-neutral-700 border border-neutral-600 text-white rounded px-3 py-1.5 outline-none focus:border-neutral-400"
            />
            <button
              onClick={handleAddCustom}
              disabled={saving || !inputValue.trim()}
              className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : "Salvar"}
            </button>
            <button
              onClick={() => { setShowInput(false); setInputValue("") }}
              className="px-2 py-1.5 text-xs text-neutral-400 hover:text-white"
            >
              <X className="w-3 h-3" />
            </button>
          </>
        ) : (
          <button
            onClick={() => setShowInput(true)}
            className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-300 transition-colors"
          >
            <Plus className="w-3 h-3" />
            Nova tag personalizada
          </button>
        )}
      </div>
    </div>
  )
}
