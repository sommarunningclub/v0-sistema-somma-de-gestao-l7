
-- Blocks table (dynamic content blocks within sections)
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete cascade,
  type text not null check (type in ('hero', 'text', 'image', 'video', 'stats', 'quote', 'cta', 'features', 'gallery', 'divider')),
  content jsonb not null default '{}'::jsonb,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.blocks enable row level security;
create policy "blocks_select_auth" on public.blocks for select using (auth.role() = 'authenticated');
create policy "blocks_insert_auth" on public.blocks for insert with check (auth.role() = 'authenticated');
create policy "blocks_update_auth" on public.blocks for update using (auth.role() = 'authenticated');
create policy "blocks_delete_auth" on public.blocks for delete using (auth.role() = 'authenticated');
;
