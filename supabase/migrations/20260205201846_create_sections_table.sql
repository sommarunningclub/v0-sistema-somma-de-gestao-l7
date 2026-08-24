
-- Sections table
create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  title text not null,
  sort_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sections enable row level security;
create policy "sections_select_auth" on public.sections for select using (auth.role() = 'authenticated');
create policy "sections_insert_auth" on public.sections for insert with check (auth.role() = 'authenticated');
create policy "sections_update_auth" on public.sections for update using (auth.role() = 'authenticated');
create policy "sections_delete_auth" on public.sections for delete using (auth.role() = 'authenticated');
;
