import { performance } from "node:perf_hooks";

const baseUrl = process.argv[2] || "https://kionlabs.github.io/motion_ai/";
const studentCount = Number(process.argv[3] || 24);
const aiStudentCount = Number(process.argv[4] || 8);

const shellAssets = [
  "",
  "styles.css",
  "app.js",
  "career.html",
  "career.css",
  "career.js",
  "manifest.webmanifest",
  "service-worker.js",
  "icons/app-icon.svg",
  "vendor/vision_bundle.mjs"
];

const aiAssets = [
  "vendor/wasm/vision_wasm_internal.js",
  "vendor/wasm/vision_wasm_internal.wasm",
  "models/pose_landmarker_lite.task"
];

async function requestAsset(student, asset, phase) {
  const startedAt = performance.now();
  try {
    const response = await fetch(new URL(asset, baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(60000)
    });
    const body = await response.arrayBuffer();
    return {
      student,
      asset: asset || "index.html",
      phase,
      ok: response.ok,
      status: response.status,
      bytes: body.byteLength,
      duration: performance.now() - startedAt
    };
  } catch (error) {
    return {
      student,
      asset: asset || "index.html",
      phase,
      ok: false,
      status: 0,
      bytes: 0,
      duration: performance.now() - startedAt,
      error: error.message
    };
  }
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
}

function summarize(label, results) {
  const failed = results.filter((result) => !result.ok);
  const durations = results.map((result) => result.duration);
  const totalBytes = results.reduce((sum, result) => sum + result.bytes, 0);
  console.log(`\n${label}`);
  console.log(`  요청 ${results.length}건 / 성공 ${results.length - failed.length}건 / 실패 ${failed.length}건`);
  console.log(`  전송량 ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  응답 시간 p50 ${percentile(durations, 0.5).toFixed(0)}ms / p95 ${percentile(durations, 0.95).toFixed(0)}ms / 최대 ${Math.max(...durations).toFixed(0)}ms`);
  for (const failure of failed.slice(0, 10)) {
    console.log(`  실패: 학생 ${failure.student}, ${failure.asset}, HTTP ${failure.status}, ${failure.error || "응답 오류"}`);
  }
  return failed.length;
}

console.log(`대상: ${baseUrl}`);
console.log(`가상 학생: 초기 접속 ${studentCount}명 / AI 초기화 ${aiStudentCount}명`);

const shellStartedAt = performance.now();
const shellResults = await Promise.all(
  Array.from({ length: studentCount }, (_, index) =>
    shellAssets.map((asset) => requestAsset(index + 1, asset, "shell"))
  ).flat()
);
const shellWallTime = performance.now() - shellStartedAt;

const aiStartedAt = performance.now();
const aiResults = await Promise.all(
  Array.from({ length: aiStudentCount }, (_, index) =>
    aiAssets.map((asset) => requestAsset(index + 1, asset, "ai"))
  ).flat()
);
const aiWallTime = performance.now() - aiStartedAt;

const failures = summarize("1단계: 학생용 화면 동시 접속", shellResults)
  + summarize("2단계: AI 파일 동시 초기화", aiResults);

console.log(`\n단계별 실제 경과: 화면 ${(shellWallTime / 1000).toFixed(1)}초 / AI ${(aiWallTime / 1000).toFixed(1)}초`);
process.exitCode = failures ? 1 : 0;
