export interface ModulePermissions {
  dashboard: boolean
  checkin: boolean
  escala: boolean
  membros: boolean
  parceiro: boolean
  pagamentos: boolean
  crm: boolean
  tarefas: boolean
  popups: boolean
  email: boolean
  vagas: boolean
  pdv: boolean
  pixAutomatico: boolean
  nps: boolean
  novaAssessoria: boolean
  admin: boolean
}

export interface SessionPayload {
  sub: string
  email: string
  full_name: string
  role: string
  permissions: ModulePermissions | null
  exp: number
  /**
   * Segunda etapa (Google Authenticator) concluída. Sessão sem isso é
   * recusada: inclusive os cookies emitidos antes do 2FA existir, o que força
   * todo mundo a passar pelo cadastro do autenticador no próximo acesso.
   */
  mfa?: true
}

export type PermissionKey = keyof ModulePermissions
