
-- Access logs table
create table if not exists public.access_logs (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references public.access_codes(id) on delete cascade,
  presentation_id uuid references public.presentations(id) on delete set null,
  ip_address text,
  user_agent text,
  action text not null default 'view' check (action in ('validate', 'view', 'navigate')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

alter table public.access_logs enable row level security;
create policy "logs_select_auth" on public.access_logs for select using (auth.role() = 'authenticated');
create policy "logs_insert_auth" on public.access_logs for insert with check (auth.role() = 'authenticated');

-- Anonymous users can insert logs (for tracking access)
create policy "logs_insert_anon" on public.access_logs for insert with check (auth.role() = 'anon');

-- Anonymous read policy for presentations (needed to load presentation content)
create policy "presentations_select_anon" on public.presentations for select using (auth.role() = 'anon');
create policy "sections_select_anon" on public.sections for select using (auth.role() = 'anon');
create policy "blocks_select_anon" on public.blocks for select using (auth.role() = 'anon');
;
