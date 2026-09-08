create table if not exists public.copilot_commands (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null check (char_length(trim(prompt)) between 1 and 16000),
  status text not null default 'queued'
    check (status in ('queued', 'running', 'completed', 'failed')),
  output text not null default '',
  exit_code integer,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists copilot_commands_owner_created_idx
  on public.copilot_commands (owner_id, created_at desc);

alter table public.copilot_commands enable row level security;

create policy "Owners can read their commands"
  on public.copilot_commands for select
  using (owner_id = auth.uid());

create policy "Owners can enqueue commands"
  on public.copilot_commands for insert
  with check (owner_id = auth.uid() and status = 'queued' and output = '');

create or replace function public.claim_copilot_command()
returns setof public.copilot_commands
language plpgsql
security definer
set search_path = public
as $$
declare
  command_id uuid;
begin
  select id into command_id
  from public.copilot_commands
  where status = 'queued'
  order by created_at
  for update skip locked
  limit 1;

  if command_id is null then
    return;
  end if;

  update public.copilot_commands
  set status = 'running', started_at = now()
  where id = command_id;

  return query select * from public.copilot_commands where id = command_id;
end;
$$;

revoke all on function public.claim_copilot_command() from public;
grant execute on function public.claim_copilot_command() to service_role;
