create extension if not exists "pgcrypto";

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  wallet_address text,
  display_name text,
  created_at timestamptz not null default now()
);

create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  budget_amount numeric not null default 0,
  currency text not null default 'USDC',
  category text not null default 'other',
  created_by_wallet text,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  name text not null,
  wallet_address text not null,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

create table if not exists expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  amount numeric not null,
  category text not null default 'other',
  paid_by_member_id uuid references group_members(id) on delete set null,
  split_member_ids jsonb not null default '[]'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references expenses(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  from_member_id uuid references group_members(id) on delete set null,
  to_member_id uuid references group_members(id) on delete set null,
  amount numeric not null,
  status text not null default 'unpaid',
  settlement_tx_hash text,
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create table if not exists settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  expense_split_id uuid not null references expense_splits(id) on delete cascade,
  sender_wallet text not null,
  receiver_wallet text not null,
  amount numeric not null,
  tx_hash text not null,
  network text not null,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists ai_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  role text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_wallet_address_idx on profiles (wallet_address);
create index if not exists groups_created_by_wallet_idx on groups (created_by_wallet);
create index if not exists groups_created_at_idx on groups (created_at desc);
create index if not exists group_members_group_id_idx on group_members (group_id);
create index if not exists group_members_wallet_address_idx on group_members (wallet_address);
create index if not exists expenses_group_id_idx on expenses (group_id);
create index if not exists expenses_paid_by_member_id_idx on expenses (paid_by_member_id);
create index if not exists expense_splits_group_id_idx on expense_splits (group_id);
create index if not exists expense_splits_expense_id_idx on expense_splits (expense_id);
create index if not exists expense_splits_status_idx on expense_splits (status);
create index if not exists expense_splits_from_to_idx on expense_splits (from_member_id, to_member_id);
create index if not exists settlements_group_id_idx on settlements (group_id);
create index if not exists settlements_tx_hash_idx on settlements (tx_hash);
create index if not exists ai_messages_group_id_created_at_idx on ai_messages (group_id, created_at);
