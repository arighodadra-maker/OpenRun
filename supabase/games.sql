-- OpenRun pickup games: host a game at a court, others join.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

create table if not exists public.games (
  id           bigint generated always as identity primary key,
  host_id      uuid not null references auth.users on delete cascade,
  court_osm_id text not null,               -- OpenStreetMap id of the court
  court_name   text not null,
  court_lat    double precision,
  court_lon    double precision,
  start_time   timestamptz not null,        -- when the game starts
  skill_req    text,                         -- 'Any' | 'Beginner' | 'Intermediate' | 'Advanced' | 'Hooper'
  age_group    text,                         -- 'Any' | 'Under 18' | '18+' | '21+' | '30+'
  max_slots    int not null check (max_slots between 2 and 50),
  notes        text,
  created_at   timestamptz not null default now()
);

create index if not exists games_court_idx on public.games (court_osm_id, start_time);

alter table public.games enable row level security;

drop policy if exists "Games readable by everyone" on public.games;
create policy "Games readable by everyone" on public.games for select using (true);

drop policy if exists "Host can create games" on public.games;
create policy "Host can create games" on public.games for insert with check (auth.uid() = host_id);

drop policy if exists "Host can update own games" on public.games;
create policy "Host can update own games" on public.games for update using (auth.uid() = host_id);

drop policy if exists "Host can delete own games" on public.games;
create policy "Host can delete own games" on public.games for delete using (auth.uid() = host_id);

-- Who's in each game.
create table if not exists public.game_signups (
  game_id   bigint not null references public.games on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

alter table public.game_signups enable row level security;

drop policy if exists "Signups readable by everyone" on public.game_signups;
create policy "Signups readable by everyone" on public.game_signups for select using (true);

drop policy if exists "Join as yourself" on public.game_signups;
create policy "Join as yourself" on public.game_signups for insert with check (auth.uid() = user_id);

drop policy if exists "Leave your own games" on public.game_signups;
create policy "Leave your own games" on public.game_signups for delete using (auth.uid() = user_id);
