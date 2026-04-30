create or replace function public.update_workspace_member_role(
  target_member_id uuid,
  target_role text
)
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

  if target_role not in ('admin', 'member') then
    raise exception 'Role must be admin or member';
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

  if actor_role <> 'owner' then
    raise exception 'Only the owner can change member roles';
  end if;

  if target_member.user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;

  if target_member.role = 'owner' then
    raise exception 'Owner role cannot be changed';
  end if;

  update public.workspace_members
  set role = target_role
  where id = target_member.id;

  return target_member.workspace_id;
end;
$$;

drop policy if exists "owner and admin can update members" on public.workspace_members;

create policy "owner and admin can update members"
  on public.workspace_members for update to authenticated
  using (false)
  with check (false);

grant execute on function public.update_workspace_member_role(uuid, text) to authenticated;
