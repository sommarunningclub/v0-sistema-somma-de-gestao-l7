# Tarefas Filtering and Calendar Design Spec

**Date:** 2026-03-18
**Features:** Global Filtering System + Dual-View Calendar for Tasks
**Status:** Design Complete

---

## Feature Overview

Two independent but complementary features for the Tarefas task management module:

1. **Global Filtering System** - A lateral collapsible panel (desktop) or slide-in overlay (mobile) that applies filters across all views: Kanban board, list view, and calendar. Users can filter by priority, responsible person, delivery date range, completion status, and column.

2. **Calendar View** - A dual-view calendar (month and week) that visualizes tasks by delivery date. Tasks are displayed in their respective date cells, and filters apply globally to all calendar views.

Both features operate on the same task dataset and respect the global filter state, ensuring a cohesive user experience across all task views.

---

## Architecture

### 1. Global Filter State Management

**File:** `lib/context/tarefas-filters-context.tsx` (NEW)

```typescript
interface FilterState {
  priorities: TarefaPrioridade[]       // ['baixa', 'media', 'alta', 'urgente']
  responsavelIds: string[]              // Selected user IDs
  dateRange: {
    start: string | null               // ISO date string (YYYY-MM-DD)
    end: string | null                 // ISO date string (YYYY-MM-DD)
  }
  statuses: ('completed' | 'pending')[] // ['pending', 'completed']
  columnIds: string[]                  // Selected column IDs
}

interface TarefasFiltersContextType {
  filters: FilterState
  setFilters: (filters: FilterState) => void
  clearFilters: () => void
  hasActiveFilters: boolean
  applyFilters: (tasks: TarefasTask[]) => TarefasTask[]  // Filter computation logic
}

export const TarefasFiltersProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [filters, setFilters] = useState<FilterState>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('tarefas-filters')
      return saved ? JSON.parse(saved) : INITIAL_FILTERS
    }
    return INITIAL_FILTERS
  })

  useEffect(() => {
    localStorage.setItem('tarefas-filters', JSON.stringify(filters))
  }, [filters])

  const getTaskStatus = (task: TarefasTask): 'completed' | 'pending' => {
    return task.concluida ? 'completed' : 'pending'
  }

  const applyFilters = useCallback((tasks: TarefasTask[]) => {
    return tasks.filter(task => {
      const matchPriority = filters.priorities.length === 0 || filters.priorities.includes(task.prioridade)
      const matchResponsavel = filters.responsavelIds.length === 0 || filters.responsavelIds.includes(task.responsavel_id || '')
      const matchStatus = filters.statuses.length === 0 || filters.statuses.includes(getTaskStatus(task))
      const matchColumn = filters.columnIds.length === 0 || filters.columnIds.includes(task.column_id)

      // Date range: both empty = no filter, otherwise check if task.data_entrega is within range (inclusive)
      const matchDate = (!filters.dateRange.start && !filters.dateRange.end) ||
        (task.data_entrega &&
         (!filters.dateRange.start || task.data_entrega >= filters.dateRange.start) &&
         (!filters.dateRange.end || task.data_entrega <= filters.dateRange.end))

      return matchPriority && matchResponsavel && matchStatus && matchColumn && matchDate
    })
  }, [filters])

  const hasActiveFilters = filters.priorities.length > 0 ||
    filters.responsavelIds.length > 0 ||
    filters.statuses.length > 0 ||
    filters.columnIds.length > 0 ||
    !!filters.dateRange.start ||
    !!filters.dateRange.end

  const value: TarefasFiltersContextType = {
    filters,
    setFilters,
    clearFilters: () => setFilters(INITIAL_FILTERS),
    hasActiveFilters,
    applyFilters
  }

  return (
    <TarefasFiltersContext.Provider value={value}>
      {children}
    </TarefasFiltersContext.Provider>
  )
}

export const useTarefasFilters = () => {
  const context = useContext(TarefasFiltersContext)
  if (!context) throw new Error('useTarefasFilters must be used within TarefasFiltersProvider')
  return context
}
```

### 2. Filter Panel Component

**File:** `components/tarefas-filters-panel.tsx` (NEW)

**Desktop (md+):**
- Persistent left sidebar (250px width)
- Toggle button (icon only) at top-left to collapse/expand
- Active filter badge on toggle icon showing count
- Filter sections collapse independently:
  * **Priority** - Checkboxes for Baixa, Média, Alta, Urgente
  * **Responsible User** - Dropdown search with user list
  * **Delivery Date Range** - Date picker (start/end, inclusive on both dates)
  * **Status** - Checkboxes for Pendente, Concluída
  * **Column** - Checkboxes for each board column
- "Clear All Filters" button at bottom
- Filters apply in real-time on change

**Mobile (sm:):**
- Filter button (icon, 44px target) in header
- Click opens full-screen overlay from left with Tailwind `translate-x-0` animation
- Same filter sections as desktop
- "Apply" and "Cancel" buttons at bottom
- Click backdrop or "Cancel" dismisses overlay

**State:**
```typescript
interface TarefasFiltersPanelProps {
  onFiltersChange?: () => void  // Optional callback for analytics
}
```

### 3. Calendar Components

**File:** `components/tarefas-calendar.tsx` (NEW - Month View)
**File:** `components/tarefas-calendar-week.tsx` (NEW - Week View)

#### Month View

```typescript
interface TarefasCalendarProps {
  boardId: string
  tasks: TarefasTask[]  // Pre-filtered via useTarefasFilters
  onTaskClick: (taskId: string) => void
}

// Grid layout: 7 columns (Sun-Sat), rows for each week of the month
// Each cell:
// - Date number (top-right, text-sm text-gray-400)
// - Task count (centered, text-xs badge)
// - Task indicators (small colored dots: 🔴=Crítica, 🟡=Alta, 🔵=Média, ⚪=Baixa)
// - Hover: background highlight, cursor pointer
// - Click: open modal showing all tasks for that date

// Navigation:
// - <ChevronLeft> / <ChevronRight> to prev/next month
// - Current date: bordered cell or highlight
// - Header: "March 2026" with buttons

export const TarefasCalendar: React.FC<TarefasCalendarProps> = ({ boardId, tasks, onTaskClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDayTasks, setSelectedDayTasks] = useState<TarefasTask[] | null>(null)

  const daysInMonth = getDaysInMonth(currentDate)
  const firstDayOfMonth = getFirstDayOfMonth(currentDate)

  // ... render grid ...
}
```

**Grid Structure:**
```
┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐
│ Sun │ Mon │ Tue │ Wed │ Thu │ Fri │ Sat │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  1  │  2  │  3  │  4  │  5  │  6  │  7  │
│ •   │ ••  │     │ • • │     │ •   │     │
├─────┼─────┼─────┼─────┼─────┼─────┼─────┤
│  8  │  9  │ 10  │ 11  │ 12  │ 13  │ 14  │
│     │ 2   │ •   │ ••  │ •   │     │     │
└─────┴─────┴─────┴─────┴─────┴─────┴─────┘
```

Each cell is clickable and shows a modal with tasks for that date.

#### Week View

```typescript
import { useMemo, useState } from 'react'
import { addDays, formatISO } from 'date-fns'
import type { TarefasTask } from '@/lib/services/tarefas'

interface TarefasCalendarWeekProps {
  boardId: string
  tasks: TarefasTask[]
  onTaskClick: (taskId: string) => void
}

// Horizontal 7-day strip showing Mon-Sun
// Below: task list organized by day
// Each task shows:
// - Title (truncated to 1 line)
// - Priority badge (colored dot)
// - Responsible person (avatar or initials)
// - Time indicator (if time tracking exists)

export const TarefasCalendarWeek: React.FC<TarefasCalendarWeekProps> = ({ boardId, tasks, onTaskClick }) => {
  const [currentWeekStart, setCurrentWeekStart] = useState(getWeekStart(new Date()))

  // Group tasks by day within current week
  // Note: data_entrega is ISO date string. Validate before parsing to avoid errors with invalid dates.
  const tasksByDay = useMemo(() => {
    const grouped: Record<string, TarefasTask[]> = {}
    for (let i = 0; i < 7; i++) {
      const day = addDays(currentWeekStart, i)
      const dayISO = formatISO(day, { representation: 'date' })
      grouped[dayISO] = tasks.filter(t => {
        if (!t.data_entrega) return false
        try {
          const taskDate = formatISO(new Date(t.data_entrega), { representation: 'date' })
          return taskDate === dayISO
        } catch {
          // Invalid date string - skip this task
          return false
        }
      })
    }
    return grouped
  }, [currentWeekStart, tasks])

  // ... render week strip and tasks ...
}
```

**Layout:**
```
Mon 03   Tue 04   Wed 05   Thu 06   Fri 07   Sat 08   Sun 09
────────────────────────────────────────────────────────────
[Task1]  [Task2]           [Task3]
[Task4]                            [Task5]  [Task6]
```

---

## UI/UX Design

### Filter Panel (Desktop)

**Location:** Left sidebar, 250px width, md+ breakpoint

**Visual:**
- Header: Toggle button (icon) + "Filtros" text, active filter count badge
- Collapsible sections with accordion pattern:
  * Header: Filter name + chevron
  * Body: Checkboxes/dropdowns/date pickers with padding
- Each filter section has:
  * Label with count of selected items in parentheses
  * Checkboxes (16px) with 36px+ minimum click area
  * Selected items highlighted with blue/orange background
- Footer: "Clear All Filters" button (text, not primary CTA)

**Colors:**
- Section headers: Gray-600 text
- Selected items: Orange-500 background, white text
- Unselected items: Gray-400 text
- Active badge: Orange-500 dot

### Filter Panel (Mobile)

**Location:** Full-screen overlay from left, triggered by header button (sm:hidden)

**Visual:**
- Overlay: Fixed position, full height, z-index 40
- Slide-in animation: `translate-x-0` (open) vs `translate-x-full` (closed)
- Backdrop: Clickable, click to dismiss, semi-transparent gray-900/50
- Header: Title "Filtros" + close button (X, 44px touch target) at top
- Content: Same accordion sections as desktop (Priority, Responsible, Date Range, Status, Column)
- Footer: Two buttons side-by-side:
  * "Cancelar" (gray, left, 44px height)
  * "Aplicar" (orange/primary, right, 44px height)
- Safe-area padding: `pb-[env(safe-area-inset-bottom)]` for home indicator on notched devices

**Behavior:**
- Opening filter panel does NOT change current view (Kanban/List/Calendar)
- Filters persist across page navigation automatically (localStorage)
- **Checkbox behavior:** Each checkbox change updates the filter state immediately (real-time, matching desktop behavior). The UI reflects selections as user clicks.
- **Apply/Cancel buttons:**
  * "Aplicar" closes the overlay and ensures the filters are applied to the current view
  * "Cancelar" closes the overlay without saving any uncommitted changes (reverts to last saved state from localStorage)

### Calendar (Month View)

**Grid:**
- 7 columns × ~6 rows
- Each cell: 120px height, 140px width (responsive)
- Cell background: White, hover: gray-50
- Cell border: Gray-200
- Current day: Orange border, 2px

**Task Indicators:**
- Small circular dots (8px diameter)
- Priority colors: 🔴 Urgente (red-600), 🟡 Alta (orange-500), 🟣 Média (purple-500), 🔵 Baixa (blue-500)
- Max 4 indicators visible per cell, "+" for overflow
- Clickable: triggers modal with all tasks for that date

### Calendar (Week View)

**Header:**
- Mon 03 | Tue 04 | Wed 05 | Thu 06 | Fri 07 | Sat 08 | Sun 09
- Current day highlighted with orange underline
- Nav buttons: <ChevronLeft> / <ChevronRight>

**Task Cards:**
- White background, gray-200 border, rounded corners
- Layout: Title (left) | Priority badge (right)
- Title: 1 line, truncated with ellipsis
- Priority badge: 8px dot with color
- Hover: subtle shadow, cursor pointer
- Click: open task modal

---

## State Management & Data Flow

### 1. Provider Setup

**File:** `app/tarefas/layout.tsx` (MODIFY)

The `TarefasFiltersProvider` must wrap the entire content after boards and tasks are loaded. Place it at the top level of the layout to ensure all views (Kanban, List, Calendar) have access to filters.

```typescript
import { TarefasFiltersProvider } from '@/lib/context/tarefas-filters-context'

export default function TarefasLayout({ children }) {
  return (
    <TarefasFiltersProvider>
      {children}
    </TarefasFiltersProvider>
  )
}
```

**Placement note:** The provider wraps the entire children tree, so all route segments under `/app/tarefas/*` can access `useTarefasFilters()`. The filter state persists in localStorage automatically and survives page navigation.

### 2. Filter Application Flow

```
User clicks filter checkbox
  ↓
setFilters() in TarefasFiltersContext updates state
  ↓
localStorage persisted automatically as JSON
  ↓
Component consuming useTarefasFilters() re-renders
  ↓
applyFilters(tasks) computes filtered dataset
  ↓
All views (Kanban, List, Calendar) receive filtered tasks
```

**Filter Logic Details:**
- **Within a category** (e.g., multiple priorities selected): OR logic - if no filters selected in a category, all values pass
- **Between categories**: AND logic - task must match priority AND status AND date AND responsible user AND column
- **Date range**: Inclusive on both start and end dates. Compares ISO date strings (YYYY-MM-DD). Task is included if `data_entrega` >= start date AND `data_entrega` <= end date
- **Status mapping**: A task with `concluida: true` maps to 'completed' status; `concluida: false` maps to 'pending' status

### 3. View Integration

Each view (Kanban board, list, calendar) follows this pattern:

```typescript
export const TarefasKanbanBoard: React.FC = () => {
  const { board, tasks } = useTarefasBoard()
  const { applyFilters } = useTarefasFilters()

  // Apply filters to tasks
  const filteredTasks = useMemo(
    () => applyFilters(tasks),
    [tasks, applyFilters]
  )

  // Render with filtered tasks
  return <KanbanBoard tasks={filteredTasks} />
}
```

---

## Integration Points

### 1. Tarefas Page (`app/tarefas/page.tsx`) - MODIFY

**Changes:**
- Import `TarefasFiltersPanelMobile` for sm: breakpoint
- Add mobile filter button in header
- Render filter panel alongside Kanban board (desktop)
- Add view toggle: "Mês / Semana" buttons for calendar views
- Modify layout to accommodate left sidebar filter panel

**Layout (Desktop):**
```
┌─ Header (View Toggle, Search, Actions) ────────────────┐
├─────────────────┬──────────────────────────────────────┤
│  Filters Panel  │  Kanban Board / List / Calendar      │
│  (250px)        │  (responsive, grows with screen)     │
└─────────────────┴──────────────────────────────────────┘
```

**Layout (Mobile):**
```
┌─ Header (Filter Button, Search) ────────────────┐
├─────────────────────────────────────────────────┤
│  Kanban Board / List / Calendar (full width)    │
│  (Filter overlay slides in from left on demand) │
└─────────────────────────────────────────────────┘
```

### 2. Calendar Integration

**File:** `app/tarefas/page.tsx` - ADD calendar view handling

```typescript
const [view, setView] = useState<'kanban' | 'list' | 'calendar-month' | 'calendar-week'>(() => {
  if (typeof window !== 'undefined' && window.innerWidth < 768) return 'list'
  return 'kanban'
})

// Render based on view state
{view === 'kanban' && <TarefasKanbanBoard />}
{view === 'list' && <TarefasListView />}
{view === 'calendar-month' && <TarefasCalendar />}
{view === 'calendar-week' && <TarefasCalendarWeek />}
```

---

## Mobile Responsiveness

### Filter Panel (sm:)
- Full-screen overlay (z-40)
- Slide-in from left with `translate-x-0` animation
- Dismiss: click backdrop, press X button, click "Cancelar"
- Safe area padding at bottom

### Filter Panel (md+)
- Persistent left sidebar
- Collapsible via icon toggle
- Sticky position so scrolling doesn't hide filters

### Calendar (sm:)
- Month view: Full width, cells adjust to fit (responsive grid)
- Week view: Horizontal scrollable if needed, single column of tasks per day
- Touch-friendly tap targets (min 44px)

### Calendar (md+)
- Month view: Full width with proper grid spacing
- Week view: Horizontal layout with task cards side-by-side

---

## Testing Strategy

### Unit Tests

**File:** `lib/context/__tests__/tarefas-filters-context.test.ts`

- **Filter logic:**
  * Priority filter: Only tasks with selected priorities pass (empty selection = all priorities pass)
  * Responsible user filter: Only tasks assigned to selected users pass (empty = all users pass)
  * Date range filter: Only tasks with `data_entrega` within range pass (inclusive, empty = no date filter)
  * Status filter: Only tasks matching selected status pass (empty = both completed and pending pass)
  * Column filter: Only tasks in selected columns pass (empty = all columns pass)
- **Filter combinations:** AND logic between all categories (priority AND status AND date AND responsible AND column)
- **LocalStorage persistence:** Filters survive page reload
- **Clear filters:** All selections reset to empty state

**File:** `components/__tests__/tarefas-filters-panel.test.tsx`

- Checkbox toggle
- Dropdown user selection
- Date range picker
- Active filter badge updates

**File:** `components/__tests__/tarefas-calendar.test.tsx`

- Calendar grid renders correct dates
- Task indicators display with correct colors
- Click cell opens modal
- Month navigation (prev/next)
- Current day highlighting

### Integration Tests

- Filters apply across all views
- LocalStorage persists filters across page reload
- Calendar shows filtered tasks only
- Kanban board shows filtered tasks only
- Filter count badge updates

### Visual Tests (Manual)

- Desktop layout: Filter panel beside board
- Mobile layout: Filter overlay slides in correctly
- Month calendar: Grid aligns properly, indicators visible
- Week calendar: Task cards render without overlap
- Touch targets: 44px minimum on mobile

---

## Implementation Order

1. **Filters Context** - State management and logic
2. **Filters Panel Component** - Desktop and mobile UI
3. **Integration in Tarefas Page** - Wire up filters to existing Kanban/List
4. **Calendar Month View** - Grid layout and interactions
5. **Calendar Week View** - Week layout and task display
6. **Tests and Polish** - Unit, integration, and visual tests

---

## Success Criteria

- ✅ Filters persist in localStorage and apply across all views
- ✅ Filter panel is accessible on desktop (sidebar) and mobile (overlay)
- ✅ Calendar month view displays all tasks by delivery date
- ✅ Calendar week view displays tasks organized by day
- ✅ User can toggle between views without losing filter state
- ✅ All touch targets are ≥44px on mobile
- ✅ Filters apply in real-time with no lag
- ✅ Tests cover all filter combinations and integrations
