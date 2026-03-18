# Tarefas Module — Design Spec

**Date:** 2026-03-18
**Status:** Approved
**Project:** v0-sistema-somma-de-gestao-l7 (SOMMA Admin System)

---

## 1. Overview

A new **Tarefas** (Tasks) module integrated into the SOMMA admin system SPA. A Trello-style Kanban board for internal team task management, accessible to all team members (professores, coordenadores, admin).

**Key decisions:**
- Drag-and-drop via `@dnd-kit` (mobile touch support required)
- Fully dynamic columns (any member can create/rename/delete columns)
- Multiple boards, admin-created only
- Cards have checklist with progress bar
- Overdue badge (visual only — no push notifications)
- Standalone module (no integration with Eventos, Membros, CRM)

---

## 2. User Stories

1. **Admin** creates boards (e.g., "Operações Somma Club", "Marketing")
2. **Any team member** creates columns freely within a board (e.g., "Backlog", "Em Andamento", "Concluído")
3. **Any team member** creates tasks, assigns to a member, sets priority, due date, and checklist items
4. **Any team member** drags cards between columns (desktop) or taps to change column (mobile)
5. **Any team member** checks off checklist items within a task
6. Tasks with a past due date show a red **⚠ Vencida** badge on the card

---

## 3. Data Model (Supabase)

### `tarefas_boards`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | auto-generated |
| `nome` | text | Board name |
| `descricao` | text | Optional description |
| `criado_por` | uuid | FK → auth.users |
| `criado_em` | timestamptz | |

### `tarefas_columns`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `board_id` | uuid | FK → tarefas_boards |
| `nome` | text | Column name (user-defined) |
| `cor` | text | Hex color for column dot indicator |
| `posicao` | int | Column order within board |
| `criado_em` | timestamptz | |

### `tarefas_tasks`
| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `column_id` | uuid | FK → tarefas_columns |
| `board_id` | uuid | FK → tarefas_boards (denormalized for faster queries) |
| `titulo` | text | Card title |
| `descricao` | text | Optional description |
| `prioridade` | text | `'baixa'` \| `'media'` \| `'alta'` \| `'urgente'` |
| `responsavel_id` | uuid | FK → auth.users (nullable) |
| `data_entrega` | date | Nullable |
| `posicao` | int | Order within column |
| `concluida` | bool | True when task is done |
| `checklist` | jsonb | `[{ id: string, texto: string, concluido: boolean }]` |
| `criado_em` | timestamptz | |
| `atualizado_em` | timestamptz | |

---

## 4. API Routes

```
app/api/tarefas/
  boards/route.ts           GET (list boards), POST (create board)
  boards/[id]/route.ts      PATCH (update), DELETE
  columns/route.ts          GET (by board_id), POST (create column)
  columns/[id]/route.ts     PATCH (rename, reorder), DELETE
  tasks/route.ts            GET (by board_id or column_id), POST (create task)
  tasks/[id]/route.ts       PATCH (update: move, edit, check), DELETE
```

All routes use `SUPABASE_SERVICE_ROLE_KEY` consistent with the project pattern.

---

## 5. Component Architecture

```
app/tarefas/page.tsx                  ← 'use client' — main page, state management
  - Fetches boards, columns, tasks
  - Controls board selector, modal state
  - Passes down handlers

components/
  tarefas-kanban-board.tsx            ← DndContext wrapper (@dnd-kit/core)
    - Renders columns in order
    - Handles onDragEnd for both card and column reordering
  tarefas-column.tsx                  ← SortableContext for cards
    - Droppable column area
    - Inline column name editing (click to edit)
    - Add card button at bottom
  tarefas-card.tsx                    ← useSortable hook
    - Displays: title, priority badge, assignee avatar, due date, checklist progress
    - Overdue badge: red ⚠ Vencida if data_entrega < today
    - Click opens tarefas-task-modal
  tarefas-task-modal.tsx              ← Create / Edit task
    - Form fields: título, descrição, prioridade, responsável, data_entrega
    - Checklist editor: add/remove/check items
    - Column selector dropdown
  tarefas-board-modal.tsx             ← Create / Edit / Delete board (admin only)

lib/
  services/tarefas.ts                 ← CRUD helper functions (fetch /api/tarefas/...)
  tarefas-constants.ts                ← Priority definitions with labels/colors
```

---

## 6. UI & UX

### Desktop
- Full Kanban board (horizontal scroll)
- Drag cards between columns
- Drag columns to reorder
- Click column header to rename inline
- "+ Nova Coluna" button as last column placeholder
- Board selector dropdown in top bar
- "Gerenciar Quadros" button (admin only) opens `tarefas-board-modal`

### Mobile
- Horizontal tab strip at top — one tab per column (scrollable)
- Active tab shows its cards as a vertical list
- No drag-and-drop on mobile — card opens modal with column selector dropdown
- "+ Nova" button always visible in header
- Full viewport height (`100dvh`) consistent with check-in module

### Priority Colors
| Priority | Label | Badge style |
|----------|-------|-------------|
| `baixa` | Baixa | `bg-blue-800 text-blue-300` |
| `media` | Média | `bg-purple-800 text-purple-300` |
| `alta` | Alta | `bg-orange-800 text-orange-300` |
| `urgente` | Urgente | `bg-red-800 text-red-300` |

---

## 7. Sidebar Registration

In `app/page.tsx`:
```tsx
import { KanbanSquare } from 'lucide-react'

// In navigation array:
{ id: "tarefas", icon: KanbanSquare, label: "TAREFAS", permissionKey: "tarefas" }

// In content area:
{activeSection === "tarefas" && permissions.tarefas && <TarefasPage />}
```

Permission key `tarefas` needs to be added to the permissions system.

---

## 8. Dependencies

New package to install:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

---

## 9. Out of Scope (this version)

- Comments on tasks
- File attachments
- Notifications / email alerts
- Integration with Eventos or CRM
- Activity log per task
- Member-level board permissions
