drop function if exists motion_ai.get_leaderboard(text);

create function motion_ai.get_leaderboard(p_class_code text)
returns table(
  rank bigint,
  team_name text,
  scenario_id text,
  submission_status text,
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
      case when r.id is null then 'in_progress' else 'submitted' end as submission_status,
      coalesce(r.final_accuracy, 0)::integer as final_accuracy,
      coalesce(greatest(r.final_accuracy - r.initial_accuracy, 0), 0)::integer as improvement,
      coalesce(r.challenge_rounds, 0)::integer as challenge_rounds,
      coalesce(r.average_response_ms, 0)::integer as average_response_ms,
      coalesce(r.best_streak, 0)::integer as best_streak,
      case when r.id is null then 0 else (
        round(r.final_accuracy * 0.30)::integer
        + round(greatest(r.final_accuracy - r.initial_accuracy, 0) * 0.25)::integer
        + round(least(r.challenge_rounds, 10) * 1.0)::integer
        + round(least(r.best_streak, 10) * 1.0)::integer
      ) end as auto_score,
      coalesce(r.teacher_motion_design + r.teacher_data_diversity, 0)::integer as teacher_score,
      r.submitted_at
    from motion_ai.teams t
    join target_session s on s.id = t.session_id
    left join motion_ai.project_results r on r.team_id = t.id
  ), ranked as (
    select
      case when submission_status = 'submitted' then
        dense_rank() over (
          order by (auto_score + teacher_score) desc, final_accuracy desc,
            nullif(average_response_ms, 0) asc nulls last, submitted_at asc nulls last
        )
      end as rank,
      *
    from scored
  )
  select
    rank,
    team_name,
    scenario_id,
    submission_status,
    final_accuracy,
    improvement,
    challenge_rounds,
    average_response_ms,
    best_streak,
    auto_score,
    teacher_score,
    auto_score + teacher_score as total_score,
    submitted_at
  from ranked
  order by (submission_status = 'submitted') desc, rank nulls last, team_name;
$$;

revoke all on function motion_ai.get_leaderboard(text) from public;
grant execute on function motion_ai.get_leaderboard(text) to anon, authenticated;

comment on function motion_ai.get_leaderboard is '참가 모둠 전체를 반환하며 미제출 모둠은 in_progress 상태로 표시';
