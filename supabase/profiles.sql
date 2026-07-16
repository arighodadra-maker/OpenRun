-- OpenRun — profiles table + security + auto-create-on-signup
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste → Run.

-- 1. Profile row per user, linked to Supabase's built-in auth.users table.
create table if not exists public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  username    text unique,
  full_name   text,
  home_court  text,
  skill_level text,
  updated_at  timestamptz default now()
);

-- 2. Row Level Security: anyone can read profiles, but you can only edit your own.
alter table public.profiles enable row level security;

drop policy if exists "Profiles are viewable by everyone" on public.profiles;
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- 3. Automatically create a blank profile whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data->>'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
