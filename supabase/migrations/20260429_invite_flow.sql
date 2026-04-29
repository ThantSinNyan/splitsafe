create or replace function public.cancel_invite(target_invite_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.invites%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.invites
  where id = target_invite_id
  limit 1;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  if not public.can_manage_workspace(invite_record.workspace_id) then
    raise exception 'Only group owners and admins can cancel invites';
  end if;

  update public.invites
  set status = 'expired'
  where id = invite_record.id
    and status = 'pending';

  return invite_record.workspace_id;
end;
$$;

create or replace function public.invite_preview(target_invite_token text)
returns table (
  workspace_id uuid,
  group_name text,
  invited_email text,
  role text,
  status text,
  expires_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.workspace_id,
    w.name as group_name,
    i.invited_email,
    i.role,
    case
      when i.status = 'pending' and i.expires_at < now() then 'expired'
      else i.status
    end as status,
    i.expires_at
  from public.invites i
  join public.workspaces w on w.id = i.workspace_id
  where i.invite_token = target_invite_token
  limit 1;
$$;

drop policy if exists "owner admin or invited user can update invites" on public.invites;
drop policy if exists "owner and admin can update invites" on public.invites;

create policy "owner and admin can update invites"
  on public.invites for update to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

grant execute on function public.cancel_invite(uuid) to authenticated;
grant execute on function public.invite_preview(text) to anon, authenticated;
