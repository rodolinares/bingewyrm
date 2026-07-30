update public.sessions set outcome = 'saved' where outcome = 'recycled';

alter table public.sessions drop constraint if exists sessions_outcome_check;
alter table public.sessions add constraint sessions_outcome_check
  check (outcome in ('saved', 'discarded'));
