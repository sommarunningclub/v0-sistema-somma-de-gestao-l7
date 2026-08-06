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
  admin: boolean
}

export interface SessionPayload {
  sub: string
  email: string
  full_name: string
  role: string
  permissions: ModulePermissions | null
  exp: number
}

export type PermissionKey = keyof ModulePermissions
