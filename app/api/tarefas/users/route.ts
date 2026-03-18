import { NextResponse } from 'next/server'
import { getTeamUsers } from '@/lib/services/tarefas'

export async function GET() {
  const users = await getTeamUsers()
  return NextResponse.json(users)
}
