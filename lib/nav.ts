import {
  Briefcase,
  Calendar,
  CalendarRange,
  CheckSquare,
  ClipboardList,
  Handshake,
  LayoutDashboard,
  Mail,
  Megaphone,
  MonitorSmartphone,
  Settings,
  Star,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { PermissionKey } from './auth/types'

/**
 * Arquitetura de navegação do painel.
 *
 * Antes os módulos eram uma lista plana de 11 itens em caixa alta, sem
 * agrupamento — o usuário tinha que varrer tudo para achar o que queria.
 * Aqui eles são organizados pelo trabalho que representam:
 *
 *  - Operação: o dia a dia dos eventos (check-in, eventos, escala)
 *  - Relacionamento: quem está do outro lado (membros, parceiros, insiders, CRM)
 *  - Gestão: trabalho interno e comunicação (tarefas, pop-ups)
 *  - Sistema: administração
 *
 * A fonte da verdade continua sendo `SECTION_PERMISSIONS`; aqui só se descreve
 * apresentação e agrupamento.
 */

export type NavGroupId = 'principal' | 'operacao' | 'relacionamento' | 'gestao' | 'sistema'

export interface NavItem {
  /** `section` da SPA — mesma chave usada em `?section=`. */
  id: string
  label: string
  /** Descrição curta usada na busca global e nos tooltips. */
  description: string
  icon: LucideIcon
  permission: PermissionKey
  group: NavGroupId
  /** Termos alternativos para a busca global (⌘K). */
  keywords?: string[]
}

export const NAV_GROUPS: Array<{ id: NavGroupId; label: string }> = [
  { id: 'principal', label: '' },
  { id: 'operacao', label: 'Operação' },
  { id: 'relacionamento', label: 'Relacionamento' },
  { id: 'gestao', label: 'Gestão' },
  { id: 'sistema', label: 'Sistema' },
]

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'overview',
    label: 'Dashboard',
    description: 'Visão geral de métricas e atividade recente',
    icon: LayoutDashboard,
    permission: 'dashboard',
    group: 'principal',
    keywords: ['início', 'home', 'métricas', 'kpi', 'visão geral'],
  },

  {
    id: 'checkin',
    label: 'Check-in',
    description: 'Registrar presença dos participantes nos eventos',
    icon: CheckSquare,
    permission: 'checkin',
    group: 'operacao',
    keywords: ['presença', 'entrada', 'qr', 'validar'],
  },
  {
    id: 'eventos',
    label: 'Eventos',
    description: 'Criar e gerenciar os eventos do clube',
    icon: Calendar,
    permission: 'checkin',
    group: 'operacao',
    keywords: ['treino', 'corrida', 'agenda'],
  },
  {
    id: 'escala',
    label: 'Escala',
    description: 'Distribuir insiders e atividades no calendário',
    icon: CalendarRange,
    permission: 'escala',
    group: 'operacao',
    keywords: ['calendário', 'turno', 'alocação'],
  },
  {
    id: 'vagas',
    label: 'Vagas',
    description: 'Candidatos das vagas abertas e triagem dos currículos',
    icon: ClipboardList,
    permission: 'vagas',
    group: 'operacao',
    keywords: ['currículo', 'curriculo', 'candidato', 'estágio', 'estagio', 'recrutamento', 'contratação', 'trabalhe conosco'],
  },
  {
    id: 'pdv',
    label: 'PDV',
    description: 'Integração da frente de caixa, maquininha Point e Shopify',
    icon: MonitorSmartphone,
    permission: 'pdv',
    group: 'operacao',
    keywords: ['caixa', 'maquininha', 'point', 'shopify', 'mercado pago', 'terminal', 'frente de caixa'],
  },

  {
    id: 'agents',
    label: 'Membros',
    description: 'Base de membros do clube e suas tags',
    icon: Users,
    permission: 'membros',
    group: 'relacionamento',
    keywords: ['alunos', 'base', 'contatos'],
  },
  {
    id: 'parceiro',
    label: 'Parceiros',
    description: 'Empresas parceiras, códigos e contatos',
    icon: Briefcase,
    permission: 'parceiro',
    group: 'relacionamento',
    keywords: ['empresa', 'cnpj', 'cupom', 'benefício'],
  },
  {
    id: 'insiders',
    label: 'Insiders',
    description: 'Cadastro e gestão dos insiders do clube',
    icon: Star,
    permission: 'pagamentos',
    group: 'relacionamento',
    keywords: ['embaixador', 'staff', 'voluntário'],
  },
  {
    id: 'crm',
    label: 'CRM',
    description: 'Funil de leads e negociações',
    icon: Handshake,
    permission: 'crm',
    group: 'relacionamento',
    keywords: ['leads', 'funil', 'kanban', 'vendas', 'negociação'],
  },
  {
    id: 'email',
    label: 'E-mail Marketing',
    description: 'Campanhas de e-mail e o status dos disparos',
    icon: Mail,
    permission: 'email',
    group: 'relacionamento',
    keywords: ['campanha', 'disparo', 'newsletter', 'resend'],
  },

  {
    id: 'popups',
    label: 'Pop-ups',
    description: 'Campanhas exibidas no site e seus resultados',
    icon: Megaphone,
    permission: 'popups',
    group: 'gestao',
    keywords: ['campanha', 'banner', 'aviso', 'analytics'],
  },

  {
    id: 'systems',
    label: 'Administração',
    description: 'Usuários, papéis e permissões do sistema',
    icon: Settings,
    permission: 'admin',
    group: 'sistema',
    keywords: ['usuários', 'permissões', 'acesso', 'roles', 'admin'],
  },
]

/** Os quatro módulos da barra inferior no celular, em ordem de uso diário. */
export const MOBILE_PRIMARY_IDS = ['overview', 'checkin', 'eventos', 'agents'] as const

export function getNavItem(sectionId: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => item.id === sectionId)
}

export function visibleNavItems(permissions: Record<string, boolean>): NavItem[] {
  return NAV_ITEMS.filter((item) => permissions[item.permission] !== false)
}
