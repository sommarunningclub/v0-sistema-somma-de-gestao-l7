import { apiFetch } from "@/lib/api-client"
import { MEMBROS_PAGE_SIZE } from "@/lib/api/writable-fields"
import type { CadastroSite } from "@/lib/supabase-client"

// As consultas passam pelas rotas /api/membros, que rodam no servidor com
// service role. O cliente Supabase do browser usa a anon key e a RLS de
// `cadastro_site` esconde todas as linhas dela — o resultado era uma lista
// vazia sem nenhum erro, e update/delete viravam no-op silencioso.

const PAGE_SIZE = MEMBROS_PAGE_SIZE // mesma constante usada pela rota

async function readJson(res: Response): Promise<any> {
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body?.error || `Falha na requisição (HTTP ${res.status})`)
  }
  return body
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value))
  }
  return search.toString()
}

// Buscar membros com paginação
export async function getMembers(page: number = 0): Promise<CadastroSite[]> {
  const res = await apiFetch(`/api/membros?${buildQuery({ page })}`)
  const body = await readJson(res)
  return body.data || []
}

// Contar total de membros para paginação
export async function getMembersCount(): Promise<number> {
  const res = await apiFetch(`/api/membros?countOnly=1`)
  const body = await readJson(res)
  return body.count || 0
}

// Buscar um único membro
export async function getMemberById(id: number): Promise<CadastroSite | null> {
  const res = await apiFetch(`/api/membros/${id}`)
  if (res.status === 404) return null
  const body = await readJson(res)
  return body.data ?? null
}

// Buscar membros por termo de busca
export async function searchMembers(searchTerm: string, page: number = 0): Promise<CadastroSite[]> {
  if (!searchTerm.trim()) {
    return getMembers(page)
  }

  const res = await apiFetch(`/api/membros?${buildQuery({ page, q: searchTerm.trim() })}`)
  const body = await readJson(res)
  return body.data || []
}

// Criar membro
export async function createMember(member: Omit<CadastroSite, "id">): Promise<CadastroSite> {
  const res = await apiFetch("/api/membros", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(member),
  })
  const body = await readJson(res)
  return body.data
}

// Atualizar membro
export async function updateMember(
  id: number,
  updates: Partial<CadastroSite>
): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/membros/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    await readJson(res)
    return true
  } catch (err) {
    console.error("[membros] Erro ao atualizar membro:", err)
    return false
  }
}

// Deletar membro
export async function deleteMember(id: number): Promise<boolean> {
  try {
    const res = await apiFetch(`/api/membros/${id}`, { method: "DELETE" })
    await readJson(res)
    return true
  } catch (err) {
    console.error("[membros] Erro ao deletar membro:", err)
    return false
  }
}

export const PAGE_SIZE_EXPORT = PAGE_SIZE
