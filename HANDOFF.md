# 교사숙려캠프 진행 인수인계

## 현재 상태

- `simulation` 저장소에 교사숙려캠프 웹앱 소스를 추가하는 작업을 진행 중입니다.
- 원본 소스는 사용자가 제공한 `웹페이지.zip`에서 가져왔습니다.
- `node_modules`와 `.netlify` 배포 캐시는 저장소에 추가하지 않습니다.
- Netlify 연결은 재인증이 필요합니다.

## 현재 웹앱 기능

- 학부모 페르소나 선택
- 민원 상황 생성 및 선택
- AI 학부모와 교사 응대 시뮬레이션
- 7개 영역 기반 응대 평가
- Supabase에 대화·평가·상황 저장

## 다음 작업

1. GitHub 작업 브랜치에 소스 추가
2. 로컬 정적 파일 및 Netlify Functions 기본 검증
3. GitHub Draft PR 생성
4. Netlify 재인증 후 배포 상태 확인
5. 사용자와 기능 개선 우선순위 결정

## 중요 보안 주의

- `OPENAI_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`는 저장소에 커밋하지 않습니다.
- 비밀값은 Netlify 환경변수로만 관리합니다.
