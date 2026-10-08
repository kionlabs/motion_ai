# Supabase 설정

1. Supabase Dashboard의 **SQL Editor**에서 `migrations/202610080001_motion_ai_schema.sql` 전체를 실행합니다.
2. **Settings → API → Exposed schemas**에 `motion_ai`를 추가합니다.
3. SQL Editor에서 수업을 하나 만듭니다.

```sql
select motion_ai.create_class_session(
  '2026 모션AI 진로체험',
  'MOTION1',
  now() + interval '1 day'
);
```

학생들은 웹앱에서 `MOTION1`을 입력해 참가합니다. 실제 수업에서는 매번 새로운 코드를 사용하세요.

## 데이터 원칙

- 카메라 영상, 사진, 관절 좌표, 학생 실명은 저장하지 않습니다.
- 브라우저에는 publishable key만 포함합니다.
- 테이블 권한은 익명 사용자에게 부여하지 않고, 제한된 RPC 함수만 허용합니다.
- 모둠 토큰은 원문을 DB에 저장하지 않고 SHA-256 해시로 비교합니다.
- `service_role` 또는 secret key는 웹 파일에 넣지 않습니다.

## 점수 구조

- 정확도: 30점
- 개선 효과: 25점
- 사용자 시험 횟수: 20점
- 교사 동작 설계 평가: 15점
- 교사 데이터 다양성 평가: 10점

웹앱은 앞의 75점을 자동 계산합니다. 교사 평가 25점은 후속 교사용 화면에서 입력하도록 분리했습니다.
