# TripMate

> 여행을 계획하는 게 아니라, 여행을 함께 준비하세요.

여행 전·여행 중·여행 후를 하나의 흐름(PLAN → PREPARE → TRAVEL → ADAPT → REMEMBER)으로
관리하는 AI 여행 동행 서비스. 설계 문서는 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

## Stack

Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 · shadcn/ui ·
Prisma 7 + PostgreSQL · Auth.js v5 · Zod · TanStack Query · Vitest · Playwright

## 시작하기

```bash
cp .env.example .env          # DATABASE_URL, AUTH_SECRET 채우기 (openssl rand -base64 32)
npm install                   # postinstall에서 prisma generate
npm run db:migrate            # 마이그레이션 적용
npm run dev                   # http://localhost:3000
```

## 스크립트

| 명령 | 설명 |
| --- | --- |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm test` | unit + integration (`.env.test`의 **테스트 DB** 사용, 자동 migrate) |
| `npm run test:e2e` | Playwright: 프로덕션 빌드를 포트 3100에서 띄워 desktop/mobile 시나리오 실행 |
| `npm run db:studio` | Prisma Studio |

로컬 테스트 DB 준비: `createdb -O tripmate tripmate_test` (계정/비밀번호는 `.env.test` 참고).
Playwright 브라우저가 다른 경로에 있다면 `PLAYWRIGHT_CHROMIUM_PATH`로 지정할 수 있다.

## 주요 기능

| 단계 | 기능 |
| --- | --- |
| PLAN | AI 일정 생성(이동시간·속도·취향 반영, 검증 레이어), Day별 편집, drag & drop, 충돌 감지 → 자동 조정 |
| PREPARE | 예산·경비(분석·차트), AI 준비물 체크리스트, 여행 날씨(비 예보 → 실내 일정 제안) |
| TRAVEL | TODAY 화면(현재·다음 일정, 이동시간, 날씨), 지도(Day 필터·경로·현재 위치) |
| ADAPT | AI 동행: 상황 인지 대화 + 제안(Action) → 사용자 승인 후에만 적용, AI로 일정 다시 맞추기 |
| REMEMBER | 여행 기록(사진·기분·별점·장소), 여행 종료 → AI 여행 리포트 |
| 기타 | Demo Mode(DB 미사용), 관리자 지표, 오프라인 열람(Service Worker), SEO/OG |

## 환경변수

`.env.example` 참고. 키가 없으면 각 기능은 결정적(mock) 구현으로 동작합니다.

| 변수 | 설명 |
| --- | --- |
| `DATABASE_URL`, `AUTH_SECRET` | 필수 |
| `OPENAI_API_KEY` | 있으면 OpenAI 사용, 없으면 mock AI (`AI_PROVIDER=mock`으로 강제 가능) |
| `AI_MODEL_DEFAULT` / `AI_MODEL_PLANNER` / `AI_MODEL_COMPANION` | 기능별 모델 (기본 `gpt-5-mini`) |
| `AI_DAILY_BUDGET_USD` | 사용자당 하루 AI 비용 상한 (기본 0.5) |
| `WEATHER_PROVIDER` | `open-meteo`(기본, 키 불필요) / `mock` |
| `MAPS_PROVIDER` | `osm`(기본: Open-Meteo 지오코딩 + Nominatim) / `mock` |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | 설정 시 지도 타일을 Mapbox로 (없으면 OSM 타일) |
| `STORAGE_PROVIDER` | `local`(개발) / `supabase` + `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` |

관리자 권한 부여: `npm run admin:grant -- you@example.com` → `/admin`

## 배포 (Vercel)

- 환경변수: 위 표 참고 (운영에서는 `STORAGE_PROVIDER=supabase` 필수 — Vercel 파일시스템은 영구 저장소가 아님)
- Build Command: `npm run vercel-build` (generate → migrate deploy → build)
- 레이트 리밋은 현재 인스턴스 메모리 기반입니다. 다중 인스턴스 운영 시 `src/server/rate-limit.ts`의
  `RateLimiter` 인터페이스 뒤에 Upstash Redis 같은 공유 저장소를 붙이세요. (AI 일일 비용 상한은 DB 기반이라 인스턴스 간에도 유지됩니다.)
- OSM 타일·Nominatim은 개발/소규모용입니다. 트래픽이 생기면 Mapbox 토큰을 설정하세요.

## 진행 상황

- [x] Phase 1 — 프로젝트, DB, 인증·온보딩, 레이아웃, 랜딩, 대시보드, Trip CRUD
- [x] Phase 2 — 일정 CRUD, Day별 UI, drag & drop, 충돌 자동 조정
- [x] Phase 3 — AI service layer, AI 일정 생성(structured output + Zod + validation), AI 재조정
- [x] Phase 4 — AI Companion, 컨텍스트, Action + 사용자 승인, TODAY, 날씨
- [x] Phase 5 — 지도, 예산·경비, 준비물
- [x] Phase 6 — 여행 기록·사진, 여행 종료, AI Travel Report
- [x] Phase 7 — Demo Mode, Analytics, Admin, 오프라인, 보안
- [x] Phase 8 — 전체 여정 E2E(데스크톱·모바일), 보안 검토 반영, 성능(Lighthouse)
