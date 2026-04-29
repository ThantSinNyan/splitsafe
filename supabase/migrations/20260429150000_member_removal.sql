create or replace function public.remove_workspace_member(target_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_member public.workspace_members%rowtype;
  actor_role text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into target_member
  from public.workspace_members
  where id = target_member_id
    and status = 'active'
  limit 1;

  if target_member.id is null then
    raise exception 'Member not found';
  end if;

  actor_role := public.workspace_role(target_member.workspace_id);

  if actor_role is null then
    raise exception 'You are not a member of this group';
  end if;

  if target_member.user_id = auth.uid() then
    raise exception 'You cannot remove yourself';
  end if;

  if actor_role = 'admin' and target_member.role <> 'member' then
    raise exception 'Admins can only remove members';
  end if;

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only owners and admins can remove members';
  end if;

  delete from public.workspace_members
  where id = target_member.id;

  return target_member.workspace_id;
end;
$$;

drop policy if exists "owner and admin can remove members" on public.workspace_members;

create policy "owner and admin can remove members"
  on public.workspace_members for delete to authenticated
  using (false);

grant execute on function public.remove_workspace_member(uuid) to authenticated;
