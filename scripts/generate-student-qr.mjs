import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import QRCode from "qrcode";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const outputRoot = join(projectRoot, "teacher-assets");
const studentUrl = "https://kionlabs.github.io/motion_ai/";

mkdirSync(outputRoot, { recursive: true });

await QRCode.toFile(join(outputRoot, "motion-ai-student-qr.png"), studentUrl, {
  errorCorrectionLevel: "H",
  margin: 4,
  width: 1200,
  color: {
    dark: "#061121",
    light: "#ffffff"
  }
});

const svg = await QRCode.toString(studentUrl, {
  type: "svg",
  errorCorrectionLevel: "H",
  margin: 4,
  color: {
    dark: "#061121",
    light: "#ffffff"
  }
});

writeFileSync(join(outputRoot, "motion-ai-student-qr.svg"), svg);
writeFileSync(
  join(outputRoot, "student-url.txt"),
  `모션AI 연구소 학생용 접속 주소\n${studentUrl}\n`
);

console.log(`학생용 QR 코드 생성 완료: ${outputRoot}`);
