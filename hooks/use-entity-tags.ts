"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase-client"

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

export function useEntityTags(entityType: EntityType, entityId: string | null) {
  const [tags, setTags] = useState<EntityTag[]>([])
  const [tagDefinitions, setTagDefinitions] = useState<TagDefinition[]>([])
  const [loading, setLoading] = useState(false)

  // Buscar tags da entidade específica
  const fetchTags = useCallback(async () => {
    if (!entityId) return
    setLoading(true)
    const { data, error } = await supabase
      .from("entity_tags")
      .select("*")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .order("created_at", { ascending: true })

    if (!error) setTags(data || [])
    setLoading(false)
  }, [entityType, entityId])

  // Buscar definições de tags disponíveis
  const fetchTagDefinitions = useCallback(async () => {
    const { data } = await supabase
      .from("tag_definitions")
      .select("*")
      .order("tag", { ascending: true })
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

    const { error } = await supabase
      .from("entity_tags")
      .insert({ entity_type: entityType, entity_id: entityId, tag: cleanTag })

    if (!error) {
      await fetchTags()
      return true
    }
    return false
  }

  // Remover tag
  const removeTag = async (tagId: string): Promise<boolean> => {
    const { error } = await supabase
      .from("entity_tags")
      .delete()
      .eq("id", tagId)

    if (!error) {
      setTags((prev) => prev.filter((t) => t.id !== tagId))
      return true
    }
    return false
  }

  // Salvar nova definição de tag para autocompletar futuros usos
  const saveTagDefinition = async (tag: string, color = "blue") => {
    await supabase
      .from("tag_definitions")
      .insert({ tag: tag.trim().replace(/^#/, ""), color })
      .select()
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
    setLoading(true)
    supabase
      .from("entity_tags")
      .select("*")
      .ilike("tag", `%${tag}%`)
      .then(({ data }) => {
        setResults(data || [])
        setLoading(false)
      })
  }, [tag])

  return { results, loading }
}
