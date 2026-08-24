
-- Clients table
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients enable row level security;
create policy "clients_select_auth" on public.clients for select using (auth.role() = 'authenticated');
create policy "clients_insert_auth" on public.clients for insert with check (auth.role() = 'authenticated');
create policy "clients_update_auth" on public.clients for update using (auth.role() = 'authenticated');
create policy "clients_delete_auth" on public.clients for delete using (auth.role() = 'authenticated');
;
