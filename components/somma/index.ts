/**
 * Design system do painel Somma.
 *
 * Ponto único de importação: `import { PageHeader, StatTile } from '@/components/somma'`.
 * Se um componente resolve um problema que já existe aqui, use este — o
 * objetivo é que dois módulos nunca resolvam a mesma coisa de formas visuais
 * diferentes.
 */

export { AdminShell } from './admin-shell'
export { CommandPalette, type CommandAction } from './command-palette'
export { ConfirmHost, confirmAction, type ConfirmOptions } from './confirm'
export {
  MobileRecordCard,
  TBody,
  TD,
  TH,
  THead,
  TR,
  Table,
  TableFrame,
  TablePagination,
  type SortDirection,
} from './data-table'
export { EmptyState, NoResultsState } from './empty-state'
export { MobileActionBar, PageHeader, PageShell } from './page-header'
export { Panel, PanelHeader, SectionTitle, VDivider, Well } from './panel'
export { ResponsiveModal, type ResponsiveModalProps } from './responsive-modal'
export {
  CardListSkeleton,
  Skeleton,
  StatGridSkeleton,
  TableSkeleton,
} from './skeleton'
export { StatGrid, StatTile, type StatTileProps } from './stat-tile'
export { StatusPill, toneForStatus, type StatusTone } from './status-pill'
export { Toaster, notify } from './toast'
export {
  FilterButton,
  FilterChip,
  SearchInput,
  SegmentedControl,
  Toolbar,
} from './toolbar'
export { Avatar, UserMenu, useCurrentUser } from './user-menu'
