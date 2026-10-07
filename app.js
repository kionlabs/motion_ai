import { DrawingUtils, FilesetResolver, PoseLandmarker } from "./vendor/vision_bundle.mjs";

const CLASS_CONFIG = { left: { label: "왼쪽" }, right: { label: "오른쪽" }, stop: { label: "정지" } };
const TARGET_SAMPLES = 40;
const K_NEIGHBORS = 7;
const elements = {
  camera: document.querySelector("#camera"), canvas: document.querySelector("#pose-canvas"), cameraFrame: document.querySelector("#camera-frame"), cameraButton: document.querySelector("#camera-button"), cameraMessage: document.querySelector("#camera-message"), cameraHelp: document.querySelector("#camera-help"), status: document.querySelector("#app-status"), statusText: document.querySelector("#status-text"), countdown: document.querySelector("#countdown"), predictionChip: document.querySelector("#prediction-chip"), predictionName: document.querySelector("#prediction-name"), setupPanel: document.querySelector("#setup-panel"), trainingPanel: document.querySelector("#training-panel"), resultPanel: document.querySelector("#result-panel"), missionPanel: document.querySelector("#mission-panel"), trainButton: document.querySelector("#train-button"), resetButton: document.querySelector("#reset-button"), improveButton: document.querySelector("#improve-button"), missionButton: document.querySelector("#mission-button"), missionImproveButton: document.querySelector("#mission-improve-button"), retryButton: document.querySelector("#retry-button"), gameStartButton: document.querySelector("#game-start-button"), feedback: document.querySelector("#training-feedback"), resultName: document.querySelector("#result-name"), missionTime: document.querySelector("#mission-time"), missionScore: document.querySelector("#mission-score"), gameArena: document.querySelector("#game-arena"), gameOverlay: document.querySelector("#game-overlay"), gameCommand: document.querySelector("#game-command"), gameResult: document.querySelector("#game-result"), gameResultTitle: document.querySelector("#game-result-title"), gameResultText: document.querySelector("#game-result-text"), rover: document.querySelector("#rover"), energyCore: document.querySelector("#energy-core"),
  checks: { browser: document.querySelector("#check-browser"), model: document.querySelector("#check-model"), camera: document.querySelector("#check-camera"), pose: document.querySelector("#check-pose") }
};
Object.assign(elements, {
  groupButton: document.querySelector("#group-button"), groupButtonLabel: document.querySelector("#group-button-label"), groupDialog: document.querySelector("#group-dialog"), groupForm: document.querySelector("#group-form"), groupCloseButton: document.querySelector("#group-close-button"), groupNameInput: document.querySelector("#group-name-input"), groupSizeInput: document.querySelector("#group-size-input"),
  evaluationPhase: document.querySelector("#evaluation-phase"), evaluationAccuracy: document.querySelector("#evaluation-accuracy"), evaluationCount: document.querySelector("#evaluation-count"), correctButton: document.querySelector("#correct-button"), wrongButton: document.querySelector("#wrong-button"), evaluationResetButton: document.querySelector("#evaluation-reset-button"), resultCardButton: document.querySelector("#result-card-button"), missionResultCardButton: document.querySelector("#mission-result-card-button"),
  resultDialog: document.querySelector("#result-dialog"), resultCloseButton: document.querySelector("#result-close-button"), printButton: document.querySelector("#print-button"), cardDate: document.querySelector("#card-date"), cardGroupName: document.querySelector("#card-group-name"), cardGroupSize: document.querySelector("#card-group-size"), cardBeforeAccuracy: document.querySelector("#card-before-accuracy"), cardBeforeDetail: document.querySelector("#card-before-detail"), cardAfterAccuracy: document.querySelector("#card-after-accuracy"), cardAfterDetail: document.querySelector("#card-after-detail"), cardImprovement: document.querySelector("#card-improvement"), cardSamples: document.querySelector("#card-samples"), cardBestScore: document.querySelector("#card-best-score"), cardTests: document.querySelector("#card-tests"), cardConclusion: document.querySelector("#card-conclusion")
});
elements.offlineBadge = document.querySelector("#offline-badge"); elements.offlineBadgeText = elements.offlineBadge.querySelector("span"); elements.newActivityButton = document.querySelector("#new-activity-button");
const STORAGE_KEY = "motion-ai-samples-v1";
const ACTIVITY_KEY = "motion-ai-activity-v2";
const storedSamples = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
const samples = {
  left: Array.isArray(storedSamples.left) ? storedSamples.left : [],
  right: Array.isArray(storedSamples.right) ? storedSamples.right : [],
  stop: Array.isArray(storedSamples.stop) ? storedSamples.stop : []
};
const storedActivity = JSON.parse(sessionStorage.getItem(ACTIVITY_KEY) || "{}");
const activity = {
  groupName: typeof storedActivity.groupName === "string" ? storedActivity.groupName : "",
  groupSize: Number.isInteger(storedActivity.groupSize) ? storedActivity.groupSize : 3,
  phase: storedActivity.phase === "after" ? "after" : "before",
  evaluation: {
    before: { correct: Number(storedActivity.evaluation?.before?.correct) || 0, wrong: Number(storedActivity.evaluation?.before?.wrong) || 0 },
    after: { correct: Number(storedActivity.evaluation?.after?.correct) || 0, wrong: Number(storedActivity.evaluation?.after?.wrong) || 0 }
  },
  bestScore: Number(storedActivity.bestScore) || 0
};
let poseLandmarker;
let drawingUtils;
let cameraStream;
let lastVideoTime = -1;
let lastFeatures;
let modelTrained = false;
let isCollecting = false;
let lastPrediction;
const mission = { running: false, score: 0, roverX: 50, coreX: 50, coreY: -8, startedAt: 0, lastFrameAt: 0, frameId: 0 };

function setCheck(element, label, passed) { element.textContent = label; element.className = passed ? "pass" : "fail"; }
function setStatus(text, state = "") { elements.status.className = `status ${state}`.trim(); elements.statusText.textContent = text; }
function setStep(step) { document.querySelectorAll(".step").forEach((item) => { const current = Number(item.dataset.step); item.classList.toggle("active", current === step); item.classList.toggle("done", current < step); }); }
function showPanel(name) { elements.setupPanel.hidden = name !== "setup"; elements.trainingPanel.hidden = name !== "training"; elements.resultPanel.hidden = name !== "result"; elements.missionPanel.hidden = name !== "mission"; }
function delay(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
function saveSamples() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(samples)); }
function saveActivity() { sessionStorage.setItem(ACTIVITY_KEY, JSON.stringify(activity)); }
function getEvaluationStats(phase) {
  const record = activity.evaluation[phase]; const total = record.correct + record.wrong;
  return { ...record, total, accuracy: total ? Math.round((record.correct / total) * 100) : null };
}
function updateGroupUI() { elements.groupButtonLabel.textContent = activity.groupName || "모둠 설정"; }
function updateEvaluationUI() {
  const stats = getEvaluationStats(activity.phase); const before = getEvaluationStats("before"); const after = getEvaluationStats("after");
  elements.evaluationPhase.textContent = activity.phase === "before" ? "개선 전 테스트" : "개선 후 테스트";
  elements.evaluationAccuracy.textContent = stats.accuracy === null ? "기록 없음" : `정확도 ${stats.accuracy}%`;
  elements.evaluationCount.textContent = `${stats.total}회`;
  elements.improveButton.disabled = activity.phase === "before" && before.total === 0;
  elements.resultCardButton.classList.toggle("ready", before.total > 0 && after.total > 0);
  elements.missionResultCardButton.classList.toggle("ready", before.total > 0 && after.total > 0);
}
function updateResultCard() {
  const before = getEvaluationStats("before"), after = getEvaluationStats("after");
  const improvement = before.accuracy !== null && after.accuracy !== null ? after.accuracy - before.accuracy : null;
  elements.cardDate.textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  elements.cardGroupName.textContent = activity.groupName || "모둠 이름 미설정"; elements.cardGroupSize.textContent = `참여 인원 ${activity.groupSize}명`;
  elements.cardBeforeAccuracy.textContent = before.accuracy === null ? "기록 없음" : `${before.accuracy}%`; elements.cardBeforeDetail.textContent = `정답 ${before.correct} / ${before.total}회`;
  elements.cardAfterAccuracy.textContent = after.accuracy === null ? "기록 없음" : `${after.accuracy}%`; elements.cardAfterDetail.textContent = `정답 ${after.correct} / ${after.total}회`;
  elements.cardImprovement.textContent = improvement === null ? "—" : `${improvement >= 0 ? "+" : ""}${improvement}%p`;
  elements.cardSamples.textContent = `${Object.values(samples).reduce((sum, list) => sum + list.length, 0)}개`; elements.cardBestScore.textContent = `${activity.bestScore}개`; elements.cardTests.textContent = `${before.total + after.total}회`;
  if (improvement === null) elements.cardConclusion.textContent = "개선 전·후 테스트를 모두 기록하면 AI 모델의 변화를 비교할 수 있습니다.";
  else if (improvement > 0) elements.cardConclusion.textContent = `데이터를 다시 설계한 뒤 정확도가 ${improvement}%p 향상되었습니다.`;
  else if (improvement === 0) elements.cardConclusion.textContent = "정확도는 같았습니다. 사람·거리·팔 각도를 더 다양하게 바꿔 실험해보세요.";
  else elements.cardConclusion.textContent = `개선 후 정확도가 ${Math.abs(improvement)}%p 낮아졌습니다. 추가한 데이터의 균형을 점검해보세요.`;
}
function openResultCard() { updateResultCard(); elements.resultDialog.showModal(); }
function recordEvaluation(correct) { activity.evaluation[activity.phase][correct ? "correct" : "wrong"] += 1; saveActivity(); updateEvaluationUI(); }
function resetCurrentEvaluation() { activity.evaluation[activity.phase] = { correct: 0, wrong: 0 }; saveActivity(); updateEvaluationUI(); }
function setOfflineBadge(label, state) { elements.offlineBadgeText.textContent = label; elements.offlineBadge.dataset.state = state; }
async function setupOfflineMode() {
  if (!("serviceWorker" in navigator)) { setOfflineBadge("오프라인 미지원", "error"); return; }
  try {
    await navigator.serviceWorker.register("./service-worker.js");
    await navigator.serviceWorker.ready;
    setOfflineBadge(navigator.onLine ? "오프라인 준비 완료" : "오프라인 실행 중", navigator.onLine ? "ready" : "offline");
  } catch (error) { console.error(error); setOfflineBadge("오프라인 준비 실패", "error"); }
}
function updateConnectionStatus() { setOfflineBadge(navigator.onLine ? "오프라인 준비 완료" : "오프라인 실행 중", navigator.onLine ? "ready" : "offline"); }
function resetEntireActivity() {
  if (!window.confirm("현재 기기의 자세 데이터, 모둠 정보, 테스트 결과와 미션 점수를 모두 지울까요?")) return;
  stopCamera(); sessionStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem(ACTIVITY_KEY); window.location.reload();
}

async function initializePoseModel() {
  const supportsCamera = Boolean(navigator.mediaDevices?.getUserMedia);
  setCheck(elements.checks.browser, supportsCamera ? "사용 가능" : "지원하지 않음", supportsCamera);
  if (!supportsCamera) { setStatus("지원하지 않는 브라우저", "error"); elements.cameraMessage.textContent = "카메라를 지원하는 최신 브라우저가 필요합니다"; return; }
  try {
    const vision = await FilesetResolver.forVisionTasks("./vendor/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: "./models/pose_landmarker_lite.task", delegate: "CPU" }, runningMode: "VIDEO", numPoses: 1, minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55 });
    drawingUtils = new DrawingUtils(elements.canvas.getContext("2d"));
    setCheck(elements.checks.model, "준비 완료", true); setStatus("카메라 연결 대기"); elements.cameraMessage.textContent = "카메라를 켜고 전신을 보여주세요"; elements.cameraButton.disabled = false; elements.cameraHelp.textContent = "촬영 영상은 저장되지 않습니다.";
  } catch (error) {
    console.error(error); setCheck(elements.checks.model, "불러오기 실패", false); setStatus("AI 모델 확인 필요", "error"); elements.cameraMessage.textContent = "AI 모델을 불러오지 못했습니다"; elements.cameraHelp.textContent = "페이지를 새로고침하거나 프로젝트 파일을 확인해 주세요.";
  }
}

async function startCamera() {
  elements.cameraButton.disabled = true; elements.cameraButton.textContent = "카메라 연결 중…";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } } });
    elements.camera.srcObject = cameraStream; await elements.camera.play(); elements.canvas.width = elements.camera.videoWidth; elements.canvas.height = elements.camera.videoHeight; elements.cameraFrame.classList.add("live"); setCheck(elements.checks.camera, "사용 가능", true); setStatus("몸 전체를 화면에 보여주세요"); elements.cameraButton.textContent = "카메라 끄기"; requestAnimationFrame(predictFrame);
  } catch (error) {
    console.error(error);
    const cameraBusy = error.name === "NotReadableError";
    setCheck(elements.checks.camera, cameraBusy ? "다른 앱에서 사용 중" : "권한 확인 필요", false);
    setStatus(cameraBusy ? "카메라를 사용하는 다른 앱을 닫아주세요" : "카메라 연결 실패", "error");
    elements.cameraHelp.textContent = cameraBusy ? "화상회의나 다른 브라우저 탭을 닫은 뒤 다시 시도하세요." : "주소창의 카메라 권한을 확인해 주세요.";
    elements.cameraButton.textContent = "다시 시도하기";
  }
  finally { elements.cameraButton.disabled = false; }
}
function stopCamera() { stopMission(); cameraStream?.getTracks().forEach((track) => track.stop()); cameraStream = undefined; elements.camera.srcObject = null; elements.cameraFrame.classList.remove("live"); elements.predictionChip.hidden = true; lastFeatures = undefined; lastPrediction = undefined; elements.cameraButton.textContent = "카메라 다시 켜기"; setStatus("카메라가 꺼졌습니다"); }
async function toggleCamera() { if (cameraStream) stopCamera(); else await startCamera(); }

function normalizeLandmarks(landmarks) {
  const leftHip = landmarks[23], rightHip = landmarks[24], leftShoulder = landmarks[11], rightShoulder = landmarks[12];
  const centerX = (leftHip.x + rightHip.x) / 2, centerY = (leftHip.y + rightHip.y) / 2;
  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  const torsoHeight = Math.hypot((leftShoulder.x + rightShoulder.x) / 2 - centerX, (leftShoulder.y + rightShoulder.y) / 2 - centerY);
  const scale = Math.max(shoulderWidth, torsoHeight, .08);
  return landmarks.flatMap((landmark) => [(landmark.x - centerX) / scale, (landmark.y - centerY) / scale, landmark.z / scale]);
}

function drawPose(landmarks) {
  const context = elements.canvas.getContext("2d"); context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#5eead4", lineWidth: 4 });
  drawingUtils.drawLandmarks(landmarks, { color: "#f8fafc", fillColor: "#07152f", lineWidth: 2, radius: 4 });
}
function squaredDistance(first, second) { let sum = 0; for (let index = 0; index < first.length; index += 1) { const difference = first[index] - second[index]; sum += difference * difference; } return sum; }
function classify(features) {
  const neighbors = Object.entries(samples).flatMap(([classId, classSamples]) => classSamples.map((sample) => ({ classId, distance: squaredDistance(features, sample) }))).sort((a, b) => a.distance - b.distance).slice(0, K_NEIGHBORS);
  const votes = { left: 0, right: 0, stop: 0 }; neighbors.forEach(({ classId }) => { votes[classId] += 1; });
  const probabilities = Object.fromEntries(Object.entries(votes).map(([classId, count]) => [classId, count / neighbors.length]));
  const winner = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0]; return { classId: winner[0], confidence: winner[1], probabilities };
}
function updatePrediction(prediction) {
  const label = prediction.confidence >= .57 ? CLASS_CONFIG[prediction.classId].label : "잘 모르겠어요";
  lastPrediction = prediction.confidence >= .57 ? prediction : undefined;
  elements.predictionName.textContent = label; elements.resultName.textContent = label; elements.predictionChip.hidden = false;
  Object.entries(prediction.probabilities).forEach(([classId, probability]) => { const percentage = Math.round(probability * 100); document.querySelector(`#prob-${classId}`).value = percentage; document.querySelector(`#prob-${classId}-value`).textContent = `${percentage}%`; });
}

function predictFrame() {
  if (!cameraStream || !poseLandmarker) return;
  if (elements.camera.currentTime !== lastVideoTime) {
    lastVideoTime = elements.camera.currentTime;
    const result = poseLandmarker.detectForVideo(elements.camera, performance.now());
    if (result.landmarks.length > 0) {
      const landmarks = result.landmarks[0]; drawPose(landmarks); lastFeatures = normalizeLandmarks(landmarks); setCheck(elements.checks.pose, "인식 중", true);
      if (!elements.setupPanel.hidden) { showPanel("training"); setStep(2); setStatus("자세 데이터를 모아보세요", "ready"); }
      if (modelTrained && !isCollecting) updatePrediction(classify(lastFeatures));
    } else { lastFeatures = undefined; setCheck(elements.checks.pose, "몸을 보여주세요", false); elements.canvas.getContext("2d").clearRect(0, 0, elements.canvas.width, elements.canvas.height); }
  }
  requestAnimationFrame(predictFrame);
}

function updateCounts() {
  Object.keys(samples).forEach((classId) => { document.querySelector(`#count-${classId}`).textContent = samples[classId].length; });
  const ready = Object.values(samples).every((classSamples) => classSamples.length >= TARGET_SAMPLES); elements.trainButton.disabled = !ready; elements.feedback.textContent = ready ? "좋습니다. 이제 세 자세를 학습시킬 수 있습니다." : "세 자세를 각각 40개씩 모아주세요.";
}
function setCollectButtonsDisabled(disabled) { document.querySelectorAll("[data-collect]").forEach((button) => { button.disabled = disabled; }); elements.trainButton.disabled = disabled || !Object.values(samples).every((value) => value.length >= TARGET_SAMPLES); elements.resetButton.disabled = disabled; }
async function collectSamples(classId) {
  if (isCollecting || !cameraStream) return; isCollecting = true; setCollectButtonsDisabled(true); document.querySelector(`[data-class="${classId}"]`).classList.add("collecting"); elements.feedback.textContent = `${CLASS_CONFIG[classId].label} 자세를 준비하세요.`;
  elements.countdown.hidden = false; for (let count = 3; count >= 1; count -= 1) { elements.countdown.textContent = count; await delay(700); } elements.countdown.textContent = "GO"; await delay(400); elements.countdown.hidden = true;
  samples[classId] = [];
  while (samples[classId].length < TARGET_SAMPLES && cameraStream) { if (lastFeatures) { samples[classId].push([...lastFeatures]); updateCounts(); elements.feedback.textContent = `${CLASS_CONFIG[classId].label} 데이터 수집 중 · ${samples[classId].length}/${TARGET_SAMPLES}`; } await delay(90); }
  document.querySelector(`[data-class="${classId}"]`).classList.remove("collecting"); isCollecting = false; saveSamples(); setCollectButtonsDisabled(false); updateCounts();
}
async function trainClassifier() {
  if (!Object.values(samples).every((classSamples) => classSamples.length >= TARGET_SAMPLES)) return;
  setStep(3); setStatus("120개의 자세 데이터를 학습하고 있습니다"); elements.trainButton.disabled = true;
  await delay(700);
  modelTrained = true; setStep(4); showPanel("result"); setStatus("AI가 실시간으로 자세를 판단합니다", "ready"); elements.predictionChip.hidden = false;
  if (lastFeatures) updatePrediction(classify(lastFeatures));
}
function resetSamples() { stopMission(); Object.keys(samples).forEach((classId) => { samples[classId] = []; }); saveSamples(); modelTrained = false; elements.predictionChip.hidden = true; setStep(2); updateCounts(); }
function improveModel() {
  const before = getEvaluationStats("before");
  if (activity.phase === "before" && before.total === 0) { showPanel("result"); setStep(4); setStatus("개선 전 테스트 결과를 먼저 기록하세요", "error"); return; }
  stopMission(); activity.phase = "after"; saveActivity(); updateEvaluationUI(); modelTrained = false; elements.predictionChip.hidden = true; showPanel("training"); setStep(2); elements.feedback.textContent = "틀렸던 조건을 반영해 세 자세의 데이터를 다시 수집해보세요.";
}

function resetCore() {
  mission.coreX = 8 + Math.random() * 84; mission.coreY = -8;
  elements.energyCore.style.left = `${mission.coreX}%`; elements.energyCore.style.top = `${mission.coreY}%`;
}

function updateGameCommand() {
  const command = lastPrediction?.classId;
  const labels = { left: "왼쪽 이동", right: "오른쪽 이동", stop: "정지" };
  elements.gameCommand.textContent = `현재 명령 · ${labels[command] || "자세를 보여주세요"}`;
  elements.gameCommand.dataset.command = command || "unknown";
}

function gameFrame(timestamp) {
  if (!mission.running) return;
  const delta = Math.min((timestamp - mission.lastFrameAt) / 1000, .1); mission.lastFrameAt = timestamp;
  const command = lastPrediction?.classId;
  if (command === "left") mission.roverX -= 34 * delta;
  if (command === "right") mission.roverX += 34 * delta;
  mission.roverX = Math.max(6, Math.min(94, mission.roverX)); mission.coreY += 31 * delta;
  if (mission.coreY >= 83 && Math.abs(mission.coreX - mission.roverX) <= 13) { mission.score += 1; elements.missionScore.textContent = mission.score; elements.gameArena.classList.add("hit"); window.setTimeout(() => elements.gameArena.classList.remove("hit"), 180); resetCore(); }
  if (mission.coreY > 104) resetCore();
  elements.rover.style.left = `${mission.roverX}%`; elements.energyCore.style.top = `${mission.coreY}%`; updateGameCommand();
  const remaining = Math.max(0, 30 - (timestamp - mission.startedAt) / 1000); elements.missionTime.textContent = Math.ceil(remaining);
  if (remaining <= 0) { finishMission(); return; }
  mission.frameId = requestAnimationFrame(gameFrame);
}

function startMission() {
  if (!cameraStream || !modelTrained) return;
  cancelAnimationFrame(mission.frameId); mission.running = true; mission.score = 0; mission.roverX = 50; mission.startedAt = performance.now(); mission.lastFrameAt = mission.startedAt;
  elements.missionScore.textContent = "0"; elements.missionTime.textContent = "30"; elements.rover.style.left = "50%"; elements.gameOverlay.hidden = true; elements.gameResult.hidden = true; elements.retryButton.disabled = true; resetCore(); setStatus("자세로 탐사선을 조종하세요", "ready");
  mission.frameId = requestAnimationFrame(gameFrame);
}

function finishMission() {
  if (!mission.running) return;
  mission.running = false; cancelAnimationFrame(mission.frameId); elements.retryButton.disabled = false; elements.gameResult.hidden = false;
  activity.bestScore = Math.max(activity.bestScore, mission.score); saveActivity();
  elements.gameResultTitle.textContent = mission.score >= 6 ? "훌륭한 모션 AI 조종사!" : mission.score >= 3 ? "미션 성공!" : "데이터를 개선해볼까요?";
  elements.gameResultText.textContent = `30초 동안 에너지 코어 ${mission.score}개를 수집했습니다.`; setStatus("AI 미션 완료", "ready");
}

function stopMission() { mission.running = false; cancelAnimationFrame(mission.frameId); }
function openMission() { stopMission(); showPanel("mission"); setStep(5); elements.gameOverlay.hidden = false; elements.gameResult.hidden = true; elements.retryButton.disabled = true; elements.missionTime.textContent = "30"; elements.missionScore.textContent = "0"; elements.gameCommand.textContent = "현재 명령 · 대기"; setStatus("AI 미션을 시작할 준비가 됐습니다", "ready"); }
function openGroupDialog() { elements.groupNameInput.value = activity.groupName; elements.groupSizeInput.value = activity.groupSize; elements.groupDialog.showModal(); elements.groupNameInput.focus(); }
function saveGroup(event) { event.preventDefault(); activity.groupName = elements.groupNameInput.value.trim(); activity.groupSize = Math.max(1, Math.min(8, Number(elements.groupSizeInput.value) || 3)); saveActivity(); updateGroupUI(); elements.groupDialog.close(); }

elements.cameraButton.addEventListener("click", toggleCamera); elements.trainButton.addEventListener("click", trainClassifier); elements.resetButton.addEventListener("click", resetSamples); elements.improveButton.addEventListener("click", improveModel); elements.missionButton.addEventListener("click", openMission); elements.missionImproveButton.addEventListener("click", improveModel); elements.gameStartButton.addEventListener("click", startMission); elements.retryButton.addEventListener("click", startMission);
elements.groupButton.addEventListener("click", openGroupDialog); elements.groupCloseButton.addEventListener("click", () => elements.groupDialog.close()); elements.groupForm.addEventListener("submit", saveGroup);
elements.newActivityButton.addEventListener("click", resetEntireActivity); window.addEventListener("online", updateConnectionStatus); window.addEventListener("offline", updateConnectionStatus);
elements.correctButton.addEventListener("click", () => recordEvaluation(true)); elements.wrongButton.addEventListener("click", () => recordEvaluation(false)); elements.evaluationResetButton.addEventListener("click", resetCurrentEvaluation);
elements.resultCardButton.addEventListener("click", openResultCard); elements.missionResultCardButton.addEventListener("click", openResultCard); elements.resultCloseButton.addEventListener("click", () => elements.resultDialog.close()); elements.printButton.addEventListener("click", () => window.print());
document.querySelectorAll("[data-collect]").forEach((button) => button.addEventListener("click", () => collectSamples(button.dataset.collect)));
window.addEventListener("beforeunload", stopCamera);
updateCounts();
updateGroupUI();
updateEvaluationUI();
setupOfflineMode();
initializePoseModel();
