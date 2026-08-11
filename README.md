# 교사숙려캠프

학부모 민원 응대 시뮬레이션 웹앱입니다. 교사가 학부모 역할의 AI와 대화한 뒤, 응대 내용을 평가받을 수 있습니다.

## 현재 구성

- `index.html`: 정적 웹페이지 진입점
- `assets/app.js`: 화면 흐름, 시뮬레이션 대화, 평가 결과 표시
- `assets/styles.css`: 화면 스타일
- `netlify/functions/chat.js`: AI 학부모 응답 생성
- `netlify/functions/random-situation.js`: 사례 기반 연습 상황 생성
- `netlify/functions/evaluate.js`: 교사 응대 평가
- `netlify/functions/save-situation.js`: 선택한 상황 저장
- `netlify/functions/_complaint_cases.js`: 비식별화된 민원 사례 코퍼스
- `supabase.sql`: Supabase 테이블 생성 SQL
- `APPLIED_PROMPTS.md`: 현재 적용된 프롬프트 정리
- `RAG_PLAN.md`: 사례 기반 상황 생성 설계 문서

## 실행 및 배포

Netlify CLI와 Node.js 18.14 이상이 필요합니다.

```bash
npm install
npm run dev
```

Netlify 배포 설정은 `netlify.toml`에 있습니다.

- Build command: 없음
- Publish directory: `.`
- Functions directory: `netlify/functions`

## Netlify 환경변수

Netlify 사이트의 환경변수에 다음 값을 등록해야 합니다.

- `OPENAI_API_KEY`: OpenAI API 키
- `OPENAI_MODEL`: 사용할 모델 이름. 기본값은 `gpt-4o-mini`
- `SUPABASE_URL`: Supabase 프로젝트 URL
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service role 키

`SUPABASE_SERVICE_ROLE_KEY`는 브라우저 코드나 저장소에 넣으면 안 됩니다. Netlify Functions의 서버 환경변수로만 관리합니다.

## Supabase

`supabase.sql`을 Supabase SQL Editor에서 실행하면 다음 테이블이 생성됩니다.

- `public.simulation_messages`
- `public.simulation_evaluations`
- `public.simulation_situations`

## 운영 원칙

- 교사숙려캠프의 기준 소스는 이 저장소입니다.
- 기능을 수정할 때는 먼저 로컬에서 확인하고, 작업 단위별로 커밋합니다.
- 실제 개인정보와 비밀키를 저장소에 커밋하지 않습니다.
- 변경 이유와 중요한 결정은 `HANDOFF.md` 또는 별도 문서에 기록합니다.
