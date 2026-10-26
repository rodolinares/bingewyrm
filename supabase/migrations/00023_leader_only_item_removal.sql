create or replace function public.remove_item(p_item_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_group_leader(public.get_item_owner_group_id(p_item_id)) then
    raise exception 'Only the leader can remove items';
  end if;
  update public.items set removed_at = now() where id = p_item_id;
end;
$$;

create or replace function public.remove_items(p_item_ids uuid[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if exists (
    select 1 from unnest(p_item_ids) as t(id)
    where not public.is_group_leader(public.get_item_owner_group_id(t.id))
  ) then
    raise exception 'Only the leader can remove items';
  end if;
  update public.items set removed_at = now() where id = any(p_item_ids);
end;
$$;
