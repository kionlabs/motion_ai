create extension if not exists pgcrypto with schema extensions;

create schema if not exists motion_ai;

revoke all on schema motion_ai from public;
grant usage on schema motion_ai to anon, authenticated, service_role;

create table if not exists motion_ai.class_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 80),
  code_hash text not null unique,
  teacher_id uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('draft', 'active', 'closed')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists motion_ai.teams (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references motion_ai.class_sessions(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 30),
  scenario_id text not null check (scenario_id in ('game', 'hospital', 'home', 'stage', 'accessibility', 'sports')),
  access_token_hash text not null,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

create table if not exists motion_ai.project_results (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null unique references motion_ai.teams(id) on delete cascade,
  initial_accuracy smallint not null default 0 check (initial_accuracy between 0 and 100),
  final_accuracy smallint not null default 0 check (final_accuracy between 0 and 100),
  correct_count smallint not null default 0 check (correct_count between 0 and 1000),
  wrong_count smallint not null default 0 check (wrong_count between 0 and 1000),
  improvement_count smallint not null default 0 check (improvement_count between 0 and 50),
  participant_count smallint not null default 1 check (participant_count between 1 and 20),
  reflection text not null default '' check (char_length(reflection) <= 500),
  teacher_motion_design smallint not null default 0 check (teacher_motion_design between 0 and 15),
  teacher_data_diversity smallint not null default 0 check (teacher_data_diversity between 0 and 10),
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table motion_ai.class_sessions enable row level security;
alter table motion_ai.teams enable row level security;
alter table motion_ai.project_results enable row level security;

revoke all on all tables in schema motion_ai from anon, authenticated;
revoke all on all sequences in schema motion_ai from anon, authenticated;

create or replace function motion_ai.create_class_session(
  p_title text,
  p_class_code text,
  p_ends_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = motion_ai, public, pg_temp
as $$
declare
  v_id uuid;
  v_code text := upper(regexp_replace(trim(p_class_code), '[^A-Z0-9]', '', 'g'));
begin
  if char_length(v_code) < 4 or char_length(v_code) > 10 then
    raise exception '수업 코드는 영문 대문자와 숫자 4~10자로 입력하세요.';
  end if;

  insert into motion_ai.class_sessions (title, code_hash, teacher_id, ends_at)
  values (trim(p_title), encode(extensions.digest(v_code, 'sha256'), 'hex'), auth.uid(), p_ends_at)
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function motion_ai.register_team(
  p_class_code text,
  p_team_name text,
  p_scenario_id text
)
returns table(team_id uuid, team_token text, session_title text)
language plpgsql
security definer
set search_path = motion_ai, public, pg_temp
as $$
declare
  v_session motion_ai.class_sessions%rowtype;
  v_token text := gen_random_uuid()::text;
  v_name text := trim(p_team_name);
  v_code text := upper(regexp_replace(trim(p_class_code), '[^A-Z0-9]', '', 'g'));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 30 then
    raise exception '모둠 이름은 1~30자로 입력하세요.';
  end if;

  if p_scenario_id not in ('game', 'hospital', 'home', 'stage', 'accessibility', 'sports') then
    raise exception '올바른 진로 카드를 선택하세요.';
  end if;

  select * into v_session
  from motion_ai.class_sessions
  where code_hash = encode(extensions.digest(v_code, 'sha256'), 'hex')
    and status = 'active'
    and starts_at <= now()
    and (ends_at is null or ends_at > now())
  limit 1;

  if v_session.id is null then
    raise exception '활성화된 수업 코드를 찾을 수 없습니다.';
  end if;

  insert into motion_ai.teams (session_id, name, scenario_id, access_token_hash)
  values (v_session.id, v_name, p_scenario_id, encode(extensions.digest(v_token, 'sha256'), 'hex'))
  returning id into team_id;

  team_token := v_token;
  session_title := v_session.title;
  return next;
exception
  when unique_violation then
    raise exception '같은 수업에 이미 사용 중인 모둠 이름입니다.';
end;
$$;

create or replace function motion_ai.submit_project_result(
  p_team_id uuid,
  p_team_token text,
  p_initial_accuracy integer,
  p_final_accuracy integer,
  p_correct_count integer,
  p_wrong_count integer,
  p_improvement_count integer,
  p_participant_count integer,
  p_reflection text default ''
)
returns table(auto_score integer, total_score integer)
language plpgsql
security definer
set search_path = motion_ai, public, pg_temp
as $$
declare
  v_result motion_ai.project_results%rowtype;
begin
  if not exists (
    select 1 from motion_ai.teams
    where id = p_team_id
      and access_token_hash = encode(extensions.digest(p_team_token, 'sha256'), 'hex')
  ) then
    raise exception '모둠 제출 권한을 확인할 수 없습니다.';
  end if;

  insert into motion_ai.project_results (
    team_id, initial_accuracy, final_accuracy, correct_count, wrong_count,
    improvement_count, participant_count, reflection, submitted_at, updated_at
  ) values (
    p_team_id,
    greatest(0, least(100, p_initial_accuracy)),
    greatest(0, least(100, p_final_accuracy)),
    greatest(0, least(1000, p_correct_count)),
    greatest(0, least(1000, p_wrong_count)),
    greatest(0, least(50, p_improvement_count)),
    greatest(1, least(20, p_participant_count)),
    left(coalesce(p_reflection, ''), 500),
    now(), now()
  )
  on conflict (team_id) do update set
    initial_accuracy = excluded.initial_accuracy,
    final_accuracy = excluded.final_accuracy,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    improvement_count = excluded.improvement_count,
    participant_count = excluded.participant_count,
    reflection = excluded.reflection,
    updated_at = now()
  returning * into v_result;

  auto_score :=
    round(v_result.final_accuracy * 0.30)::integer
    + round(greatest(v_result.final_accuracy - v_result.initial_accuracy, 0) * 0.25)::integer
    + least(v_result.correct_count + v_result.wrong_count, 10) * 2;
  total_score := auto_score + v_result.teacher_motion_design + v_result.teacher_data_diversity;
  return next;
end;
$$;

create or replace function motion_ai.get_leaderboard(p_class_code text)
returns table(
  rank bigint,
  team_name text,
  scenario_id text,
  final_accuracy integer,
  improvement integer,
  test_count integer,
  auto_score integer,
  teacher_score integer,
  total_score integer,
  submitted_at timestamptz
)
language sql
security definer
set search_path = motion_ai, public, pg_temp
as $$
  with target_session as (
    select id from motion_ai.class_sessions
    where code_hash = encode(extensions.digest(upper(regexp_replace(trim(p_class_code), '[^A-Z0-9]', '', 'g')), 'sha256'), 'hex')
      and status in ('active', 'closed')
    limit 1
  ), scored as (
    select
      t.name as team_name,
      t.scenario_id,
      r.final_accuracy::integer,
      greatest(r.final_accuracy - r.initial_accuracy, 0)::integer as improvement,
      (r.correct_count + r.wrong_count)::integer as test_count,
      (
        round(r.final_accuracy * 0.30)::integer
        + round(greatest(r.final_accuracy - r.initial_accuracy, 0) * 0.25)::integer
        + least(r.correct_count + r.wrong_count, 10) * 2
      ) as auto_score,
      (r.teacher_motion_design + r.teacher_data_diversity)::integer as teacher_score,
      r.submitted_at
    from motion_ai.teams t
    join target_session s on s.id = t.session_id
    join motion_ai.project_results r on r.team_id = t.id
  )
  select
    dense_rank() over (order by (auto_score + teacher_score) desc, final_accuracy desc, submitted_at asc) as rank,
    team_name,
    scenario_id,
    final_accuracy,
    improvement,
    test_count,
    auto_score,
    teacher_score,
    auto_score + teacher_score as total_score,
    submitted_at
  from scored
  order by rank, team_name;
$$;

revoke all on function motion_ai.create_class_session(text, text, timestamptz) from public;
grant execute on function motion_ai.create_class_session(text, text, timestamptz) to service_role;

revoke all on function motion_ai.register_team(text, text, text) from public;
revoke all on function motion_ai.submit_project_result(uuid, text, integer, integer, integer, integer, integer, integer, text) from public;
revoke all on function motion_ai.get_leaderboard(text) from public;
grant execute on function motion_ai.register_team(text, text, text) to anon, authenticated;
grant execute on function motion_ai.submit_project_result(uuid, text, integer, integer, integer, integer, integer, integer, text) to anon, authenticated;
grant execute on function motion_ai.get_leaderboard(text) to anon, authenticated;

comment on schema motion_ai is '모션AI 진로체험 수업 데이터';
comment on table motion_ai.project_results is '영상과 관절 좌표를 제외한 모둠별 집계 결과만 저장';
