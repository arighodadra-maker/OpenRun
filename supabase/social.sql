-- OpenRun social features: saved availability + direct messages
-- Run once in Supabase → SQL Editor → New query → paste → Run.

-- 1. Store each hooper's weekly availability (same base64 string the calendar uses).
alter table public.profiles add column if not exists availability text;

-- 2. Direct messages between hoopers.
create table if not exists public.messages (
  id           bigint generated always as identity primary key,
  sender_id    uuid not null references auth.users on delete cascade,
  recipient_id uuid not null references auth.users on delete cascade,
  content      text not null check (char_length(content) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index if not exists messages_pair_idx on public.messages (sender_id, recipient_id, created_at);
create index if not exists messages_recipient_idx on public.messages (recipient_id, created_at);

alter table public.messages enable row level security;

-- You can only read messages you sent or received.
drop policy if exists "Read your own messages" on public.messages;
create policy "Read your own messages" on public.messages for select
  using (auth.uid() = sender_id or auth.uid() = recipient_id);

-- You can only send messages as yourself.
drop policy if exists "Send messages as yourself" on public.messages;
create policy "Send messages as yourself" on public.messages for insert
  with check (auth.uid() = sender_id);

-- 3. Turn on realtime so new messages appear live (ignore error if already enabled).
do $$
begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null;
end $$;
