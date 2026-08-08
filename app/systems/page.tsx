'use client'

import * as React from 'react'
import { KeyRound, Layers, Plus, ShieldCheck, Trash2, UserCog, Users } from 'lucide-react'

import { apiFetch } from '@/lib/api-client'
import { searchAndRank } from '@/lib/search-utils'
import { NAV_GROUPS, NAV_ITEMS, type NavGroupId } from '@/lib/nav'
import type { ModulePermissions, PermissionKey } from '@/lib/auth/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ErrorBanner } from '@/components/ui/error-banner'
import {
  Avatar,
  CardListSkeleton,
  EmptyState,
  MobileRecordCard,
  NoResultsState,
  Panel,
  PageHeader,
  PageShell,
  ResponsiveModal,
  SearchInput,
  StatGrid,
  StatGridSkeleton,
  StatTile,
  StatusPill,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TableSkeleton,
  Toolbar,
  Well,
  confirmAction,
  notify,
} from '@/components/somma'

/**
 * Administração — usuários, papéis e permissões.
 *
 * A decisão de projeto central desta tela é tornar visível o que antes era
 * implícito: quais MÓDULOS cada permissão realmente libera. As chaves gravadas
 * no banco (`pagamentos`, `checkin`) não correspondem ao nome do módulo que
 * abrem (Insiders; Check-in *e* Eventos), então os rótulos são derivados de
 * `lib/nav.ts` — a mesma fonte que monta a navegação. Renomear as chaves
 * quebraria sessões e middleware; renomear o que se lê na tela, não.
 */

const ROLES = [
  { value: 'user', label: 'Usuário', hint: 'Acessa apenas os módulos liberados abaixo' },
  { value: 'manager', label: 'Gerenciador', hint: 'Acessa apenas os módulos liberados abaixo' },
  { value: 'admin', label: 'Administrador', hint: 'Acesso total a todos os módulos' },
] as const

const ROLE_LABEL: Record<string, string> = {
  user: 'Usuário',
  manager: 'Gerenciador',
  admin: 'Administrador',
}

interface User {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  permissions: ModulePermissions | null
}

const DEFAULT_PERMISSIONS: ModulePermissions = {
  dashboard: true,
  checkin: false,
  escala: false,
  membros: false,
  parceiro: false,
  pagamentos: false,
  crm: false,
  tarefas: false,
  popups: false,
  admin: false,
}

const ALL_PERMISSIONS: ModulePermissions = {
  dashboard: true,
  checkin: true,
  escala: true,
  membros: true,
  parceiro: true,
  pagamentos: true,
  crm: true,
  tarefas: true,
  popups: true,
  admin: true,
}

interface PermissionRow {
  key: PermissionKey
  /** Nomes dos módulos que esta chave libera — pode ser mais de um. */
  modules: string[]
  description: string
  group: NavGroupId
}

/**
 * Uma linha por permissão, com os módulos que ela abre. Derivado de `NAV_ITEMS`
 * para que um módulo novo apareça aqui sozinho.
 */
const PERMISSION_ROWS: PermissionRow[] = (() => {
  const byKey = new Map<PermissionKey, PermissionRow>()
  for (const item of NAV_ITEMS) {
    const row = byKey.get(item.permission)
    if (row) {
      row.modules.push(item.label)
    } else {
      byKey.set(item.permission, {
        key: item.permission,
        modules: [item.label],
        description: item.description,
        group: item.group,
      })
    }
  }
  return Array.from(byKey.values())
})()

const PERMISSION_GROUPS = NAV_GROUPS.map((group) => ({
  id: group.id,
  label: group.label || 'Geral',
  rows: PERMISSION_ROWS.filter((row) => row.group === group.id),
})).filter((group) => group.rows.length > 0)

const TOTAL_MODULES = NAV_ITEMS.length

/** Quantos módulos da navegação o usuário enxerga com as permissões atuais. */
function countModules(permissions: ModulePermissions | null, role: string): number {
  if (role === 'admin') return TOTAL_MODULES
  if (!permissions) return 0
  return NAV_ITEMS.filter((item) => permissions[item.permission]).length
}

function moduleLabelOf(row: PermissionRow): string {
  return row.modules.join(' e ')
}

// ---------------------------------------------------------------------------

/**
 * Matriz de permissões: uma linha por permissão, agrupada como a navegação.
 * Quando o papel é `admin` os switches ficam travados em "liberado" — o bypass
 * acontece na sessão (`lib/auth/session.ts`) e antes disso era invisível aqui,
 * o que fazia o administrador acreditar estar restringindo alguém.
 */
function PermissionMatrix({
  value,
  onChange,
  role,
  idPrefix,
}: {
  value: ModulePermissions
  onChange: (next: ModulePermissions) => void
  role: string
  idPrefix: string
}) {
  const isAdmin = role === 'admin'

  return (
    <div className="space-y-5">
      {isAdmin ? (
        <Well className="flex items-start gap-3 p-3.5">
          <ShieldCheck aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink-strong">
              Administrador tem acesso total, sempre
            </p>
            <p className="mt-1 leading-relaxed text-ink-muted">
              O papel <span className="font-medium text-ink">Administrador</span> ignora
              esta lista: todos os {TOTAL_MODULES} módulos ficam liberados mesmo que uma
              permissão esteja desligada. Para restringir alguém, troque o papel para
              Gerenciador ou Usuário.
            </p>
          </div>
        </Well>
      ) : null}

      {PERMISSION_GROUPS.map((group) => (
        <section key={group.id} aria-labelledby={`${idPrefix}-${group.id}`}>
          <h4 id={`${idPrefix}-${group.id}`} className="mb-2 ds-eyebrow">
            {group.label}
          </h4>
          <Panel className="divide-y divide-line-soft overflow-hidden">
            {group.rows.map((row) => {
              const checked = isAdmin ? true : value[row.key]
              const labelId = `${idPrefix}-${row.key}-label`
              const descId = `${idPrefix}-${row.key}-desc`

              return (
                <div
                  key={row.key}
                  className="flex items-start justify-between gap-4 px-4 py-3.5"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span id={labelId} className="text-sm font-medium text-ink-strong">
                        {moduleLabelOf(row)}
                      </span>
                      {row.modules.length > 1 ? (
                        <StatusPill tone="info" dot={false}>
                          Libera {row.modules.length} módulos
                        </StatusPill>
                      ) : null}
                    </div>
                    <p id={descId} className="mt-1 text-meta leading-relaxed text-ink-muted">
                      {row.description}
                      {row.modules.length > 1
                        ? ` Uma única permissão abre ${row.modules.join(' e ')}.`
                        : ''}
                      {isAdmin ? ' Liberado pelo papel Administrador.' : ''}
                    </p>
                  </div>

                  <Switch
                    checked={checked}
                    disabled={isAdmin}
                    aria-labelledby={labelId}
                    aria-describedby={descId}
                    onCheckedChange={(next) =>
                      onChange({ ...value, [row.key]: next })
                    }
                  />
                </div>
              )
            })}
          </Panel>
        </section>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------

export default function AdminPage() {
  const [users, setUsers] = React.useState<User[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [searchTerm, setSearchTerm] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  const [newUserOpen, setNewUserOpen] = React.useState(false)
  const [form, setForm] = React.useState({
    email: '',
    full_name: '',
    role: 'user',
    password: '',
    permissions: { ...DEFAULT_PERMISSIONS },
  })

  const [editingUser, setEditingUser] = React.useState<User | null>(null)
  const [draftPermissions, setDraftPermissions] = React.useState<ModulePermissions>({
    ...DEFAULT_PERMISSIONS,
  })

  const fetchUsers = React.useCallback(async () => {
    try {
      setLoading(true)
      const res = await apiFetch('/api/admin/users')
      if (!res.ok) {
        setError('Erro ao carregar usuários')
        return
      }
      const data = (await res.json()) as User[] | null
      setUsers(data || [])
      setError(null)
    } catch {
      setError('Erro ao conectar com o banco de dados')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchUsers()
  }, [fetchUsers])

  const resetForm = () => {
    setForm({
      email: '',
      full_name: '',
      role: 'user',
      password: '',
      permissions: { ...DEFAULT_PERMISSIONS },
    })
  }

  const handleAddUser = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!form.email || !form.full_name || !form.password) {
      notify.warning('Preencha todos os campos obrigatórios', {
        description: 'E-mail, nome completo e senha são necessários para criar o acesso.',
      })
      return
    }

    if (form.password.length < 6) {
      notify.warning('Senha muito curta', {
        description: 'A senha deve ter pelo menos 6 caracteres.',
      })
      return
    }

    setSaving(true)
    try {
      const permissions =
        form.role === 'admin' ? { ...ALL_PERMISSIONS } : form.permissions

      const res = await apiFetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          full_name: form.full_name,
          role: form.role,
          permissions,
          password: form.password,
        }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        notify.error('Não foi possível criar o usuário', {
          description: body.error || res.statusText,
        })
        return
      }

      notify.success('Usuário criado', {
        description: `${form.full_name} já pode entrar com ${form.email}.`,
      })
      resetForm()
      setNewUserOpen(false)
      void fetchUsers()
    } catch {
      notify.error('Não foi possível criar o usuário', {
        description: 'Falha de conexão com o servidor.',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleUpdatePermissions = async () => {
    if (!editingUser) return

    setSaving(true)
    try {
      const res = await apiFetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: draftPermissions }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        notify.error('Não foi possível atualizar as permissões', {
          description: body.error || res.statusText,
        })
        return
      }

      notify.success('Permissões atualizadas', {
        description: `${editingUser.full_name} agora enxerga ${countModules(
          draftPermissions,
          editingUser.role,
        )} de ${TOTAL_MODULES} módulos.`,
      })
      setEditingUser(null)
      void fetchUsers()
    } catch {
      notify.error('Não foi possível atualizar as permissões', {
        description: 'Falha de conexão com o servidor.',
      })
    } finally {
      setSaving(false)
    }
  }

  const openPermissions = (user: User) => {
    setEditingUser(user)
    setDraftPermissions({ ...DEFAULT_PERMISSIONS, ...(user.permissions || {}) })
  }

  const handleDeleteUser = async (user: User) => {
    const confirmed = await confirmAction({
      title: 'Excluir este usuário?',
      description:
        'O acesso ao painel é removido imediatamente e a conta não pode ser recuperada. O histórico de ações já registrado é mantido.',
      detail: `${user.full_name} — ${user.email}`,
      tone: 'danger',
      confirmLabel: 'Excluir usuário',
    })
    if (!confirmed) return

    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        notify.error('Não foi possível excluir o usuário', {
          description: body.error || res.statusText,
        })
        return
      }
      notify.success('Usuário excluído', { description: user.email })
      void fetchUsers()
    } catch {
      notify.error('Não foi possível excluir o usuário', {
        description: 'Falha de conexão com o servidor.',
      })
    }
  }

  const handleUpdateRole = async (user: User, newRole: string) => {
    if (newRole === user.role) return

    if (newRole === 'admin') {
      const confirmed = await confirmAction({
        title: 'Promover a Administrador?',
        description: `Administradores acessam todos os ${TOTAL_MODULES} módulos, inclusive esta tela — podem criar, editar e excluir outros usuários. As permissões individuais deixam de ter efeito.`,
        detail: `${user.full_name} — ${user.email}`,
        confirmLabel: 'Promover a Administrador',
      })
      if (!confirmed) return
    }

    try {
      const updateData: { role: string; permissions?: ModulePermissions } = { role: newRole }
      if (newRole === 'admin') {
        updateData.permissions = { ...ALL_PERMISSIONS }
      }

      const res = await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        notify.error('Não foi possível alterar o papel', {
          description: body.error || res.statusText,
        })
        return
      }

      notify.success('Papel atualizado', {
        description: `${user.full_name} agora é ${ROLE_LABEL[newRole] ?? newRole}.`,
      })
      void fetchUsers()
    } catch {
      notify.error('Não foi possível alterar o papel', {
        description: 'Falha de conexão com o servidor.',
      })
    }
  }

  const handleToggleActive = async (user: User) => {
    if (user.is_active) {
      const confirmed = await confirmAction({
        title: 'Revogar o acesso deste usuário?',
        description:
          'A conta continua cadastrada com as mesmas permissões, mas o login passa a ser recusado até que o acesso seja reativado.',
        detail: `${user.full_name} — ${user.email}`,
        tone: 'danger',
        confirmLabel: 'Revogar acesso',
      })
      if (!confirmed) return
    }

    try {
      const res = await apiFetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !user.is_active }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        notify.error('Não foi possível atualizar o status', {
          description: body.error || res.statusText,
        })
        return
      }

      notify.success(user.is_active ? 'Acesso revogado' : 'Acesso reativado', {
        description: user.email,
      })
      void fetchUsers()
    } catch {
      notify.error('Não foi possível atualizar o status', {
        description: 'Falha de conexão com o servidor.',
      })
    }
  }

  // `searchAndRank` filtra E ordena por relevância: quem digita "ana" vê
  // "Ana Paula" antes de "Mariana".
  const filteredUsers = searchAndRank(users, searchTerm, (user) => [
    user.full_name,
    user.email,
  ])

  const activeCount = users.filter((user) => user.is_active).length
  const adminCount = users.filter((user) => user.role === 'admin').length

  const newUserButton = (
    <Button
      onClick={() => {
        resetForm()
        setNewUserOpen(true)
      }}
    >
      <Plus aria-hidden="true" />
      Novo usuário
    </Button>
  )

  return (
    <PageShell>
      <PageHeader
        eyebrow="Sistema"
        title="Administração"
        description="Quem entra no painel, com que papel e quais módulos cada pessoa enxerga."
        meta={
          loading ? null : (
            <>
              <span>
                <span className="font-mono tabular-nums text-ink">{users.length}</span>{' '}
                {users.length === 1 ? 'usuário' : 'usuários'}
              </span>
              <span>
                <span className="font-mono tabular-nums text-ink">{activeCount}</span> com
                acesso ativo
              </span>
            </>
          )
        }
        primaryAction={newUserButton}
      />

      {error ? (
        <div className="mb-5">
          <ErrorBanner message={error} onRetry={fetchUsers} />
        </div>
      ) : null}

      <div className="space-y-5">
        {loading ? (
          <StatGridSkeleton count={4} />
        ) : (
          <StatGrid>
            <StatTile label="Usuários" value={users.length} icon={Users} />
            <StatTile
              label="Acesso ativo"
              value={activeCount}
              hint={`${users.length - activeCount} revogados`}
              icon={KeyRound}
            />
            <StatTile
              label="Administradores"
              value={adminCount}
              hint="Acesso total ao painel"
              icon={ShieldCheck}
              tone="brand"
            />
            <StatTile label="Módulos do painel" value={TOTAL_MODULES} icon={Layers} />
          </StatGrid>
        )}

        <Toolbar>
          <SearchInput
            value={searchTerm}
            onValueChange={setSearchTerm}
            placeholder="Buscar por nome ou e-mail..."
            placeholderShort="Nome ou e-mail"
            label="Buscar usuários por nome ou e-mail"
          />
        </Toolbar>

        {loading ? (
          <>
            <div className="hidden lg:block">
              <TableSkeleton rows={6} columns={6} />
            </div>
            <div className="lg:hidden">
              <CardListSkeleton count={5} />
            </div>
          </>
        ) : users.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum usuário cadastrado"
            description="Crie o primeiro acesso ao painel definindo o papel e os módulos que a pessoa poderá abrir."
            action={newUserButton}
          />
        ) : filteredUsers.length === 0 ? (
          <NoResultsState query={searchTerm} onClear={() => setSearchTerm('')} />
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block">
              <TableFrame>
                <Table caption="Usuários do painel, com papel, módulos liberados e status de acesso">
                  <THead>
                    <TH>Usuário</TH>
                    <TH>Papel</TH>
                    <TH>Módulos liberados</TH>
                    <TH>Acesso</TH>
                    <TH>Criado em</TH>
                    <TH align="right">Ações</TH>
                  </THead>
                  <TBody>
                    {filteredUsers.map((user) => {
                      const modules = countModules(user.permissions, user.role)
                      return (
                        <TR key={user.id}>
                          <TD>
                            <div className="flex items-center gap-3">
                              <Avatar name={user.full_name || user.email} size="md" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink-strong">
                                  {user.full_name}
                                </p>
                                <p className="truncate text-meta text-ink-muted">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                          </TD>
                          <TD>
                            <Select
                              value={user.role}
                              onValueChange={(next) => void handleUpdateRole(user, next)}
                            >
                              <SelectTrigger
                                className="w-[11rem]"
                                aria-label={`Papel de ${user.full_name}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {ROLES.map((role) => (
                                  <SelectItem key={role.value} value={role.value}>
                                    {role.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TD>
                          <TD>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openPermissions(user)}
                            >
                              <ShieldCheck aria-hidden="true" />
                              <span className="font-mono tabular-nums">
                                {modules}/{TOTAL_MODULES}
                              </span>
                              <span className="sr-only">
                                módulos liberados — editar permissões de {user.full_name}
                              </span>
                            </Button>
                          </TD>
                          <TD>
                            <button
                              type="button"
                              onClick={() => void handleToggleActive(user)}
                              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                              aria-label={
                                user.is_active
                                  ? `Revogar acesso de ${user.full_name}`
                                  : `Reativar acesso de ${user.full_name}`
                              }
                            >
                              <StatusPill tone={user.is_active ? 'success' : 'danger'}>
                                {user.is_active ? 'Ativo' : 'Revogado'}
                              </StatusPill>
                            </button>
                          </TD>
                          <TD className="text-ink-muted">
                            {new Date(user.created_at).toLocaleDateString('pt-BR')}
                          </TD>
                          <TD align="right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => openPermissions(user)}
                                aria-label={`Editar permissões de ${user.full_name}`}
                              >
                                <UserCog aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={() => void handleDeleteUser(user)}
                                aria-label={`Excluir ${user.full_name}`}
                                className="text-danger hover:bg-danger-soft hover:text-danger"
                              >
                                <Trash2 aria-hidden="true" />
                              </Button>
                            </div>
                          </TD>
                        </TR>
                      )
                    })}
                  </TBody>
                </Table>
              </TableFrame>
            </div>

            {/* Mobile */}
            <div className="space-y-3 lg:hidden">
              {filteredUsers.map((user) => (
                <MobileRecordCard
                  key={user.id}
                  title={user.full_name}
                  subtitle={user.email}
                  status={
                    <StatusPill tone={user.is_active ? 'success' : 'danger'}>
                      {user.is_active ? 'Ativo' : 'Revogado'}
                    </StatusPill>
                  }
                  fields={[
                    { label: 'Papel', value: ROLE_LABEL[user.role] ?? user.role },
                    {
                      label: 'Módulos liberados',
                      value: `${countModules(user.permissions, user.role)} de ${TOTAL_MODULES}`,
                    },
                    {
                      label: 'Criado em',
                      value: new Date(user.created_at).toLocaleDateString('pt-BR'),
                    },
                  ]}
                  actions={
                    <>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openPermissions(user)}
                      >
                        <UserCog aria-hidden="true" />
                        Permissões
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void handleToggleActive(user)}
                      >
                        {user.is_active ? 'Revogar acesso' : 'Reativar acesso'}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => void handleDeleteUser(user)}
                        aria-label={`Excluir ${user.full_name}`}
                        className="ml-auto text-danger hover:bg-danger-soft hover:text-danger"
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Novo usuário */}
      <ResponsiveModal
        open={newUserOpen}
        onOpenChange={setNewUserOpen}
        size="lg"
        title="Novo usuário"
        description="Defina o acesso e escolha, módulo a módulo, o que esta pessoa poderá abrir."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setNewUserOpen(false)}
              className="sm:w-auto"
              block
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="new-user-form"
              loading={saving}
              className="sm:w-auto"
              block
            >
              Criar usuário
            </Button>
          </>
        }
      >
        <form id="new-user-form" onSubmit={handleAddUser} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="new-user-name"
                className="mb-1.5 block text-sm font-medium text-ink-strong"
              >
                Nome completo <span className="text-danger">*</span>
              </label>
              <Input
                id="new-user-name"
                type="text"
                required
                value={form.full_name}
                onChange={(event) =>
                  setForm({ ...form, full_name: event.target.value })
                }
                placeholder="João Silva"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-email"
                className="mb-1.5 block text-sm font-medium text-ink-strong"
              >
                E-mail <span className="text-danger">*</span>
              </label>
              <Input
                id="new-user-email"
                type="email"
                required
                autoComplete="off"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                placeholder="usuario@sommaclub.com.br"
              />
            </div>

            <div>
              <label
                htmlFor="new-user-password"
                className="mb-1.5 block text-sm font-medium text-ink-strong"
              >
                Senha <span className="text-danger">*</span>
              </label>
              <Input
                id="new-user-password"
                type="password"
                required
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                placeholder="Mínimo de 6 caracteres"
                aria-describedby="new-user-password-hint"
              />
              <p id="new-user-password-hint" className="mt-1.5 text-meta text-ink-muted">
                Pelo menos 6 caracteres. A pessoa pode trocar depois no perfil.
              </p>
            </div>

            <div>
              <span
                id="new-user-role-label"
                className="mb-1.5 block text-sm font-medium text-ink-strong"
              >
                Papel
              </span>
              <Select
                value={form.role}
                onValueChange={(next) => setForm({ ...form, role: next })}
              >
                <SelectTrigger
                  aria-labelledby="new-user-role-label"
                  aria-describedby="new-user-role-hint"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p id="new-user-role-hint" className="mt-1.5 text-meta text-ink-muted">
                {ROLES.find((role) => role.value === form.role)?.hint}
              </p>
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-semibold text-ink-strong">
              Módulos liberados
            </h3>
            <p className="mb-3 text-meta text-ink-muted">
              Cada chave abaixo controla o que aparece na navegação do painel.
            </p>
            <PermissionMatrix
              idPrefix="new-user"
              role={form.role}
              value={form.permissions}
              onChange={(permissions) => setForm({ ...form, permissions })}
            />
          </div>
        </form>
      </ResponsiveModal>

      {/* Permissões */}
      <ResponsiveModal
        open={editingUser !== null}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null)
        }}
        size="lg"
        title={editingUser ? `Permissões de ${editingUser.full_name}` : 'Permissões'}
        description={
          editingUser
            ? `${editingUser.email} · ${ROLE_LABEL[editingUser.role] ?? editingUser.role}`
            : undefined
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setEditingUser(null)}
              className="sm:w-auto"
              block
            >
              Cancelar
            </Button>
            <Button
              onClick={() => void handleUpdatePermissions()}
              loading={saving}
              disabled={editingUser?.role === 'admin'}
              className="sm:w-auto"
              block
            >
              Salvar permissões
            </Button>
          </>
        }
      >
        {editingUser ? (
          <PermissionMatrix
            idPrefix={`perm-${editingUser.id}`}
            role={editingUser.role}
            value={draftPermissions}
            onChange={setDraftPermissions}
          />
        ) : null}
      </ResponsiveModal>
    </PageShell>
  )
}
