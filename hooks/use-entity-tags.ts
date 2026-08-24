"use client"

import { useState, useEffect, useCallback } from "react"
import { apiFetch } from "@/lib/api-client"

export type EntityType = "asaas_customer" | "lista_espera" | "cobranca" | "membro" | "professor_client"

export interface EntityTag {
  id: string
  entity_type: EntityType
  entity_id: string
  tag: string
  created_at: string
}

export interface TagDefinition {
  id: string
  tag: string
  color: string
}

// As tags passam por /api/entity-tags (sessão obrigatória) em vez do client
// anon do Supabase: entity_tags e tag_definitions só aceitam service_role
// desde sql/021-harden-legacy-rls.sql.
async function getJson<T>(url: string): Promise<T | null> {
  try {
    const res = await apiFetch(url)
    if (!res.ok) return null
    const body = await res.json()
    return (body?.data ?? null) as T | null
  } catch {
    return null
  }
}

export function useEntityTags(entityType: EntityType, entityId: string | null) {
  const [tags, setTags] = useState<EntityTag[]>([])
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([])
  const [loading, setLoading] = useState(false)

  // Buscar tags da entidade específica
  const fetchTags = useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    const data = await getJson<EntityTag[]>(
      `/api/entity-tags?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}`
    )
    if (data) setTags(data)
    setLoading(false)
  }, [entityType, entityId])

  // Buscar definições de tags disponíveis
  const fetchTagDefinitions = useCallback(async () => {
    const data = await getJson<TagDefinition[]>('/api/entity-tags/definitions')
    if (data) setTagDefinitions(data)
  }, [])

  useEffect(() => {
    fetchTags()
    fetchTagDefinitions()
  }, [fetchTags, fetchTagDefinitions])

  // Adicionar tag
  const addTag = async (tag: string): Promise<boolean> => {
    if (!entityId || !tag.trim()) return false
    const cleanTag = tag.trim().replace(/^#/, "")

    const res = await apiFetch('/api/entity-tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entity_type: entityType, entity_id: entityId, tag: cleanTag }),
    })

    if (res.ok) {
      await fetchTags()
      return true
    }
    return false
  }

  // Remover tag
  const removeTag = async (tagId: string): Promise<boolean> => {
    const res = await apiFetch(`/api/entity-tags?id=${encodeURIComponent(tagId)}`, {
      method: 'DELETE',
    })

    if (res.ok) {
      setTags((prev) => prev.filter((t) => t.id !== tagId))
      return true
    }
    return false
  }

  // Salvar nova definição de tag para autocompletar futuros usos
  const saveTagDefinition = async (tag: string, color = "blue") => {
    await apiFetch('/api/entity-tags/definitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag: tag.trim().replace(/^#/, ""), color }),
    })
    fetchTagDefinitions()
  }

  return { tags, tagDefinitions, loading, addTag, removeTag, saveTagDefinition, refetch: fetchTags }
}

// Hook para buscar todas as entidades por tag (busca cruzada)
export function useTagSearch(tag: string | null) {
  const [results, setResults] = useState<EntityTag[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!tag) { setResults([]); return }
    let cancelado = false
    setLoading(true)
    getJson<EntityTag[]>(`/api/entity-tags?tag=${encodeURIComponent(tag)}`).then((data) => {
      if (cancelado) return
      setResults(data || [])
      setLoading(false)
    })
    return () => { cancelado = true }
  }, [tag])

  return { results, loading }
}
