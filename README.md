# 교사숙려캠프

학부모 민원 응대 시뮬레이션 웹앱입니다. 교사가 학부모 역할의 AI와 대화한 뒤, 응대 내용을 평가받을 수 있습니다.

## 현재 구성

- `index.html`: 정적 웹페이지 진입점
- `assets/app.js`: 화면 흐름, 시뮬레이션 대화, 평가 결과 표시
- `assets/styles.css`: 화면 스타일
- `netlify/functions/chat.js`: AI 학부모 응답 생성 및 첫 발화 생성
- `netlify/functions/speak.js`: 학부모 발화 음성 합성(TTS)
- `netlify/functions/random-situation.js`: 사례 기반 연습 상황 생성
- `netlify/functions/evaluate.js`: 교사 응대 평가
- `netlify/functions/save-situation.js`: 선택한 상황 저장
- `netlify/functions/_complaint_cases.js`: 비식별화된 민원 사례 코퍼스
- `supabase.sql`: Supabase 테이블 생성 SQL
- `APPLIED_PROMPTS.md`: 현재 적용된 프롬프트 정리
- `RAG_PLAN.md`: 사례 기반 상황 생성 설계 문서

## 음성 대화 흐름

1. `대화 시작`을 누르면 AI 학부모의 첫 발화가 생성되고 곧바로 음성으로 재생됩니다.
2. 교사가 `🎙 음성` 버튼을 한 번 누르면 마이크가 열립니다.
3. 말이 끝나고 1.8초 동안 무음이면 인식 결과가 자동으로 전송됩니다. 전송 버튼을 누르지 않아도 됩니다.
4. 학부모 응답이 음성으로 재생되고, 재생이 끝나면 마이크가 자동으로 다시 열립니다.
5. 녹음 중 마이크 버튼을 누르면, 입력된 말이 있으면 즉시 전송하고 비어 있으면 음성 모드를 끕니다.

음성 인식은 브라우저 Web Speech API를 사용하므로 Chrome·Edge에서 동작합니다.
미지원 브라우저(iOS Safari 등)에서는 안내 메시지를 표시하고 텍스트 입력으로 계속 연습할 수 있습니다.
음성 합성이 실패하면 브라우저 내장 음성으로 대체하고, 그것도 불가능하면 텍스트만 표시합니다.

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
- `OPENAI_MODEL`: 사용할 모델 이름. 기본값은 `gpt-4.1`
- `OPENAI_CHAT_MODEL`: 학부모 대사 전용 모델. 지정하면 `OPENAI_MODEL`보다 우선합니다
- `OPENAI_PRIMARY_EVAL_MODEL`: 평가 모델. 기본값은 `gpt-4.1-mini`
- `OPENAI_TIMEOUT_MS`: AI 요청 제한 시간(ms). 기본값은 25000
- `OPENAI_EVAL_TIMEOUT_MS`: 평가 요청 제한 시간(ms). 기본값은 20000
- `OPENAI_TTS_MODEL`: 음성 합성 모델. 기본값은 `gpt-4o-mini-tts`
- `OPENAI_TTS_VOICE`: 학부모 음색. 기본값은 `coral`
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
