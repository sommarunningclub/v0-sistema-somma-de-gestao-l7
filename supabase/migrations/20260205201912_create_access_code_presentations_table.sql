
-- Junction table: which presentations each code unlocks
create table if not exists public.access_code_presentations (
  id uuid primary key default gen_random_uuid(),
  access_code_id uuid not null references public.access_codes(id) on delete cascade,
  presentation_id uuid not null references public.presentations(id) on delete cascade,
  unique(access_code_id, presentation_id)
);

alter table public.access_code_presentations enable row level security;
create policy "acp_select_auth" on public.access_code_presentations for select using (auth.role() = 'authenticated');
create policy "acp_insert_auth" on public.access_code_presentations for insert with check (auth.role() = 'authenticated');
create policy "acp_update_auth" on public.access_code_presentations for update using (auth.role() = 'authenticated');
create policy "acp_delete_auth" on public.access_code_presentations for delete using (auth.role() = 'authenticated');

-- Anonymous users can read (to load presentations for a valid code)
create policy "acp_select_anon" on public.access_code_presentations for select using (auth.role() = 'anon');
;
