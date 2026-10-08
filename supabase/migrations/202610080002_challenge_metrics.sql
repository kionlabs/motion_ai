alter table motion_ai.project_results
  add column if not exists challenge_rounds smallint not null default 0 check (challenge_rounds between 0 and 50),
  add column if not exists average_response_ms integer not null default 0 check (average_response_ms between 0 and 60000),
  add column if not exists best_streak smallint not null default 0 check (best_streak between 0 and 50),
  add column if not exists scoring_version smallint not null default 2;

drop function if exists motion_ai.submit_project_result(uuid, text, integer, integer, integer, integer, integer, integer, text);

create or replace function motion_ai.submit_challenge_result(
  p_team_id uuid,
  p_team_token text,
  p_initial_accuracy integer,
  p_final_accuracy integer,
  p_correct_count integer,
  p_wrong_count integer,
  p_improvement_count integer,
  p_participant_count integer,
  p_challenge_rounds integer,
  p_average_response_ms integer,
  p_best_streak integer,
  p_reflection text default ''
)
returns table(auto_score integer, total_score integer)
language plpgsql
security definer
set search_path = motion_ai, public, pg_temp
as $$
declare
  v_result motion_ai.project_results%rowtype;
  v_existing motion_ai.project_results%rowtype;
  v_calculated_accuracy integer;
begin
  if not exists (
    select 1 from motion_ai.teams
    where id = p_team_id
      and access_token_hash = encode(extensions.digest(p_team_token, 'sha256'), 'hex')
  ) then
    raise exception '모둠 제출 권한을 확인할 수 없습니다.';
  end if;

  if p_challenge_rounds <> 10
    or p_correct_count not between 0 and 10
    or p_wrong_count not between 0 and 10
    or p_correct_count + p_wrong_count <> 10 then
    raise exception '10라운드 자동 미션을 완료한 결과만 제출할 수 있습니다.';
  end if;

  v_calculated_accuracy := round((p_correct_count::numeric / p_challenge_rounds) * 100)::integer;
  if p_final_accuracy <> v_calculated_accuracy
    or p_best_streak > p_correct_count
    or p_average_response_ms < 700
    or p_average_response_ms > 5000 then
    raise exception '자동 미션 결과의 계산값이 올바르지 않습니다.';
  end if;

  select * into v_existing from motion_ai.project_results where team_id = p_team_id;

  insert into motion_ai.project_results (
    team_id, initial_accuracy, final_accuracy, correct_count, wrong_count,
    improvement_count, participant_count, challenge_rounds, average_response_ms,
    best_streak, scoring_version, reflection, submitted_at, updated_at
  ) values (
    p_team_id,
    coalesce(v_existing.initial_accuracy, v_calculated_accuracy),
    v_calculated_accuracy,
    greatest(0, least(1000, p_correct_count)),
    greatest(0, least(1000, p_wrong_count)),
    case when v_existing.id is null then 0 else least(v_existing.improvement_count + 1, 50) end,
    greatest(1, least(20, p_participant_count)),
    10,
    greatest(0, least(60000, p_average_response_ms)),
    greatest(0, least(50, p_best_streak)),
    2,
    left(coalesce(p_reflection, ''), 500),
    now(), now()
  )
  on conflict (team_id) do update set
    initial_accuracy = v_existing.initial_accuracy,
    final_accuracy = excluded.final_accuracy,
    correct_count = excluded.correct_count,
    wrong_count = excluded.wrong_count,
    improvement_count = least(v_existing.improvement_count + 1, 50),
    participant_count = excluded.participant_count,
    challenge_rounds = excluded.challenge_rounds,
    average_response_ms = excluded.average_response_ms,
    best_streak = excluded.best_streak,
    scoring_version = 2,
    reflection = excluded.reflection,
    updated_at = now()
  returning * into v_result;

  auto_score :=
    round(v_result.final_accuracy * 0.30)::integer
    + round(greatest(v_result.final_accuracy - v_result.initial_accuracy, 0) * 0.25)::integer
    + round(least(v_result.challenge_rounds, 10) * 1.0)::integer
    + round(least(v_result.best_streak, 10) * 1.0)::integer;
  total_score := auto_score + v_result.teacher_motion_design + v_result.teacher_data_diversity;
  return next;
end;
$$;

revoke all on function motion_ai.submit_challenge_result(uuid, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, text) from public;
grant execute on function motion_ai.submit_challenge_result(uuid, text, integer, integer, integer, integer, integer, integer, integer, integer, integer, text) to anon, authenticated;

drop function if exists motion_ai.get_leaderboard(text);

create function motion_ai.get_leaderboard(p_class_code text)
returns table(
  rank bigint,
  team_name text,
  scenario_id text,
  final_accuracy integer,
  improvement integer,
  challenge_rounds integer,
  average_response_ms integer,
  best_streak integer,
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
      r.challenge_rounds::integer,
      r.average_response_ms,
      r.best_streak::integer,
      (
        round(r.final_accuracy * 0.30)::integer
        + round(greatest(r.final_accuracy - r.initial_accuracy, 0) * 0.25)::integer
        + round(least(r.challenge_rounds, 10) * 1.0)::integer
        + round(least(r.best_streak, 10) * 1.0)::integer
      ) as auto_score,
      (r.teacher_motion_design + r.teacher_data_diversity)::integer as teacher_score,
      r.submitted_at
    from motion_ai.teams t
    join target_session s on s.id = t.session_id
    join motion_ai.project_results r on r.team_id = t.id
  )
  select
    dense_rank() over (order by (auto_score + teacher_score) desc, final_accuracy desc, average_response_ms asc, submitted_at asc) as rank,
    team_name,
    scenario_id,
    final_accuracy,
    improvement,
    challenge_rounds,
    average_response_ms,
    best_streak,
    auto_score,
    teacher_score,
    auto_score + teacher_score as total_score,
    submitted_at
  from scored
  order by rank, team_name;
$$;

revoke all on function motion_ai.get_leaderboard(text) from public;
grant execute on function motion_ai.get_leaderboard(text) to anon, authenticated;

comment on function motion_ai.submit_challenge_result is '버튼 자기평가 대신 자동 10라운드 미션 결과를 검증·저장';
