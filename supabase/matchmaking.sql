-- OpenRun matchmaking: richer player info, balanced teams, points.
-- Run once in Supabase → SQL Editor → New query → paste → Run.

-- Part A: richer player info + points/record
alter table public.profiles add column if not exists age int;
alter table public.profiles add column if not exists years_experience int;
alter table public.profiles add column if not exists points int not null default 0;
alter table public.profiles add column if not exists wins int not null default 0;
alter table public.profiles add column if not exists losses int not null default 0;

-- Part C/D: teams + result on each game
alter table public.games add column if not exists status text not null default 'open'; -- open | teams_set | finished
alter table public.games add column if not exists teams jsonb;                          -- {"A":[uid,...],"B":[uid,...]}
alter table public.games add column if not exists winner text;                          -- 'A' | 'B'

-- Awarding points touches every player's row, so it must bypass RLS — but only
-- the game's host may call it, and only once. Winners +25, everyone +5 for showing up.
create or replace function public.finish_game(p_game_id bigint, p_winner text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  g       public.games;
  winners uuid[];
  losers  uuid[];
  uid     uuid;
begin
  select * into g from public.games where id = p_game_id;
  if g.id is null then raise exception 'game not found'; end if;
  if g.host_id <> auth.uid() then raise exception 'only the host can finish this game'; end if;
  if g.teams is null then raise exception 'set teams first'; end if;
  if p_winner not in ('A','B') then raise exception 'winner must be A or B'; end if;
  if g.status = 'finished' then raise exception 'game already finished'; end if;

  if p_winner = 'A' then
    winners := array(select jsonb_array_elements_text(g.teams->'A'))::uuid[];
    losers  := array(select jsonb_array_elements_text(g.teams->'B'))::uuid[];
  else
    winners := array(select jsonb_array_elements_text(g.teams->'B'))::uuid[];
    losers  := array(select jsonb_array_elements_text(g.teams->'A'))::uuid[];
  end if;

  foreach uid in array winners loop
    update public.profiles set points = points + 25, wins = wins + 1 where id = uid;
  end loop;
  foreach uid in array losers loop
    update public.profiles set points = points + 5, losses = losses + 1 where id = uid;
  end loop;

  update public.games set winner = p_winner, status = 'finished' where id = p_game_id;
end;
$$;

grant execute on function public.finish_game(bigint, text) to authenticated;
