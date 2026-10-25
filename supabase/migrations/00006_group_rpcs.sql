-- BingeWyrm: group creation and invite code regeneration

-- ==================== CREATE GROUP ====================
-- Atomically creates a group, adds the creator as a member, sets them as leader.
create or replace function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group public.groups;
begin
  insert into public.groups (name, leader_id)
  values (p_name, auth.uid())
  returning * into v_group;

  insert into public.group_members (group_id, user_id)
  values (v_group.id, auth.uid());

  return v_group;
end;
$$;

-- ==================== REGENERATE INVITE CODE ====================
-- Leader-only: generates a new invite_code, invalidating the previous one.
create or replace function public.regenerate_invite_code(p_group_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_code uuid;
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'Only the leader can regenerate the invite code';
  end if;

  update public.groups
  set invite_code = gen_random_uuid()
  where id = p_group_id
  returning invite_code into v_new_code;

  return v_new_code;
end;
$$;
