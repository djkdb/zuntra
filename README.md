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

## 배포 (Vercel)

- 환경변수: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_APP_URL` (+ 이후 `OPENAI_API_KEY`)
- Build Command: `npm run vercel-build` (generate → migrate deploy → build)
- 레이트 리밋은 현재 인스턴스 메모리 기반이다. 트래픽이 생기면 `src/server/rate-limit.ts`의
  `RateLimiter` 인터페이스 뒤에 Upstash Redis 같은 공유 저장소를 붙인다.

## 진행 상황

- [x] **Phase 1** — 프로젝트, DB(전체 스키마), 인증·온보딩, 레이아웃, 랜딩, 대시보드, Trip CRUD
- [ ] Phase 2 — 일정 CRUD, Day별 UI, drag & drop
- [ ] Phase 3 — AI 일정 생성 (structured output, validation)
- [ ] Phase 4 — AI Companion + Action 승인
- [ ] Phase 5 — 지도, 날씨, 예산, 준비물
- [ ] Phase 6 — 여행 기록, Travel Report
- [ ] Phase 7 — Demo Mode 완성, Analytics, Admin, 보안/성능
- [ ] Phase 8 — QA, 배포
