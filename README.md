# 모션AI 연구소

중학교 진로체험 수업용 오프라인 우선 모션 AI 웹앱 프로젝트입니다.

## 현재 상태

- 설치 없는 정적 웹앱 기본 구조
- 반응형 한국어 수업 화면
- 브라우저·카메라 권한 점검
- MediaPipe 기반 실시간 몸 관절점 인식
- 왼쪽·오른쪽·정지 자세별 데이터 수집
- 브라우저 메모리에서 작동하는 k-NN 자세 분류기
- 실시간 클래스 확률 표시와 데이터 보강 흐름
- 왼쪽·오른쪽·정지 자세로 조종하는 30초 에너지 코어 미션
- 새로고침해도 같은 탭에서는 수집 데이터가 유지되는 임시 저장
- 모둠 이름과 참여 인원 설정
- 개선 전·후 정답/오답 기록 및 정확도 비교
- 학습 데이터·미션 최고점·향상 폭을 담은 활동 결과 카드
- 결과 카드 인쇄 및 PDF 저장용 레이아웃
- 서비스 워커 기반 오프라인 실행 캐시와 연결 상태 표시
- 홈 화면 설치용 웹앱 매니페스트
- 다음 모둠을 위한 전체 활동 초기화
- Node.js 내장 모듈만 사용하는 로컬 서버
- MediaPipe 라이브러리·WASM·포즈 모델을 프로젝트에 로컬 포함
- 기존 실습과 분리된 2차시 진로 프로젝트 메뉴
- 게임·병원·스마트홈·공연·접근성·스포츠 분야의 모션AI 의뢰 카드
- 진로 카드별 동작 설계, 데이터 학습, 프로토타입 시험과 제안 카드
- Supabase 수업 코드로 모둠 결과 제출 및 실시간 랭킹 조회
- 카드별 10라운드 자동 사용자 미션과 AI 기반 성공·오류 판정

## 실행

Node.js가 설치된 컴퓨터에서 이 폴더를 열고 다음 명령을 실행합니다.

```powershell
npm start
```

브라우저에서 `http://127.0.0.1:8080`을 엽니다.

1차시 기본 실습은 `/index.html`, 2차시 진로 프로젝트는 `/career.html`에서 실행합니다.

## Supabase 데이터베이스 준비

`supabase/migrations/202610080001_motion_ai_schema.sql`을 Supabase SQL Editor에서 실행하고 API의 Exposed schemas에 `motion_ai`를 추가합니다. 수업 생성 SQL과 개인정보 보호 원칙은 `supabase/README.md`에 정리되어 있습니다.

## 예정 구조

- `models/`: 오프라인 MediaPipe 포즈 모델 파일
- `vendor/`: 외부 CDN 대신 로컬에서 제공하는 MediaPipe 라이브러리와 WASM
- `activities/`: 수업 단계와 미션 데이터
- `app.js`: 카메라와 활동 상태 관리
- `server.mjs`: 로컬 실행 서버

## 학교 배포 시 주의

- 학생 기기에서 카메라 권한 허용 여부를 사전 점검합니다.
- 모든 AI 라이브러리와 모델 파일이 외부 CDN 없이 프로젝트 안에 포함되어 있습니다.
- 교사 노트북의 로컬 서버에 학생들이 접속하는 방식은 HTTPS와 학교 방화벽 정책을 별도로 확인해야 합니다.

## GitHub Pages 배포

이 저장소는 `main` 브랜치에 변경 사항이 올라오면 GitHub Actions가 자동으로 정적 배포본을 만들도록 구성되어 있습니다.

1. GitHub 저장소의 **Settings → Pages**에서 Source를 **GitHub Actions**로 설정합니다.
2. 소스를 `main` 브랜치에 push합니다.
3. 저장소의 **Actions** 탭에서 `Deploy Motion AI to GitHub Pages` 작업이 완료될 때까지 기다립니다.
4. 배포 주소 `https://kionlabs.github.io/motion_ai/`에서 카메라와 오프라인 준비 상태를 확인합니다.

로컬에서 배포 파일을 점검하려면 다음 명령을 실행합니다.

```powershell
npm run check
npm run build
```

완성된 정적 파일은 `dist` 폴더에 생성되며 Git에는 포함하지 않습니다.

## 학생용 QR 코드

학생용 접속 주소는 `https://kionlabs.github.io/motion_ai/`입니다. 교실 화면 공유에는
`teacher-assets/motion-ai-student-qr.png`, 인쇄물 편집에는 확대해도 선명한
`teacher-assets/motion-ai-student-qr.svg`를 사용합니다.

공개 주소가 바뀌면 `scripts/generate-student-qr.mjs`의 `studentUrl`을 수정한 뒤 다음
명령으로 QR 이미지를 다시 만듭니다.

```powershell
npm run qr
```

## 동시 접속 시험

기본 시험은 가상 학생 24명이 화면 파일에 동시에 접속하고, 그중 8명이 AI 모델을
동시에 초기화하는 상황을 확인합니다.

```powershell
npm run load-test
```

학생 수와 AI 동시 초기화 인원은 순서대로 변경할 수 있습니다.

```powershell
node scripts/load-test.mjs https://kionlabs.github.io/motion_ai/ 24 8
```
