import { NextResponse, type NextRequest } from 'next/server'
import { ErroNps } from '@/lib/services/nps'
import { uuidSchema } from './validacao'

/** Respostas do módulo carregam nome de aluno: nunca em cache. */
export function json(corpo: unknown, status = 200): NextResponse {
  return NextResponse.json(corpo, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function respostaDeErro(err: unknown, contexto: string): NextResponse {
  if (err instanceof ErroNps) return json({ error: err.message }, err.status)
  console.error(`[nps] ${contexto}:`, err)
  return json({ error: 'Erro inesperado. Tente de novo em instantes.' }, 500)
}

export async function lerJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json()
  } catch {
    return undefined
  }
}

export function idValido(id: string): boolean {
  return uuidSchema.safeParse(id).success
}

export const ID_INVALIDO = { error: 'Identificador inválido.' }
