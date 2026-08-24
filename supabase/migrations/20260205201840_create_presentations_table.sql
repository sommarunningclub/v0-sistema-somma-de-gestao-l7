
-- Presentations table
create table if not exists public.presentations (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  client_id uuid references public.clients(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.presentations enable row level security;
create policy "presentations_select_auth" on public.presentations for select using (auth.role() = 'authenticated');
create policy "presentations_insert_auth" on public.presentations for insert with check (auth.role() = 'authenticated');
create policy "presentations_update_auth" on public.presentations for update using (auth.role() = 'authenticated');
create policy "presentations_delete_auth" on public.presentations for delete using (auth.role() = 'authenticated');
;
