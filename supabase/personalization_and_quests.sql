-- OpenRun v2: profile personalization, follows (social graph), daily quests.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

-- 1. Profile personalization
alter table public.profiles add column if not exists avatar_emoji text;
alter table public.profiles add column if not exists accent_color text;  -- hex, e.g. '#f97316'
alter table public.profiles add column if not exists bio text;
alter table public.profiles add column if not exists fav_position text;   -- e.g. 'Point Guard'

-- 2. Follows (who you've added)
create table if not exists public.follows (
  follower_id  uuid not null references auth.users on delete cascade,
  following_id uuid not null references auth.users on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);
alter table public.follows enable row level security;

drop policy if exists "Follows readable by everyone" on public.follows;
create policy "Follows readable by everyone" on public.follows for select using (true);
drop policy if exists "Follow as yourself" on public.follows;
create policy "Follow as yourself" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "Unfollow your own" on public.follows;
create policy "Unfollow your own" on public.follows for delete using (auth.uid() = follower_id);

-- 3. Daily quest claims (one per quest per day), points awarded server-side after
--    verifying the quest is actually complete today — so points can't be faked.
create table if not exists public.quest_claims (
  user_id    uuid not null references auth.users on delete cascade,
  quest_date date not null,
  quest_key  text not null,
  points     int not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, quest_date, quest_key)
);
alter table public.quest_claims enable row level security;

drop policy if exists "Own claims readable" on public.quest_claims;
create policy "Own claims readable" on public.quest_claims for select using (auth.uid() = user_id);

create or replace function public.claim_quest(p_quest_key text)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  uid    uuid := auth.uid();
  today  date := (now() at time zone 'utc')::date;
  reward int;
  cnt    int;
  done   boolean := false;
begin
  if uid is null then raise exception 'not logged in'; end if;
  if exists (select 1 from quest_claims where user_id = uid and quest_date = today and quest_key = p_quest_key) then
    raise exception 'already claimed today';
  end if;

  if p_quest_key = 'join_game' then
    reward := 15;
    select count(*) into cnt from game_signups gs where gs.user_id = uid and gs.joined_at::date = today;
    done := cnt >= 1;
  elsif p_quest_key = 'send_message' then
    reward := 10;
    select count(*) into cnt from messages m where m.sender_id = uid and m.created_at::date = today;
    done := cnt >= 1;
  elsif p_quest_key = 'meet_new' then
    reward := 20;
    select count(*) into cnt from (
      select recipient_id from messages where sender_id = uid and created_at::date = today
      except
      select recipient_id from messages where sender_id = uid and created_at::date < today
    ) t;
    done := cnt >= 1;
  else
    raise exception 'unknown quest';
  end if;

  if not done then raise exception 'quest not complete yet'; end if;

  insert into quest_claims (user_id, quest_date, quest_key, points) values (uid, today, p_quest_key, reward);
  update profiles set points = points + reward where id = uid;
  return reward;
end;
$$;

grant execute on function public.claim_quest(text) to authenticated;
