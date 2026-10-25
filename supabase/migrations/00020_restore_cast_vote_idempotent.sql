-- 00010 was re-applied after 00013 and reverted cast_vote to the non-idempotent version.
create or replace function public.cast_vote(
  p_session_id uuid,
  p_item_id uuid,
  p_value boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.votes (session_id, item_id, user_id, value, is_auto)
  values (p_session_id, p_item_id, auth.uid(), p_value, false)
  on conflict (session_id, item_id, user_id) do nothing;
end;
$$;
