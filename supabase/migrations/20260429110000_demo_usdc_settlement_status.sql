alter table public.settlements
  drop constraint if exists settlements_status_check;

alter table public.settlements
  add constraint settlements_status_check
  check (
    status in (
      'unpaid',
      'instructions_shown',
      'proof_submitted',
      'verifying',
      'verified',
      'rejected',
      'settled',
      'confirmed',
      'mocked'
    )
  );

alter table public.settlements
  alter column status set default 'proof_submitted';
