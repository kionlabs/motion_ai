import { SUPABASE_CONFIG } from "./supabase-config.js";

async function callRpc(functionName, parameters) {
  const response = await fetch(`${SUPABASE_CONFIG.url}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_CONFIG.publishableKey,
      "Content-Type": "application/json",
      "Accept-Profile": SUPABASE_CONFIG.schema,
      "Content-Profile": SUPABASE_CONFIG.schema
    },
    body: JSON.stringify(parameters)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || "수업 서버에 연결하지 못했습니다.");
  return payload;
}

export function registerTeam(classCode, teamName, scenarioId) {
  return callRpc("register_team", {
    p_class_code: classCode,
    p_team_name: teamName,
    p_scenario_id: scenarioId
  });
}

export function submitChallengeResult(teamId, teamToken, result) {
  return callRpc("submit_challenge_result", {
    p_team_id: teamId,
    p_team_token: teamToken,
    p_initial_accuracy: result.initialAccuracy,
    p_final_accuracy: result.finalAccuracy,
    p_correct_count: result.correctCount,
    p_wrong_count: result.wrongCount,
    p_improvement_count: result.improvementCount,
    p_participant_count: result.participantCount,
    p_challenge_rounds: result.challengeRounds,
    p_average_response_ms: result.averageResponseMs,
    p_best_streak: result.bestStreak,
    p_reflection: result.reflection
  });
}

export function getLeaderboard(classCode) {
  return callRpc("get_leaderboard", { p_class_code: classCode });
}
