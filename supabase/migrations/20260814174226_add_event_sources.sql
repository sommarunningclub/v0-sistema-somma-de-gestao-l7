alter table public.calendar_events
  add column if not exists source_label text,
  add column if not exists source_url text;

create or replace function public.bump_event_on_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  new.uid = old.uid;

  if new.status = 'published' and old.status is distinct from 'published' then
    new.published_at = coalesce(new.published_at, now());
  end if;

  if old.status = 'published' and (
       new.start_datetime   is distinct from old.start_datetime
    or new.end_datetime     is distinct from old.end_datetime
    or new.title            is distinct from old.title
    or new.summary          is distinct from old.summary
    or new.description      is distinct from old.description
    or new.location_name    is distinct from old.location_name
    or new.location_address is distinct from old.location_address
    or new.location_url     is distinct from old.location_url
    or new.checkin_url      is distinct from old.checkin_url
    or new.cta_label        is distinct from old.cta_label
    or new.cta_url          is distinct from old.cta_url
    or new.source_label     is distinct from old.source_label
    or new.source_url       is distinct from old.source_url
    or new.recurrence_rule  is distinct from old.recurrence_rule
    or new.is_recurring     is distinct from old.is_recurring
    or new.is_all_day       is distinct from old.is_all_day
    or new.timezone         is distinct from old.timezone
    or new.status           is distinct from old.status
  ) then
    new.sequence = old.sequence + 1;
  end if;

  return new;
end;
$$;;
