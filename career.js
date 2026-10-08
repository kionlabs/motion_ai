import { DrawingUtils, FilesetResolver, PoseLandmarker } from "./vendor/vision_bundle.mjs";
import { getLeaderboard, registerTeam, submitProjectResult } from "./supabase-client.js";

const TARGET_SAMPLES = 25;
const K_NEIGHBORS = 7;
const STORAGE_KEY = "motion-ai-career-project-v1";
const MEMBERSHIP_KEY = "motion-ai-class-membership-v1";
const CLASS_IDS = ["a", "b", "c"];

const SCENARIOS = {
  game: {
    icon: "🎮",
    company: "게임 회사",
    title: "몸으로 조종하는 게임",
    problem: "손에 컨트롤러를 들지 않아도 온몸으로 캐릭터를 움직이는 게임이 필요합니다.",
    user: "친구들과 몸을 움직이며 게임하고 싶은 청소년",
    goal: "세 동작을 빠르고 분명하게 구분하는 조종 도구",
    commands: [
      { id: "a", key: "A", action: "왼쪽 이동", gesture: "왼팔을 옆으로 뻗기", output: "캐릭터가 왼쪽으로 이동했습니다." },
      { id: "b", key: "B", action: "오른쪽 이동", gesture: "오른팔을 옆으로 뻗기", output: "캐릭터가 오른쪽으로 이동했습니다." },
      { id: "c", key: "C", action: "멈춤", gesture: "두 팔을 자연스럽게 내리기", output: "캐릭터가 멈췄습니다." }
    ]
  },
  hospital: {
    icon: "🏥",
    company: "병원",
    title: "재활 자세 확인 도구",
    problem: "환자가 혼자 연습할 때 재활 자세를 제대로 했는지 바로 확인하기 어렵습니다.",
    user: "의료진의 안내에 따라 반복 운동을 연습하는 환자",
    goal: "진단이 아닌 연습 보조용 자세 확인 프로토타입",
    commands: [
      { id: "a", key: "A", action: "왼쪽 재활 자세", gesture: "왼팔을 어깨 높이로 들기", output: "왼쪽 자세를 인식했습니다." },
      { id: "b", key: "B", action: "오른쪽 재활 자세", gesture: "오른팔을 어깨 높이로 들기", output: "오른쪽 자세를 인식했습니다." },
      { id: "c", key: "C", action: "준비 자세", gesture: "두 팔을 편안하게 내리기", output: "준비 자세를 인식했습니다." }
    ]
  },
  home: {
    icon: "🍳",
    company: "스마트홈 회사",
    title: "손대지 않는 화면 리모컨",
    problem: "요리 중 손에 물이나 음식이 묻으면 화면을 직접 만지기 어렵습니다.",
    user: "레시피를 보면서 두 손으로 요리하는 사람",
    goal: "화면을 만지지 않고 세 가지 명령을 보내는 리모컨",
    commands: [
      { id: "a", key: "A", action: "이전 단계", gesture: "몸을 왼쪽으로 기울이기", output: "이전 조리 단계로 이동했습니다." },
      { id: "b", key: "B", action: "다음 단계", gesture: "몸을 오른쪽으로 기울이기", output: "다음 조리 단계로 이동했습니다." },
      { id: "c", key: "C", action: "타이머 시작", gesture: "두 팔을 아래로 모으기", output: "조리 타이머를 시작했습니다." }
    ]
  },
  stage: {
    icon: "🎭",
    company: "공연 기획사",
    title: "춤에 반응하는 무대 조명",
    problem: "댄서의 자세와 동시에 조명이 바뀌면 공연의 몰입감을 높일 수 있습니다.",
    user: "음악과 움직임에 맞춰 공연하는 댄서와 무대 감독",
    goal: "자세를 조명 신호로 바꾸는 실시간 무대 장치",
    commands: [
      { id: "a", key: "A", action: "청록 조명", gesture: "왼팔을 대각선 위로 들기", output: "청록색 조명을 켰습니다." },
      { id: "b", key: "B", action: "보라 조명", gesture: "오른팔을 대각선 위로 들기", output: "보라색 조명을 켰습니다." },
      { id: "c", key: "C", action: "암전", gesture: "두 팔을 몸 앞에 모으기", output: "무대 조명을 어둡게 했습니다." }
    ]
  },
  accessibility: {
    icon: "🧭",
    company: "접근성 연구소",
    title: "동작으로 선택하는 인터페이스",
    problem: "키보드 사용이 어려운 사람에게는 화면의 항목을 이동하고 선택하는 다른 방법이 필요합니다.",
    user: "자신에게 편한 큰 동작으로 컴퓨터를 사용하려는 사람",
    goal: "사용자가 직접 선택한 동작으로 작동하는 화면 탐색 도구",
    commands: [
      { id: "a", key: "A", action: "이전 항목", gesture: "왼쪽으로 편한 동작 정하기", output: "이전 항목으로 이동했습니다." },
      { id: "b", key: "B", action: "다음 항목", gesture: "오른쪽으로 편한 동작 정하기", output: "다음 항목으로 이동했습니다." },
      { id: "c", key: "C", action: "선택", gesture: "가장 편한 확인 동작 정하기", output: "현재 항목을 선택했습니다." }
    ]
  },
  sports: {
    icon: "🏃",
    company: "스포츠 분석 회사",
    title: "운동 자세 코칭 도구",
    problem: "혼자 운동할 때 현재 자세가 어떤 단계인지 확인하기 어렵습니다.",
    user: "기본 운동 동작을 정확한 순서로 연습하려는 사람",
    goal: "준비와 운동, 휴식 자세를 구분하는 코칭 프로토타입",
    commands: [
      { id: "a", key: "A", action: "준비 자세", gesture: "두 손을 허리에 올리기", output: "준비 자세를 확인했습니다." },
      { id: "b", key: "B", action: "운동 자세", gesture: "두 팔을 앞으로 뻗기", output: "운동 자세를 확인했습니다." },
      { id: "c", key: "C", action: "휴식 자세", gesture: "두 팔을 편안하게 내리기", output: "휴식 자세를 확인했습니다." }
    ]
  }
};

const elements = {
  grid: document.querySelector("#career-grid"),
  project: document.querySelector("#career-project"),
  symbol: document.querySelector("#project-symbol"),
  company: document.querySelector("#project-company"),
  title: document.querySelector("#project-title"),
  problem: document.querySelector("#project-problem"),
  user: document.querySelector("#project-user"),
  goal: document.querySelector("#project-goal"),
  changeCareerButton: document.querySelector("#change-career-button"),
  teamName: document.querySelector("#career-team-name"),
  classList: document.querySelector("#career-class-list"),
  feedback: document.querySelector("#career-training-feedback"),
  camera: document.querySelector("#career-camera"),
  canvas: document.querySelector("#career-pose-canvas"),
  cameraFrame: document.querySelector("#career-camera-frame"),
  cameraButton: document.querySelector("#career-camera-button"),
  cameraMessage: document.querySelector("#career-camera-message"),
  cameraHelp: document.querySelector("#career-camera-help"),
  countdown: document.querySelector("#career-countdown"),
  predictionChip: document.querySelector("#career-prediction-chip"),
  predictionName: document.querySelector("#career-prediction-name"),
  designPanel: document.querySelector("#career-design-panel"),
  testPanel: document.querySelector("#career-test-panel"),
  trainButton: document.querySelector("#career-train-button"),
  resetButton: document.querySelector("#career-reset-button"),
  probabilities: document.querySelector("#career-probabilities"),
  preview: document.querySelector("#product-preview"),
  previewIcon: document.querySelector("#preview-icon"),
  previewOutput: document.querySelector("#preview-output"),
  previewDetail: document.querySelector("#preview-detail"),
  correctButton: document.querySelector("#career-correct-button"),
  wrongButton: document.querySelector("#career-wrong-button"),
  testAccuracy: document.querySelector("#career-test-accuracy"),
  testCount: document.querySelector("#career-test-count"),
  reflection: document.querySelector("#career-reflection"),
  reportButton: document.querySelector("#career-report-button"),
  reportDialog: document.querySelector("#career-report-dialog"),
  reportClose: document.querySelector("#career-report-close"),
  printButton: document.querySelector("#career-print-button"),
  reportDate: document.querySelector("#career-report-date"),
  reportSymbol: document.querySelector("#report-symbol"),
  reportCompany: document.querySelector("#report-company"),
  reportProjectTitle: document.querySelector("#report-project-title"),
  reportTeamName: document.querySelector("#report-team-name"),
  reportAccuracy: document.querySelector("#report-accuracy"),
  reportProblem: document.querySelector("#report-problem"),
  reportMotions: document.querySelector("#report-motions"),
  reportReflection: document.querySelector("#report-reflection"),
  reportPitch: document.querySelector("#report-pitch"),
  status: document.querySelector("#career-status"),
  statusText: document.querySelector("#career-status-text"),
  offlineBadge: document.querySelector("#career-offline-badge"),
  classCode: document.querySelector("#career-class-code"),
  participantCount: document.querySelector("#career-participant-count"),
  joinButton: document.querySelector("#career-join-button"),
  rankingButton: document.querySelector("#career-ranking-button"),
  syncMessage: document.querySelector("#career-sync-message"),
  submitButton: document.querySelector("#career-submit-button"),
  rankingDialog: document.querySelector("#career-ranking-dialog"),
  rankingClose: document.querySelector("#career-ranking-close"),
  rankingRefresh: document.querySelector("#career-ranking-refresh"),
  rankingList: document.querySelector("#career-ranking-list")
};

const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || "{}");
const state = {
  scenarioId: SCENARIOS[stored.scenarioId] ? stored.scenarioId : "",
  teamName: typeof stored.teamName === "string" ? stored.teamName : "",
  gestures: stored.gestures && typeof stored.gestures === "object" ? stored.gestures : {},
  samples: {
    a: Array.isArray(stored.samples?.a) ? stored.samples.a : [],
    b: Array.isArray(stored.samples?.b) ? stored.samples.b : [],
    c: Array.isArray(stored.samples?.c) ? stored.samples.c : []
  },
  evaluation: {
    correct: Number(stored.evaluation?.correct) || 0,
    wrong: Number(stored.evaluation?.wrong) || 0
  },
  initialAccuracy: Number.isFinite(Number(stored.initialAccuracy)) ? Number(stored.initialAccuracy) : null,
  improvementCount: Number(stored.improvementCount) || 0,
  participantCount: Math.max(1, Math.min(20, Number(stored.participantCount) || 4)),
  reflection: typeof stored.reflection === "string" ? stored.reflection : ""
};

let membership;
try { membership = JSON.parse(localStorage.getItem(MEMBERSHIP_KEY) || "null"); } catch { membership = null; }

let poseLandmarker;
let drawingUtils;
let cameraStream;
let lastVideoTime = -1;
let lastFeatures;
let lastPrediction;
let modelTrained = false;
let isCollecting = false;

function scenario() { return SCENARIOS[state.scenarioId]; }
function saveState() { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function delay(milliseconds) { return new Promise((resolve) => window.setTimeout(resolve, milliseconds)); }
function setStatus(text, type = "") { elements.status.className = `status ${type}`.trim(); elements.statusText.textContent = text; }
function setOfflineBadge(text, type) { elements.offlineBadge.dataset.state = type; elements.offlineBadge.querySelector("span").textContent = text; }
function setSyncMessage(text, type = "") { elements.syncMessage.className = `sync-message ${type}`.trim(); elements.syncMessage.textContent = text; }
function setStep(step) {
  document.querySelectorAll("[data-career-step]").forEach((item) => {
    const value = Number(item.dataset.careerStep);
    item.classList.toggle("active", value === step);
    item.classList.toggle("done", value < step);
  });
}

function renderCareerCards() {
  elements.grid.innerHTML = Object.entries(SCENARIOS).map(([id, item]) => `
    <button class="career-card${state.scenarioId === id ? " active" : ""}" type="button" data-career="${id}">
      <span class="career-card-icon" aria-hidden="true">${item.icon}</span>
      <small>${item.company}</small>
      <strong>${item.title}</strong>
      <p>${item.problem}</p>
    </button>
  `).join("");
}

function renderMotionCards() {
  const current = scenario();
  elements.classList.innerHTML = current.commands.map((command) => `
    <article class="career-motion-card" data-class="${command.id}">
      <div class="career-motion-top">
        <span class="career-motion-key">${command.key}</span>
        <div class="career-motion-title"><strong>${command.action}</strong><small>제품이 실행할 명령</small></div>
        <span class="career-motion-count"><b id="career-count-${command.id}">${state.samples[command.id].length}</b>/${TARGET_SAMPLES}</span>
      </div>
      <div class="career-motion-bottom">
        <input data-gesture="${command.id}" maxlength="40" value="${escapeAttribute(state.gestures[command.id] || command.gesture)}" aria-label="${command.action}에 사용할 몸동작" />
        <button type="button" data-collect="${command.id}">수집</button>
      </div>
    </article>
  `).join("");
  elements.probabilities.innerHTML = current.commands.map((command) => `
    <label><span>${command.action}</span><progress id="career-prob-${command.id}" max="100" value="0"></progress><b id="career-prob-${command.id}-value">0%</b></label>
  `).join("");
}

function escapeAttribute(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function renderProject() {
  const current = scenario();
  if (!current) { elements.project.hidden = true; return; }
  elements.project.hidden = false;
  elements.symbol.textContent = current.icon;
  elements.company.textContent = current.company;
  elements.title.textContent = current.title;
  elements.problem.textContent = current.problem;
  elements.user.textContent = current.user;
  elements.goal.textContent = current.goal;
  elements.teamName.value = state.teamName;
  elements.reflection.value = state.reflection;
  elements.previewIcon.textContent = current.icon;
  renderMotionCards();
  updateCounts();
  updateEvaluation();
}

function resetProjectData() {
  CLASS_IDS.forEach((id) => { state.samples[id] = []; });
  state.gestures = {};
  state.evaluation = { correct: 0, wrong: 0 };
  state.initialAccuracy = null;
  state.improvementCount = 0;
  state.reflection = "";
  modelTrained = false;
  lastPrediction = undefined;
  elements.predictionChip.hidden = true;
  elements.testPanel.hidden = true;
  elements.designPanel.hidden = false;
  saveState();
}

function selectCareer(id) {
  if (!SCENARIOS[id]) return;
  if (state.scenarioId !== id) {
    resetProjectData();
    if (membership) {
      membership = null;
      localStorage.removeItem(MEMBERSHIP_KEY);
      setSyncMessage("진로 카드가 바뀌어 수업 참가 정보를 초기화했습니다. 다시 참가해 주세요.");
    }
  }
  state.scenarioId = id;
  saveState();
  renderCareerCards();
  renderProject();
  setStep(2);
  setStatus("동작 설계와 데이터 수집", "ready");
  elements.project.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateCounts() {
  if (!scenario()) return;
  CLASS_IDS.forEach((id) => {
    const count = document.querySelector(`#career-count-${id}`);
    if (count) count.textContent = state.samples[id].length;
  });
  const ready = CLASS_IDS.every((id) => state.samples[id].length >= TARGET_SAMPLES);
  elements.trainButton.disabled = isCollecting || !ready;
  elements.feedback.textContent = ready ? "세 동작의 데이터가 준비됐습니다. 프로토타입을 학습하세요." : `각 동작을 ${TARGET_SAMPLES}개씩 모아주세요.`;
}

function setCollectDisabled(disabled) {
  document.querySelectorAll("[data-collect]").forEach((button) => { button.disabled = disabled; });
  elements.resetButton.disabled = disabled;
  updateCounts();
}

async function collectSamples(classId) {
  if (isCollecting || !cameraStream || !lastFeatures) {
    elements.feedback.textContent = cameraStream ? "전신 관절점이 보일 때 다시 수집하세요." : "카메라를 먼저 켜주세요.";
    return;
  }
  isCollecting = true;
  setCollectDisabled(true);
  const card = document.querySelector(`[data-class="${classId}"]`);
  card.classList.add("collecting");
  const command = scenario().commands.find((item) => item.id === classId);
  elements.feedback.textContent = `${command.action}에 사용할 동작을 준비하세요.`;
  elements.countdown.hidden = false;
  for (let count = 3; count >= 1; count -= 1) { elements.countdown.textContent = count; await delay(650); }
  elements.countdown.textContent = "GO";
  await delay(350);
  elements.countdown.hidden = true;
  state.samples[classId] = [];
  while (state.samples[classId].length < TARGET_SAMPLES && cameraStream) {
    if (lastFeatures) {
      state.samples[classId].push([...lastFeatures]);
      document.querySelector(`#career-count-${classId}`).textContent = state.samples[classId].length;
      elements.feedback.textContent = `${command.action} 데이터 수집 중 · ${state.samples[classId].length}/${TARGET_SAMPLES}`;
    }
    await delay(95);
  }
  card.classList.remove("collecting");
  isCollecting = false;
  saveState();
  setCollectDisabled(false);
}

function normalizeLandmarks(landmarks) {
  const leftHip = landmarks[23], rightHip = landmarks[24], leftShoulder = landmarks[11], rightShoulder = landmarks[12];
  const centerX = (leftHip.x + rightHip.x) / 2, centerY = (leftHip.y + rightHip.y) / 2;
  const shoulderWidth = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  const torsoHeight = Math.hypot((leftShoulder.x + rightShoulder.x) / 2 - centerX, (leftShoulder.y + rightShoulder.y) / 2 - centerY);
  const scale = Math.max(shoulderWidth, torsoHeight, .08);
  return landmarks.flatMap((landmark) => [(landmark.x - centerX) / scale, (landmark.y - centerY) / scale, landmark.z / scale]);
}

function squaredDistance(first, second) {
  let sum = 0;
  for (let index = 0; index < first.length; index += 1) { const difference = first[index] - second[index]; sum += difference * difference; }
  return sum;
}

function classify(features) {
  const neighbors = CLASS_IDS.flatMap((classId) => state.samples[classId].map((sample) => ({ classId, distance: squaredDistance(features, sample) })))
    .sort((first, second) => first.distance - second.distance).slice(0, K_NEIGHBORS);
  const votes = { a: 0, b: 0, c: 0 };
  neighbors.forEach(({ classId }) => { votes[classId] += 1; });
  const probabilities = Object.fromEntries(CLASS_IDS.map((id) => [id, votes[id] / neighbors.length]));
  const winner = Object.entries(probabilities).sort((first, second) => second[1] - first[1])[0];
  return { classId: winner[0], confidence: winner[1], probabilities };
}

function updatePrediction(prediction) {
  const current = scenario();
  const command = current.commands.find((item) => item.id === prediction.classId);
  const confident = prediction.confidence >= .57;
  lastPrediction = confident ? prediction : undefined;
  elements.predictionName.textContent = confident ? command.action : "잘 모르겠어요";
  elements.predictionChip.hidden = false;
  elements.preview.dataset.command = confident ? command.id : "";
  elements.previewOutput.textContent = confident ? command.action : "동작을 더 분명하게 보여주세요";
  elements.previewDetail.textContent = confident ? command.output : "학습 데이터와 가까운 동작을 찾고 있습니다.";
  Object.entries(prediction.probabilities).forEach(([id, probability]) => {
    const percent = Math.round(probability * 100);
    document.querySelector(`#career-prob-${id}`).value = percent;
    document.querySelector(`#career-prob-${id}-value`).textContent = `${percent}%`;
  });
}

function drawPose(landmarks) {
  const context = elements.canvas.getContext("2d");
  context.clearRect(0, 0, elements.canvas.width, elements.canvas.height);
  drawingUtils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: "#5eead4", lineWidth: 4 });
  drawingUtils.drawLandmarks(landmarks, { color: "#f8fafc", fillColor: "#07152f", lineWidth: 2, radius: 4 });
}

function predictFrame() {
  if (!cameraStream || !poseLandmarker) return;
  if (elements.camera.currentTime !== lastVideoTime) {
    lastVideoTime = elements.camera.currentTime;
    const result = poseLandmarker.detectForVideo(elements.camera, performance.now());
    if (result.landmarks.length) {
      const landmarks = result.landmarks[0];
      drawPose(landmarks);
      lastFeatures = normalizeLandmarks(landmarks);
      if (modelTrained && !isCollecting) updatePrediction(classify(lastFeatures));
    } else {
      lastFeatures = undefined;
      elements.canvas.getContext("2d").clearRect(0, 0, elements.canvas.width, elements.canvas.height);
    }
  }
  requestAnimationFrame(predictFrame);
}

async function initializePoseModel() {
  if (!navigator.mediaDevices?.getUserMedia) {
    setStatus("카메라를 지원하지 않는 브라우저", "error");
    elements.cameraMessage.textContent = "최신 Chrome 또는 Edge가 필요합니다";
    return;
  }
  try {
    const vision = await FilesetResolver.forVisionTasks("./vendor/wasm");
    poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: "./models/pose_landmarker_lite.task", delegate: "CPU" },
      runningMode: "VIDEO", numPoses: 1,
      minPoseDetectionConfidence: .55, minPosePresenceConfidence: .55, minTrackingConfidence: .55
    });
    drawingUtils = new DrawingUtils(elements.canvas.getContext("2d"));
    elements.cameraButton.disabled = false;
    elements.cameraMessage.textContent = "의뢰를 선택한 뒤 카메라를 켜세요";
    elements.cameraHelp.textContent = "촬영 영상은 저장되지 않습니다.";
    setStatus(state.scenarioId ? "카메라 연결 대기" : "의뢰 선택 대기", "ready");
  } catch (error) {
    console.error(error);
    elements.cameraMessage.textContent = "AI 모델을 불러오지 못했습니다";
    setStatus("AI 모델 확인 필요", "error");
  }
}

async function startCamera() {
  if (!state.scenarioId) { setStatus("진로 카드를 먼저 선택하세요", "error"); return; }
  elements.cameraButton.disabled = true;
  elements.cameraButton.textContent = "카메라 연결 중…";
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: "user", width: { ideal: 960 }, height: { ideal: 720 } } });
    elements.camera.srcObject = cameraStream;
    await elements.camera.play();
    elements.canvas.width = elements.camera.videoWidth;
    elements.canvas.height = elements.camera.videoHeight;
    elements.cameraFrame.classList.add("live");
    elements.cameraButton.textContent = "카메라 끄기";
    setStatus("전신 관절점을 확인하세요", "ready");
    requestAnimationFrame(predictFrame);
  } catch (error) {
    console.error(error);
    elements.cameraButton.textContent = "다시 시도하기";
    elements.cameraHelp.textContent = error.name === "NotReadableError" ? "카메라를 사용하는 다른 앱을 닫아주세요." : "주소창에서 카메라 권한을 허용해 주세요.";
    setStatus("카메라 연결 실패", "error");
  } finally { elements.cameraButton.disabled = false; }
}

function stopCamera() {
  cameraStream?.getTracks().forEach((track) => track.stop());
  cameraStream = undefined;
  elements.camera.srcObject = null;
  elements.cameraFrame.classList.remove("live");
  elements.predictionChip.hidden = true;
  elements.cameraButton.textContent = "카메라 다시 켜기";
  lastFeatures = undefined;
}

async function toggleCamera() { if (cameraStream) stopCamera(); else await startCamera(); }

async function trainPrototype() {
  if (!CLASS_IDS.every((id) => state.samples[id].length >= TARGET_SAMPLES)) return;
  setStep(3);
  setStatus("세 동작의 패턴을 학습하고 있습니다");
  elements.trainButton.disabled = true;
  await delay(700);
  modelTrained = true;
  elements.designPanel.hidden = true;
  elements.testPanel.hidden = false;
  setStep(4);
  setStatus("사용자 상황으로 프로토타입을 시험하세요", "ready");
  if (lastFeatures) updatePrediction(classify(lastFeatures));
}

function resetSamples() {
  const previousStats = getTestStats();
  if (modelTrained && previousStats.total > 0) {
    if (state.initialAccuracy === null) state.initialAccuracy = previousStats.accuracy;
    state.improvementCount += 1;
    state.evaluation = { correct: 0, wrong: 0 };
  }
  CLASS_IDS.forEach((id) => { state.samples[id] = []; });
  modelTrained = false;
  lastPrediction = undefined;
  saveState();
  renderMotionCards();
  updateCounts();
  elements.predictionChip.hidden = true;
  updateEvaluation();
  setStep(2);
}

function getTestStats() {
  const total = state.evaluation.correct + state.evaluation.wrong;
  return { total, accuracy: total ? Math.round((state.evaluation.correct / total) * 100) : null };
}

function updateEvaluation() {
  const stats = getTestStats();
  elements.testAccuracy.textContent = stats.accuracy === null ? "기록 없음" : `성공률 ${stats.accuracy}%`;
  elements.testCount.textContent = `${stats.total}회 시험`;
}

function recordTest(correct) {
  state.evaluation[correct ? "correct" : "wrong"] += 1;
  const stats = getTestStats();
  if (stats.total === 5 && state.initialAccuracy === null) state.initialAccuracy = stats.accuracy;
  saveState();
  updateEvaluation();
}

function updateReport() {
  const current = scenario();
  const stats = getTestStats();
  const teamName = elements.teamName.value.trim() || "모둠 이름 미설정";
  state.teamName = elements.teamName.value.trim();
  state.reflection = elements.reflection.value.trim();
  saveState();
  elements.reportDate.textContent = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(new Date());
  elements.reportSymbol.textContent = current.icon;
  elements.reportCompany.textContent = current.company;
  elements.reportProjectTitle.textContent = current.title;
  elements.reportTeamName.textContent = teamName;
  elements.reportAccuracy.textContent = stats.accuracy === null ? "기록 없음" : `${stats.accuracy}%`;
  elements.reportProblem.textContent = current.problem;
  elements.reportMotions.innerHTML = current.commands.map((command) => `
    <div class="report-motion"><span>${command.action}</span><strong>${escapeAttribute(state.gestures[command.id] || command.gesture)}</strong><small>${state.samples[command.id].length}개 학습</small></div>
  `).join("");
  elements.reportReflection.textContent = state.reflection || "사용자 테스트에서 발견한 오류와 다음 개선 방법을 기록하세요.";
  elements.reportPitch.textContent = `${teamName}은 ${current.user}을 위해 ‘${current.title}’ 프로토타입을 만들었습니다.`;
}

function openReport() {
  updateReport();
  setStep(5);
  setStatus("모션 도구 제안서 완성", "ready");
  elements.reportDialog.showModal();
}

async function joinLiveClass() {
  const classCode = elements.classCode.value.trim().toUpperCase();
  const teamName = elements.teamName.value.trim();
  if (!state.scenarioId) { setSyncMessage("먼저 진로 카드를 선택하세요.", "error"); return; }
  if (!teamName) { setSyncMessage("선택한 프로젝트의 모둠 이름을 입력하세요.", "error"); elements.teamName.focus(); return; }
  if (!classCode) { setSyncMessage("교사가 알려준 수업 코드를 입력하세요.", "error"); elements.classCode.focus(); return; }

  elements.joinButton.disabled = true;
  setSyncMessage("수업 참가 정보를 확인하고 있습니다…");
  try {
    const response = await registerTeam(classCode, teamName, state.scenarioId);
    const joined = Array.isArray(response) ? response[0] : response;
    membership = {
      classCode,
      teamId: joined.team_id,
      teamToken: joined.team_token,
      sessionTitle: joined.session_title,
      teamName,
      scenarioId: state.scenarioId
    };
    localStorage.setItem(MEMBERSHIP_KEY, JSON.stringify(membership));
    setSyncMessage(`${joined.session_title} · ${teamName} 참가 완료`, "success");
    elements.joinButton.textContent = "참가 완료";
  } catch (error) {
    console.error(error);
    setSyncMessage(error.message, "error");
  } finally { elements.joinButton.disabled = false; }
}

async function submitToRanking() {
  updateReport();
  const stats = getTestStats();
  if (!membership || membership.scenarioId !== state.scenarioId) {
    elements.reportDialog.close();
    setSyncMessage("수업에 먼저 참가한 뒤 결과를 제출하세요.", "error");
    elements.classCode.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }
  if (!stats.total) { setStatus("사용자 시험을 한 번 이상 기록하세요", "error"); return; }

  elements.submitButton.disabled = true;
  elements.submitButton.textContent = "제출 중…";
  try {
    const response = await submitProjectResult(membership.teamId, membership.teamToken, {
      initialAccuracy: state.initialAccuracy ?? stats.accuracy,
      finalAccuracy: stats.accuracy,
      correctCount: state.evaluation.correct,
      wrongCount: state.evaluation.wrong,
      improvementCount: state.improvementCount,
      participantCount: state.participantCount,
      reflection: state.reflection
    });
    const result = Array.isArray(response) ? response[0] : response;
    setStatus(`랭킹 제출 완료 · 현재 ${result.total_score}점`, "ready");
    setSyncMessage(`${membership.teamName} 결과가 저장되었습니다.`, "success");
    elements.submitButton.textContent = "제출 완료";
  } catch (error) {
    console.error(error);
    setStatus("랭킹 제출 실패", "error");
    setSyncMessage(error.message, "error");
    elements.submitButton.textContent = "다시 제출";
  } finally { elements.submitButton.disabled = false; }
}

function renderLeaderboard(rows) {
  if (!rows.length) {
    elements.rankingList.innerHTML = '<p class="empty-ranking">아직 제출된 모둠 결과가 없습니다.</p>';
    return;
  }
  elements.rankingList.innerHTML = rows.map((row) => {
    const item = SCENARIOS[row.scenario_id];
    return `<article class="ranking-row${Number(row.rank) <= 3 ? " top" : ""}">
      <span class="ranking-rank">${row.rank}위</span>
      <div class="ranking-team"><strong>${escapeAttribute(row.team_name)}</strong><small>${item?.icon || "🤖"} ${item?.company || "모션AI 프로젝트"}</small></div>
      <div class="ranking-metric">정확도<b>${row.final_accuracy}%</b></div>
      <div class="ranking-metric">개선<b>+${row.improvement}%p</b></div>
      <div class="ranking-metric">시험<b>${row.test_count}회</b></div>
      <strong class="ranking-score">${row.total_score}점</strong>
    </article>`;
  }).join("");
}

async function refreshLeaderboard() {
  const classCode = (elements.classCode.value.trim() || membership?.classCode || "").toUpperCase();
  if (!classCode) {
    elements.rankingList.innerHTML = '<p class="empty-ranking">교사가 알려준 수업 코드를 먼저 입력하세요.</p>';
    return;
  }
  elements.rankingRefresh.disabled = true;
  elements.rankingList.innerHTML = '<p class="empty-ranking">랭킹을 불러오는 중입니다…</p>';
  try { renderLeaderboard(await getLeaderboard(classCode)); }
  catch (error) { elements.rankingList.innerHTML = `<p class="empty-ranking">${escapeAttribute(error.message)}</p>`; }
  finally { elements.rankingRefresh.disabled = false; }
}

function openLeaderboard() {
  elements.rankingDialog.showModal();
  refreshLeaderboard();
}

async function setupOfflineMode() {
  if (!("serviceWorker" in navigator)) { setOfflineBadge("오프라인 미지원", "error"); return; }
  try {
    await navigator.serviceWorker.register("./service-worker.js");
    await navigator.serviceWorker.ready;
    setOfflineBadge(navigator.onLine ? "오프라인 준비 완료" : "오프라인 실행 중", navigator.onLine ? "ready" : "offline");
  } catch (error) { console.error(error); setOfflineBadge("오프라인 준비 실패", "error"); }
}

elements.grid.addEventListener("click", (event) => {
  const card = event.target.closest("[data-career]");
  if (card) selectCareer(card.dataset.career);
});
elements.classList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-collect]");
  if (button) collectSamples(button.dataset.collect);
});
elements.classList.addEventListener("input", (event) => {
  if (!event.target.matches("[data-gesture]")) return;
  state.gestures[event.target.dataset.gesture] = event.target.value.trim();
  saveState();
});
elements.teamName.addEventListener("input", () => { state.teamName = elements.teamName.value; saveState(); });
elements.reflection.addEventListener("input", () => { state.reflection = elements.reflection.value; saveState(); });
elements.classCode.addEventListener("input", () => { elements.classCode.value = elements.classCode.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
elements.participantCount.addEventListener("change", () => {
  state.participantCount = Math.max(1, Math.min(20, Number(elements.participantCount.value) || 1));
  elements.participantCount.value = state.participantCount;
  saveState();
});
elements.changeCareerButton.addEventListener("click", () => { stopCamera(); elements.project.hidden = true; setStep(1); setStatus("새 의뢰를 선택하세요"); window.scrollTo({ top: 0, behavior: "smooth" }); });
elements.cameraButton.addEventListener("click", toggleCamera);
elements.trainButton.addEventListener("click", trainPrototype);
elements.resetButton.addEventListener("click", resetSamples);
elements.correctButton.addEventListener("click", () => recordTest(true));
elements.wrongButton.addEventListener("click", () => recordTest(false));
elements.reportButton.addEventListener("click", openReport);
elements.reportClose.addEventListener("click", () => elements.reportDialog.close());
elements.joinButton.addEventListener("click", joinLiveClass);
elements.submitButton.addEventListener("click", submitToRanking);
elements.rankingButton.addEventListener("click", openLeaderboard);
elements.rankingRefresh.addEventListener("click", refreshLeaderboard);
elements.rankingClose.addEventListener("click", () => elements.rankingDialog.close());
elements.printButton.addEventListener("click", () => window.print());
window.addEventListener("online", () => setOfflineBadge("오프라인 준비 완료", "ready"));
window.addEventListener("offline", () => setOfflineBadge("오프라인 실행 중", "offline"));
window.addEventListener("beforeunload", stopCamera);

renderCareerCards();
if (state.scenarioId) { renderProject(); setStep(2); }
elements.participantCount.value = state.participantCount;
if (membership) {
  elements.classCode.value = membership.classCode || "";
  elements.joinButton.textContent = "참가 완료";
  setSyncMessage(`${membership.sessionTitle} · ${membership.teamName} 참가 중`, "success");
}
setupOfflineMode();
initializePoseModel();
