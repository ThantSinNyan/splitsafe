create extension if not exists "pgcrypto";

-- SplitSafe v2 account-based schema.
-- This resets the earlier hackathon demo tables so the app uses authenticated
-- workspaces and Supabase RLS instead of global demo data.
drop table if exists public.settlements cascade;
drop table if exists public.ai_messages cascade;
drop table if exists public.expense_splits cascade;
drop table if exists public.expenses cascade;
drop table if exists public.invites cascade;
drop table if exists public.workspace_members cascade;
drop table if exists public.workspaces cascade;
drop table if exists public.group_members cascade;
drop table if exists public.groups cascade;
drop table if exists public.profiles cascade;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.accept_invite(text);
drop function if exists public.can_manage_workspace(uuid);
drop function if exists public.can_view_profile(uuid);
drop function if exists public.current_user_email();
drop function if exists public.is_workspace_member(uuid);
drop function if exists public.workspace_role(uuid);
drop function if exists public.handle_new_user();

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  email text unique,
  avatar_url text,
  wallet_address text,
  created_at timestamptz not null default now()
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  currency text not null default 'USD',
  total_budget numeric not null default 0,
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  status text not null default 'active' check (status in ('active', 'pending')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  invited_email text not null,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  invite_token text not null unique,
  role text not null default 'member' check (role in ('admin', 'member')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'expired')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '7 days')
);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  paid_by uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric not null,
  category text not null default 'other',
  notes text,
  created_at timestamptz not null default now()
);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_owed numeric not null,
  status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
  settlement_tx_hash text,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  expense_split_id uuid not null references public.expense_splits(id) on delete cascade,
  sender_user_id uuid not null references public.profiles(id) on delete cascade,
  receiver_user_id uuid not null references public.profiles(id) on delete cascade,
  sender_wallet text not null,
  receiver_wallet text not null,
  amount numeric not null,
  tx_hash text not null,
  network text not null default 'base-sepolia',
  status text not null default 'mocked' check (status in ('confirmed', 'mocked')),
  created_at timestamptz not null default now()
);

create table public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

create index profiles_email_idx on public.profiles (lower(email));
create index profiles_wallet_address_idx on public.profiles (wallet_address);
create index workspaces_owner_id_idx on public.workspaces (owner_id);
create index workspaces_created_at_idx on public.workspaces (created_at desc);
create index workspace_members_workspace_id_idx on public.workspace_members (workspace_id);
create index workspace_members_user_id_idx on public.workspace_members (user_id);
create index invites_workspace_id_idx on public.invites (workspace_id);
create index invites_email_status_idx on public.invites (lower(invited_email), status);
create index invites_token_idx on public.invites (invite_token);
create index expenses_workspace_id_idx on public.expenses (workspace_id);
create index expenses_paid_by_idx on public.expenses (paid_by);
create index expense_splits_workspace_id_idx on public.expense_splits (workspace_id);
create index expense_splits_expense_id_idx on public.expense_splits (expense_id);
create index expense_splits_user_id_idx on public.expense_splits (user_id);
create index expense_splits_status_idx on public.expense_splits (status);
create index settlements_workspace_id_idx on public.settlements (workspace_id);
create index settlements_tx_hash_idx on public.settlements (tx_hash);
create index ai_messages_workspace_created_at_idx on public.ai_messages (workspace_id, created_at);

create or replace function public.current_user_email()
returns text
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

create or replace function public.is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace_id
      and wm.user_id = auth.uid()
      and wm.status = 'active'
  );
$$;

create or replace function public.workspace_role(target_workspace_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select wm.role
  from public.workspace_members wm
  where wm.workspace_id = target_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  limit 1;
$$;

create or replace function public.can_manage_workspace(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.workspace_role(target_workspace_id) in ('owner', 'admin'), false);
$$;

create or replace function public.can_view_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile_id = auth.uid()
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on theirs.workspace_id = mine.workspace_id
      where mine.user_id = auth.uid()
        and mine.status = 'active'
        and theirs.user_id = target_profile_id
        and theirs.status = 'active'
    );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Demo tester'
    ),
    lower(new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do update
    set name = coalesce(excluded.name, public.profiles.name),
        email = coalesce(excluded.email, public.profiles.email),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.accept_invite(target_invite_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invite_record public.invites%rowtype;
  current_email text := public.current_user_email();
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select *
  into invite_record
  from public.invites
  where invite_token = target_invite_token
  limit 1;

  if invite_record.id is null then
    raise exception 'Invite not found';
  end if;

  if invite_record.status <> 'pending' or invite_record.expires_at < now() then
    update public.invites
    set status = 'expired'
    where id = invite_record.id
      and status = 'pending';
    raise exception 'Invite is expired';
  end if;

  if lower(invite_record.invited_email) <> current_email then
    raise exception 'This invite belongs to a different email address';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role, status)
  values (invite_record.workspace_id, auth.uid(), invite_record.role, 'active')
  on conflict (workspace_id, user_id) do update
    set role = excluded.role,
        status = 'active';

  update public.invites
  set status = 'accepted',
      accepted_at = now()
  where id = invite_record.id;

  return invite_record.workspace_id;
end;
$$;

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.invites enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.ai_messages enable row level security;

create policy "profiles are visible to self and co-members"
  on public.profiles for select to authenticated
  using (public.can_view_profile(id));

create policy "users can update own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "users can insert own profile"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "members can read their workspaces"
  on public.workspaces for select to authenticated
  using (public.is_workspace_member(id) or owner_id = auth.uid());

create policy "users can create owned workspaces"
  on public.workspaces for insert to authenticated
  with check (owner_id = auth.uid());

create policy "owner and admin can update workspaces"
  on public.workspaces for update to authenticated
  using (public.can_manage_workspace(id))
  with check (public.can_manage_workspace(id));

create policy "owners can delete workspaces"
  on public.workspaces for delete to authenticated
  using (public.workspace_role(id) = 'owner');

create policy "members can read workspace members"
  on public.workspace_members for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "owner can create initial membership"
  on public.workspace_members for insert to authenticated
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and status = 'active'
      and exists (
        select 1 from public.workspaces w
        where w.id = workspace_id
          and w.owner_id = auth.uid()
      )
    )
    or public.can_manage_workspace(workspace_id)
  );

create policy "owner and admin can update members"
  on public.workspace_members for update to authenticated
  using (public.can_manage_workspace(workspace_id))
  with check (public.can_manage_workspace(workspace_id));

create policy "owner and admin can remove members"
  on public.workspace_members for delete to authenticated
  using (public.can_manage_workspace(workspace_id));

create policy "members and invited users can read invites"
  on public.invites for select to authenticated
  using (
    public.can_manage_workspace(workspace_id)
    or lower(invited_email) = public.current_user_email()
  );

create policy "owner and admin can create invites"
  on public.invites for insert to authenticated
  with check (
    public.can_manage_workspace(workspace_id)
    and invited_by = auth.uid()
  );

create policy "owner admin or invited user can update invites"
  on public.invites for update to authenticated
  using (
    public.can_manage_workspace(workspace_id)
    or lower(invited_email) = public.current_user_email()
  )
  with check (
    public.can_manage_workspace(workspace_id)
    or lower(invited_email) = public.current_user_email()
  );

create policy "members can read workspace expenses"
  on public.expenses for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members can create allowed expenses"
  on public.expenses for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and (paid_by = auth.uid() or public.can_manage_workspace(workspace_id))
  );

create policy "payer owner admin can update expenses"
  on public.expenses for update to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (paid_by = auth.uid() or public.can_manage_workspace(workspace_id))
  )
  with check (
    public.is_workspace_member(workspace_id)
    and (paid_by = auth.uid() or public.can_manage_workspace(workspace_id))
  );

create policy "payer owner admin can delete expenses"
  on public.expenses for delete to authenticated
  using (
    public.is_workspace_member(workspace_id)
    and (paid_by = auth.uid() or public.can_manage_workspace(workspace_id))
  );

create policy "members can read workspace splits"
  on public.expense_splits for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "expense creators can create splits"
  on public.expense_splits for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and exists (
      select 1 from public.expenses e
      where e.id = expense_id
        and e.workspace_id = workspace_id
        and (e.paid_by = auth.uid() or public.can_manage_workspace(workspace_id))
    )
  );

create policy "members can update splits in their workspace"
  on public.expense_splits for update to authenticated
  using (public.is_workspace_member(workspace_id))
  with check (public.is_workspace_member(workspace_id));

create policy "members can read settlements"
  on public.settlements for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members can create own settlements"
  on public.settlements for insert to authenticated
  with check (
    public.is_workspace_member(workspace_id)
    and sender_user_id = auth.uid()
  );

create policy "members can read ai messages"
  on public.ai_messages for select to authenticated
  using (public.is_workspace_member(workspace_id));

create policy "members can create ai messages"
  on public.ai_messages for insert to authenticated
  with check (public.is_workspace_member(workspace_id));

grant execute on function public.accept_invite(text) to authenticated;
