import { supabase, type CadastroSite } from "@/lib/supabase-client"

const PAGE_SIZE = 50 // Reduzido para carregamento mais rápido

// Buscar membros com paginação
export async function getMembers(page: number = 0): Promise<CadastroSite[]> {
  try {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1

    const { data, error } = await supabase
      .from("cadastro_site")
      .select("id, nome_completo, email, cpf, whatsapp, data_nascimento")
      .order("id", { ascending: false })
      .range(start, end)

    if (error) {
      console.error("[v0] Erro ao buscar membros página", page, ":", error)
      return []
    }

    return data || []
  } catch (err) {
    console.error("[v0] Erro inesperado ao buscar membros:", err)
    return []
  }
}

// Contar total de membros para paginação
export async function getMembersCount(): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("cadastro_site")
      .select("*", { count: "exact", head: true })

    if (error) {
      console.error("[v0] Erro ao contar membros:", error)
      return 0
    }

    return count || 0
  } catch (err) {
    console.error("[v0] Erro inesperado ao contar membros:", err)
    return 0
  }
}

// Buscar um único membro
export async function getMemberById(id: number): Promise<CadastroSite | null> {
  try {
    const { data, error } = await supabase
      .from("cadastro_site")
      .select("*")
      .eq("id", id)
      .single()

    if (error) {
      console.error("[v0] Erro ao buscar membro:", error)
      return null
    }

    return data
  } catch (err) {
    console.error("[v0] Erro inesperado ao buscar membro:", err)
    return null
  }
}

// Buscar membros por termo de busca (otimizado)
export async function searchMembers(searchTerm: string, page: number = 0): Promise<CadastroSite[]> {
  if (!searchTerm.trim()) {
    return getMembers(page)
  }

  try {
    const start = page * PAGE_SIZE
    const end = start + PAGE_SIZE - 1
    const lowerSearch = searchTerm.toLowerCase()

    // Tentar buscar por email ou nome (mais eficiente)
    const { data, error } = await supabase
      .from("cadastro_site")
      .select("id, nome_completo, email, cpf, whatsapp, data_nascimento")
      .or(
        `nome_completo.ilike.%${lowerSearch}%,email.ilike.%${lowerSearch}%,cpf.ilike.%${lowerSearch}%`
      )
      .order("id", { ascending: false })
      .range(start, end)

    if (error) {
      console.error("[v0] Erro ao buscar membros:", error)
      return []
    }

    return data || []
  } catch (err) {
    console.error("[v0] Erro inesperado ao buscar membros:", err)
    return []
  }
}

// Atualizar membro
export async function updateMember(
  id: number,
  updates: Partial<CadastroSite>
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("cadastro_site")
      .update(updates)
      .eq("id", id)

    if (error) {
      console.error("[v0] Erro ao atualizar membro:", error)
      return false
    }

    console.log("[v0] Membro atualizado com sucesso:", id)
    return true
  } catch (err) {
    console.error("[v0] Erro inesperado ao atualizar membro:", err)
    return false
  }
}

// Deletar membro
export async function deleteMember(id: number): Promise<boolean> {
  try {
    const { error } = await supabase
      .from("cadastro_site")
      .delete()
      .eq("id", id)

    if (error) {
      console.error("[v0] Erro ao deletar membro:", error)
      return false
    }

    console.log("[v0] Membro deletado com sucesso:", id)
    return true
  } catch (err) {
    console.error("[v0] Erro inesperado ao deletar membro:", err)
    return false
  }
}

export const PAGE_SIZE_EXPORT = PAGE_SIZE
