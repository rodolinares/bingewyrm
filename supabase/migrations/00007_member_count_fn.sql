-- BingeWyrm: member count helper for group list
create or replace function public.get_member_count(p_group_ids uuid[])
returns table(group_id uuid, count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select gm.group_id, count(*)
  from public.group_members gm
  where gm.group_id = any(p_group_ids)
  group by gm.group_id;
$$;

revoke execute on function public.get_member_count(uuid[]) from anon;
