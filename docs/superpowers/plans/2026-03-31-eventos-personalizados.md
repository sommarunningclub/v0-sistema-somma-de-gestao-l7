# Eventos Personalizados — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow creating custom events (without pelotão) that appear in the public check-in with description, clickable address link, and a simplified 2-step check-in flow.

**Architecture:** Add `tipo` and `local_url` columns to `eventos` table. The admin form conditionally shows/hides pelotão fields based on event type. The public check-in dynamically adjusts step count (2 vs 3) and the success page uses real event data instead of hardcoded values.

**Tech Stack:** Next.js 15, React 19, Supabase (PostgreSQL), Tailwind CSS, TypeScript

**Two projects involved:**
- **Sistema de gestão:** `/Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7` (schema, types, API, admin UI)
- **Site público:** `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026` (check-in flow, success page)

---

### Task 1: Database Migration

**Files:**
- Create: `sql/003-add-evento-tipo-local-url.sql`

- [ ] **Step 1: Create migration file**

```sql
-- 003-add-evento-tipo-local-url.sql
-- Add tipo and local_url columns to eventos table

ALTER TABLE eventos ADD COLUMN tipo TEXT DEFAULT 'corrida' CHECK (tipo IN ('corrida', 'personalizado'));
ALTER TABLE eventos ADD COLUMN local_url TEXT;
```

- [ ] **Step 2: Run migration on Supabase**

Execute the SQL above in Supabase SQL Editor or via CLI. Verify with:

```sql
SELECT column_name, data_type, column_default FROM information_schema.columns WHERE table_name = 'eventos' AND column_name IN ('tipo', 'local_url');
```

Expected: Two rows — `tipo` (text, default 'corrida') and `local_url` (text, null).

- [ ] **Step 3: Commit**

```bash
git add sql/003-add-evento-tipo-local-url.sql
git commit -m "feat(eventos): add tipo and local_url columns migration"
```

---

### Task 2: Update TypeScript Types

**Files:**
- Modify: `lib/types/evento.ts`

- [ ] **Step 1: Add new fields to types**

In `lib/types/evento.ts`, update all interfaces:

```typescript
export interface Evento {
  id: string
  titulo: string
  descricao: string | null
  data_evento: string
  horario_inicio: string
  local: string
  local_url: string | null
  tipo: 'corrida' | 'personalizado'
  checkin_abertura: string | null
  checkin_fechamento: string | null
  checkin_status: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes: string[]
  created_at: string
  updated_at: string
  criado_por: string | null
}

export interface EventoCreate {
  titulo: string
  descricao?: string
  data_evento: string
  horario_inicio?: string
  local?: string
  local_url?: string
  tipo?: 'corrida' | 'personalizado'
  checkin_abertura?: string
  checkin_fechamento?: string
  checkin_status?: 'aberto' | 'bloqueado' | 'encerrado'
  pelotoes?: string[]
}

export interface EventoUpdate extends Partial<EventoCreate> {}

export interface EventoWithStats extends Evento {
  checkin_count: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/types/evento.ts
git commit -m "feat(tipos): add tipo and local_url to Evento interfaces"
```

---

### Task 3: Update API — POST/PUT eventos

**Files:**
- Modify: `app/api/insider/eventos/route.ts` (POST)
- Modify: `app/api/insider/eventos/[id]/route.ts` (PUT)

- [ ] **Step 1: Update POST to accept tipo and local_url**

In `app/api/insider/eventos/route.ts`, update the insert object inside `POST` (lines 79-91). Replace the insert block:

```typescript
const { data, error } = await supabase
  .from('eventos')
  .insert({
    titulo: body.titulo.trim(),
    descricao: body.descricao || null,
    data_evento: body.data_evento,
    horario_inicio: body.horario_inicio || '07:00',
    local: body.local || 'Parque da Cidade — Brasília, DF',
    local_url: body.local_url || null,
    tipo: body.tipo || 'corrida',
    checkin_abertura: body.checkin_abertura || null,
    checkin_fechamento: body.checkin_fechamento || null,
    checkin_status: body.checkin_status || 'bloqueado',
    pelotoes: body.tipo === 'personalizado' ? [] : (body.pelotoes || ['4km', '6km', '8km']),
  })
  .select()
  .single()
```

- [ ] **Step 2: Update PUT to accept tipo and local_url**

In `app/api/insider/eventos/[id]/route.ts`, add these lines after the existing `if (body.pelotoes !== undefined)` line (line 41):

```typescript
if (body.tipo !== undefined) updateObj.tipo = body.tipo
if (body.local_url !== undefined) updateObj.local_url = body.local_url || null
```

- [ ] **Step 3: Commit**

```bash
git add app/api/insider/eventos/route.ts app/api/insider/eventos/[id]/route.ts
git commit -m "feat(api): accept tipo and local_url in evento CRUD"
```

---

### Task 4: Update API — GET eventos/ativos (public)

**Files:**
- Modify: `app/api/eventos/ativos/route.ts`

- [ ] **Step 1: Add tipo and local_url to the select query**

In `app/api/eventos/ativos/route.ts`, update line 22 (the upcoming query select):

```typescript
.select('id, titulo, data_evento, horario_inicio, local, local_url, tipo, checkin_status, pelotoes, descricao')
```

No change needed for historico query — it only shows past events in a compact format.

- [ ] **Step 2: Commit**

```bash
git add app/api/eventos/ativos/route.ts
git commit -m "feat(api): return tipo, local_url in eventos ativos endpoint"
```

---

### Task 5: Admin Form — Add tipo and local_url fields

**Files:**
- Modify: `app/eventos/page.tsx`

- [ ] **Step 1: Update DEFAULT_FORM**

At line 35, update `DEFAULT_FORM` to include new fields:

```typescript
const DEFAULT_FORM = {
  titulo: '',
  descricao: '',
  data_evento: '',
  horario_inicio: '07:00',
  local: 'Parque da Cidade — Brasília, DF',
  local_url: '',
  tipo: 'corrida' as 'corrida' | 'personalizado',
  checkin_abertura: '',
  checkin_fechamento: '',
  checkin_status: 'bloqueado' as 'aberto' | 'bloqueado' | 'encerrado',
  pelotoes: ['4km', '6km', '8km'],
}
```

- [ ] **Step 2: Update handleEdit to load new fields**

In `handleEdit` (line 113-128), add the new fields to the form state:

```typescript
const handleEdit = (evento: EventoWithStats) => {
  setEditingId(evento.id)
  setForm({
    titulo: evento.titulo,
    descricao: evento.descricao || '',
    data_evento: evento.data_evento,
    horario_inicio: evento.horario_inicio || '07:00',
    local: evento.local || '',
    local_url: evento.local_url || '',
    tipo: evento.tipo || 'corrida',
    checkin_abertura: toDatetimeLocal(evento.checkin_abertura),
    checkin_fechamento: toDatetimeLocal(evento.checkin_fechamento),
    checkin_status: evento.checkin_status,
    pelotoes: evento.pelotoes || ['4km', '6km', '8km'],
  })
  setSaveError(null)
  setModalOpen(true)
}
```

- [ ] **Step 3: Update handleDuplicate to copy new fields**

In `handleDuplicate` (around line 131-158), add after `local: evento.local || '',`:

```typescript
local_url: evento.local_url || '',
tipo: evento.tipo || 'corrida',
```

- [ ] **Step 4: Update handleSave to send new fields**

In `handleSave` (line 169-178), update the body object:

```typescript
const body = {
  titulo: form.titulo,
  descricao: form.descricao || undefined,
  data_evento: form.data_evento,
  horario_inicio: form.horario_inicio || '07:00',
  local: form.local || 'Parque da Cidade — Brasília, DF',
  local_url: form.local_url || undefined,
  tipo: form.tipo,
  checkin_abertura: form.checkin_abertura ? new Date(form.checkin_abertura).toISOString() : undefined,
  checkin_fechamento: form.checkin_fechamento ? new Date(form.checkin_fechamento).toISOString() : undefined,
  checkin_status: form.checkin_status,
  pelotoes: form.tipo === 'personalizado' ? [] : form.pelotoes,
}
```

- [ ] **Step 5: Add Tipo selector and Link do endereço field to modal form**

In the modal form section (after the Título input around line 588), add the Tipo selector as the FIRST field (before Título):

```tsx
{/* Tipo de Evento */}
<div>
  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Tipo de Evento</label>
  <div className="flex gap-2">
    {(['corrida', 'personalizado'] as const).map(tipo => (
      <button
        key={tipo}
        type="button"
        onClick={() => setForm(f => ({
          ...f,
          tipo,
          pelotoes: tipo === 'personalizado' ? [] : (f.pelotoes.length === 0 ? ['4km', '6km', '8km'] : f.pelotoes),
        }))}
        className={`flex-1 py-2.5 rounded-lg border text-xs font-medium transition-colors ${
          form.tipo === tipo
            ? 'border-orange-500 bg-orange-500/15 text-orange-400'
            : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:border-neutral-600'
        }`}
      >
        {tipo === 'corrida' ? '🏃 Corrida' : '📋 Personalizado'}
      </button>
    ))}
  </div>
</div>
```

After the Local input (line 621), add the Link do endereço field:

```tsx
{/* Link do endereço */}
<div>
  <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Link do endereço</label>
  <input
    type="url"
    value={form.local_url}
    onChange={e => setForm(f => ({ ...f, local_url: e.target.value }))}
    placeholder="https://maps.app.goo.gl/..."
    className="w-full px-3 py-2.5 bg-neutral-800 border border-neutral-700 rounded-lg text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-orange-500/50"
  />
</div>
```

- [ ] **Step 6: Conditionally hide pelotões when tipo is personalizado**

Wrap the entire Pelotões section (lines 636-662) in a conditional:

```tsx
{form.tipo === 'corrida' && (
  <div>
    <label className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 block">Pelotões</label>
    {/* ... existing pelotões content unchanged ... */}
  </div>
)}
```

- [ ] **Step 7: Commit**

```bash
git add app/eventos/page.tsx
git commit -m "feat(admin): add tipo selector and local_url field to event form"
```

---

### Task 6: Public Check-in — Update event type and API fetch

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/api/eventos/route.ts`
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/check-in/page.tsx`

- [ ] **Step 1: Update public API to return new fields**

In `sommarunningclub-novo-site-somma-club-2026/app/api/eventos/route.ts`, update the upcoming select (line 19):

```typescript
.select('id, titulo, data_evento, horario_inicio, local, local_url, tipo, checkin_status, pelotoes, descricao')
```

- [ ] **Step 2: Update the Evento type in check-in page**

In `sommarunningclub-novo-site-somma-club-2026/app/check-in/page.tsx`, update the `Evento` type (lines 16-26):

```typescript
type Evento = {
  id: string
  data: string
  dataFormatada: string
  titulo: string
  descricao: string | null
  local: string
  localUrl: string | null
  tipo: 'corrida' | 'personalizado'
  encerrado: boolean
  bloqueado: boolean
  dataEvento: string
  horarioInicio: string
}
```

- [ ] **Step 3: Update fetchEventos to map new fields**

In the `fetchEventos` function (lines 66-99), update both the próximo evento and histórico mapping blocks.

For próximo evento (inside `if (data.proximo_evento)`):

```typescript
if (data.proximo_evento) {
  const e = data.proximo_evento
  lista.push({
    id: e.id,
    data: e.data_evento,
    dataFormatada: formatarData(e.data_evento),
    titulo: e.titulo,
    descricao: e.descricao || null,
    local: e.local || 'Parque da Cidade — Brasília, DF',
    localUrl: e.local_url || null,
    tipo: e.tipo || 'corrida',
    encerrado: e.checkin_status === 'encerrado',
    bloqueado: e.checkin_status === 'bloqueado',
    dataEvento: e.data_evento,
    horarioInicio: e.horario_inicio || '07:00',
  })
}
```

For histórico (inside `if (data.historico)`):

```typescript
if (data.historico) {
  for (const e of data.historico) {
    lista.push({
      id: e.id,
      data: e.data_evento,
      dataFormatada: formatarData(e.data_evento),
      titulo: e.titulo,
      descricao: null,
      local: e.local || 'Parque da Cidade — Brasília, DF',
      localUrl: null,
      tipo: 'corrida',
      encerrado: e.checkin_status === 'encerrado',
      bloqueado: e.checkin_status === 'bloqueado',
      dataEvento: e.data_evento,
      horarioInicio: '07:00',
    })
  }
}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add app/api/eventos/route.ts app/check-in/page.tsx
git commit -m "feat(checkin): add tipo, descricao, local_url to event data"
```

---

### Task 7: Public Check-in — Dynamic step flow

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/check-in/page.tsx`

- [ ] **Step 1: Make TOTAL_STEPS dynamic**

Remove the `const TOTAL_STEPS = 3` line (line 28). Replace references to `TOTAL_STEPS` with a computed value. After `eventoSelecionado` state, add:

```typescript
const totalSteps = eventoSelecionado?.tipo === 'personalizado' ? 2 : 3
```

- [ ] **Step 2: Update canAdvance logic**

Replace the `canAdvance` function (lines 127-132):

```typescript
const canAdvance = () => {
  if (step === 1) return true
  if (eventoSelecionado?.tipo === 'personalizado') {
    // For personalizado: step 2 is personal data
    if (step === 2) return !!(formData.nome && formData.telefone && formData.sexo && formData.email && formData.cpf)
  } else {
    // For corrida: step 2 is pelotão, step 3 is personal data
    if (step === 2) return !!formData.peloton
    if (step === 3) return !!(formData.nome && formData.telefone && formData.sexo && formData.email && formData.cpf)
  }
  return false
}
```

- [ ] **Step 3: Update handleNext**

Replace `handleNext` (line 134-136):

```typescript
const handleNext = () => {
  if (canAdvance() && step < totalSteps) setStep(step + 1)
}
```

- [ ] **Step 4: Determine which step shows personal data form**

The personal data step is:
- `step === 3` for corrida events (unchanged)
- `step === 2` for personalizado events

Update the step rendering logic. The step 2 pelotão section (`{step === 2 && (` around line 458) should be wrapped:

```tsx
{step === 2 && eventoSelecionado?.tipo !== 'personalizado' && (
  // ... existing pelotão step content unchanged ...
)}
```

The step 3 personal data section (`{step === 3 && (` around line 518) should change to:

```tsx
{((step === 3 && eventoSelecionado?.tipo !== 'personalizado') || (step === 2 && eventoSelecionado?.tipo === 'personalizado')) && (
  // ... existing personal data form ...
)}
```

- [ ] **Step 5: Update step labels and progress bar**

Replace all `TOTAL_STEPS` references with `totalSteps`:

The progress bar (lines 384-395):
```tsx
<div className="flex items-center gap-1 sm:gap-2 mb-8 sm:mb-10">
  {Array.from({ length: totalSteps }).map((_, i) => (
    <div key={i} className="flex-1 flex items-center gap-1 sm:gap-2">
      <div
        className={`h-1 sm:h-1.5 flex-1 rounded-full transition-all duration-500 ${
          i + 1 <= step ? 'bg-orange-500' : 'bg-zinc-800'
        }`}
      />
    </div>
  ))}
  <span className="text-xs text-zinc-500 whitespace-nowrap ml-2">{step}/{totalSteps}</span>
</div>
```

The subtitle (line 379):
```tsx
<p className="text-zinc-400 text-xs sm:text-sm mt-2 sm:mt-3">
  Confirme sua presença em {totalSteps} passos simples
</p>
```

- [ ] **Step 6: Update step labels for personalizado**

In the personal data step header, update the "Passo" label dynamically:

```tsx
<p className="text-xs text-orange-500 font-semibold uppercase tracking-widest mb-1 sm:mb-2">
  Passo {eventoSelecionado?.tipo === 'personalizado' ? 2 : 3}
</p>
```

- [ ] **Step 7: Hide pelotão summary in personal data step for personalizado**

The "Resumo pelotão" section (lines 609-618) should only show for corrida events:

```tsx
{eventoSelecionado?.tipo !== 'personalizado' && (
  <div className="mt-5 sm:mt-6 flex items-center gap-3 bg-zinc-900 rounded-lg sm:rounded-xl px-3.5 sm:px-5 py-3 sm:py-4 border border-zinc-800">
    {/* ... existing pelotão summary unchanged ... */}
  </div>
)}
```

- [ ] **Step 8: Update handleSubmit for personalizado**

In `handleSubmit` (line 142-181), update the fetch body to handle null pelotão:

```typescript
body: JSON.stringify({
  nome_completo: formData.nome,
  email: formData.email,
  telefone: formData.telefone,
  cpf: formData.cpf,
  sexo: formData.sexo,
  pelotao: eventoSelecionado?.tipo === 'personalizado' ? null : formData.peloton,
  data_do_evento: eventoSelecionado?.dataEvento || '',
  nome_do_evento: eventoSelecionado?.titulo || '',
  evento_id: eventoSelecionado?.id || null,
}),
```

Update the redirect query params to pass more event data:

```typescript
const params = new URLSearchParams({
  data: eventoSelecionado?.dataFormatada || '',
  evento: eventoSelecionado?.titulo || '',
  horario: eventoSelecionado?.horarioInicio || '07:00',
  local: eventoSelecionado?.local || '',
  local_url: eventoSelecionado?.localUrl || '',
  descricao: eventoSelecionado?.descricao || '',
})
router.push(`/check-in/sucesso?${params.toString()}`)
```

- [ ] **Step 9: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add app/check-in/page.tsx
git commit -m "feat(checkin): dynamic step flow — 2 steps for personalizado, 3 for corrida"
```

---

### Task 8: Public Check-in — Show description and clickable location

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/check-in/page.tsx`

- [ ] **Step 1: Add description to upcoming event card**

In the upcoming event card (around line 282, after the `<h3>` title), add description:

```tsx
<h3 className="text-white font-bold text-base sm:text-lg mb-3">{evento.titulo}</h3>
{evento.descricao && (
  <p className="text-zinc-400 text-xs sm:text-sm mb-3 leading-relaxed">{evento.descricao}</p>
)}
```

- [ ] **Step 2: Make location clickable when local_url exists**

Replace the location `<div>` in the upcoming event card (around lines 292-295):

```tsx
<div className="flex items-center gap-2 text-xs sm:text-sm text-zinc-400">
  <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${evento.bloqueado ? 'text-zinc-500' : 'text-orange-500'}`} />
  {evento.localUrl ? (
    <a
      href={evento.localUrl}
      target="_blank"
      rel="noopener noreferrer"
      onClick={e => e.stopPropagation()}
      className="hover:text-orange-400 underline underline-offset-2 transition-colors"
    >
      {evento.local}
    </a>
  ) : (
    evento.local
  )}
</div>
```

- [ ] **Step 3: Update Step 1 event confirmation card to show description and clickable location**

In the Step 1 event confirmation card (around line 435-442), update the local section:

```tsx
<div className="flex items-start gap-3 text-xs sm:text-sm">
  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
    <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-500" />
  </div>
  <div className="flex-1">
    <p className="text-zinc-400 text-xs">Local</p>
    {eventoSelecionado.localUrl ? (
      <a
        href={eventoSelecionado.localUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-white font-medium text-sm sm:text-base hover:text-orange-400 underline underline-offset-2 transition-colors"
      >
        {eventoSelecionado.local}
      </a>
    ) : (
      <p className="text-white font-medium text-sm sm:text-base">{eventoSelecionado.local}</p>
    )}
  </div>
</div>
```

Also add description after the event details in the Step 1 card (after the location section, before the closing `</div>` of the details area):

```tsx
{eventoSelecionado.descricao && (
  <div className="pt-3 border-t border-zinc-800 mt-3">
    <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">{eventoSelecionado.descricao}</p>
  </div>
)}
```

- [ ] **Step 4: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add app/check-in/page.tsx
git commit -m "feat(checkin): show event description and clickable location link"
```

---

### Task 9: Public Check-in — Update checkin API to accept null pelotao

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/api/checkin/route.ts`

- [ ] **Step 1: Update validation to allow null pelotao**

In `app/api/checkin/route.ts`, update the validation (line 26):

```typescript
if (!nome_completo || !email || !telefone || !cpf || !sexo) {
  return NextResponse.json(
    { error: 'Campos obrigatórios faltando' },
    { status: 400 }
  )
}
```

And update the insert (line 36-49) to handle null pelotao:

```typescript
const { data, error } = await supabase
  .from('checkins')
  .insert([
    {
      nome_completo,
      email,
      telefone,
      cpf,
      sexo,
      pelotao: pelotao || null,
      data_do_evento: data_do_evento || '',
      nome_do_evento: nome_do_evento || '',
      evento_id: evento_id || null,
      data_hora_checkin: new Date().toISOString(),
      validacao_do_checkin: false,
    },
  ])
  .select()
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add app/api/checkin/route.ts
git commit -m "feat(api): allow null pelotao for personalizado events"
```

---

### Task 10: Success Page — Use real event data

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026/app/check-in/sucesso/page.tsx`

- [ ] **Step 1: Read all query params and render dynamic content**

Replace the entire `CheckInSucessoContent` function:

```tsx
function CheckInSucessoContent() {
  const searchParams = useSearchParams()
  const dataEvento = searchParams.get('data') || ''
  const nomeEvento = searchParams.get('evento') || ''
  const horario = searchParams.get('horario') || '07:00'
  const local = searchParams.get('local') || 'Parque da Cidade — Brasília, DF'
  const localUrl = searchParams.get('local_url') || ''
  const descricao = searchParams.get('descricao') || ''

  const formatarHorario = (h: string) => {
    const [hr, min] = h.split(':')
    return `A partir das ${hr}h${min === '00' ? '00' : min}`
  }

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <a href="/" className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors text-sm">
          <ArrowLeft className="w-4 h-4" />
          Voltar ao site
        </a>
      </header>

      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md text-center">

          {/* Ícone */}
          <div className="flex justify-center mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 rounded-full blur-2xl animate-pulse" />
              <div className="relative w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>

          <p className="text-orange-500 text-xs font-semibold uppercase tracking-widest mb-3">Check-in confirmado</p>
          <h1 className="text-3xl font-bold text-white mb-3">Você está dentro!</h1>
          <p className="text-zinc-400 text-sm leading-relaxed mb-10">
            Sua vaga para <span className="text-white font-medium">{nomeEvento}</span> foi reservada.
            {descricao ? ` ${descricao}` : ' Nos vemos lá!'}
          </p>

          {/* Detalhes */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-left space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Data</p>
                <p className="text-white text-sm font-medium">{dataEvento}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <Clock className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Horário</p>
                <p className="text-white text-sm font-medium">{formatarHorario(horario)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-4 h-4 text-orange-500" />
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Local</p>
                {localUrl ? (
                  <a
                    href={localUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white text-sm font-medium hover:text-orange-400 underline underline-offset-2 transition-colors"
                  >
                    {local}
                  </a>
                ) : (
                  <p className="text-white text-sm font-medium">{local}</p>
                )}
              </div>
            </div>
          </div>

          {/* Aviso */}
          <div className="bg-orange-950/40 border border-orange-500/30 rounded-xl p-4 mb-8 text-left">
            <p className="text-orange-300 text-xs font-semibold uppercase tracking-wide mb-1">Importante</p>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Salve o seu CPF cadastrado ou tire um print desta tela. Ele será usado para identificar sua presença no evento.
            </p>
          </div>

          {/* Link de localização */}
          {localUrl && (
            <a
              href={localUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full border border-orange-500 hover:bg-orange-500/10 text-orange-500 hover:text-orange-400 font-semibold py-3 rounded-xl text-center transition-all duration-200 text-sm mb-3"
            >
              Ver localização no mapa
            </a>
          )}

          <a
            href="/"
            className="block w-full border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white font-semibold py-4 rounded-xl text-center transition-all duration-200 text-sm"
          >
            Voltar ao site
          </a>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/sommarunningclub-novo-site-somma-club-2026
git add app/check-in/sucesso/page.tsx
git commit -m "feat(sucesso): use real event data instead of hardcoded values"
```

---

### Task 11: Admin Check-in Page — Handle personalizado events

**Files:**
- Modify: `/Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7/app/checkin/page.tsx`

- [ ] **Step 1: Identify pelotão column and filter**

In the admin check-in page, find where the pelotão filter and column are rendered. When the selected event is of tipo `personalizado`, the pelotão filter should be disabled/hidden and the pelotão column should show "—" for null values.

The event data is already fetched with all fields from the eventos API. Find the pelotão filter dropdown and wrap it:

Where the pelotão filter chips/dropdown is rendered, add a condition:

```tsx
{/* Only show pelotão filter if event is corrida type */}
{selectedEvento?.tipo !== 'personalizado' && (
  // ... existing pelotão filter ...
)}
```

For the pelotão column in the check-in table, update the cell to show "—" when pelotão is null/empty:

```tsx
<td>{checkin.pelotao || '—'}</td>
```

- [ ] **Step 2: Commit**

```bash
cd /Users/alexrodriguesdossantos/Projetos/v0-sistema-somma-de-gestao-l7
git add app/checkin/page.tsx
git commit -m "feat(admin): hide pelotão filter for personalizado events, show — for null"
```

---

### Task 12: Manual Testing

- [ ] **Step 1: Test admin — create personalizado event**

1. Open the admin panel → Eventos
2. Click "Novo Evento"
3. Select "Personalizado" type
4. Verify pelotões field is hidden
5. Fill: title, date, description, local, local_url
6. Set check-in status to "aberto"
7. Save — verify it appears in the list

- [ ] **Step 2: Test public check-in — personalizado flow**

1. Open the public check-in site
2. Verify the personalizado event appears with description and clickable location
3. Click to select the event
4. Verify it goes directly to personal data (step 2 of 2, no pelotão step)
5. Fill personal data and submit
6. Verify success page shows real event data with clickable location link

- [ ] **Step 3: Test corrida event still works**

1. Create a regular corrida event
2. Verify the 3-step flow still works (event → pelotão → data)
3. Verify success page shows real data

- [ ] **Step 4: Test admin check-ins view**

1. Go to admin check-in page
2. Select the personalizado event
3. Verify pelotão filter is hidden
4. Verify pelotão column shows "—" for personalizado check-ins
