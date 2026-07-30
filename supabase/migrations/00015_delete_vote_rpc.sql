create or replace function public.delete_vote(
  p_session_id uuid,
  p_item_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.votes
  where session_id = p_session_id
    and item_id = p_item_id
    and user_id = auth.uid();
end;
$$;
