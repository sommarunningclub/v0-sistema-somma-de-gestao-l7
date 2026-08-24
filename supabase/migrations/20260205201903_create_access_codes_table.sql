
-- Access codes table
create table if not exists public.access_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  is_active boolean not null default true,
  expires_at timestamptz,
  max_views int,
  current_views int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.access_codes enable row level security;

-- Authenticated users (admin) can manage codes
create policy "access_codes_select_auth" on public.access_codes for select using (auth.role() = 'authenticated');
create policy "access_codes_insert_auth" on public.access_codes for insert with check (auth.role() = 'authenticated');
create policy "access_codes_update_auth" on public.access_codes for update using (auth.role() = 'authenticated');
create policy "access_codes_delete_auth" on public.access_codes for delete using (auth.role() = 'authenticated');

-- Anonymous users can only select (for code validation)
create policy "access_codes_select_anon" on public.access_codes for select using (auth.role() = 'anon');
;
