# CONVENTIONS.md — Code Conventions
_Mapped: 2026-04-27_

> Primary source: `RULES_AND_GUIDELINES.md` §7 (Code Style). This document distills it for quick reference.

## Language & TypeScript

- TypeScript strict mode across all 3 sub-projects. No `any` unless commented with reason.
- Backend: TS 5.7, Node 20+. Frontend: TS ^5. Mobile: TS ~5.9.
- No commented-out code in commits.

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| NestJS module files | `<feature>.<type>.ts` | `auth.service.ts`, `auth.controller.ts` |
| DTOs | `<action>-<noun>.dto.ts` | `create-job.dto.ts`, `login.dto.ts` |
| Test files | `<feature>.<type>.spec.ts` | `auth.service.spec.ts` |
| Frontend pages | `page.tsx` in route directory | `app/(dashboard)/employee/page.tsx` |
| Frontend components | `PascalCase.tsx` | `AuthGuard.tsx`, `NotificationBell.tsx` |
| Frontend lib files | `camelCase.ts` | `authStorage.ts`, `roleMap.ts` |
| Frontend API clients | `<domain>Api.ts` | `authApi.ts` |
| Mobile screens | `<Role><Feature>Screen.tsx` | `EmployeeTimekeepingScreen.tsx` |
| Branches | `feature/<ticket>-<desc>` or `fix/<desc>` | `feature/t3-142-user-profile-header` |

## Commit Convention

Conventional Commits. Prefixes: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`, `docs:`, `ux:`.
- Subject ≤ 72 chars, imperative mood ("add", not "added")
- Scope optional: `feat(mail): add brevo retry`

## File Organization

### Backend (NestJS)
- Module-per-feature: `<feature>.module.ts`, `<feature>.controller.ts`, `<feature>.service.ts`, `dto/`
- Business logic → service only. Controllers stay thin (parse input → delegate → return).
- Supabase access only via `supabase/supabase.service.ts` — no ad hoc `createClient`.
- Onboarding exception: 4 controllers for different roles, single shared service.

### Frontend (Next.js)
- App Router. Server components by default; `'use client'` only when needed (event handlers, hooks, browser APIs).
- shadcn/ui primitives in `src/components/ui/` — **wrap, don't edit** primitives directly.
- API calls go through `src/lib/*Api.ts` — no raw `fetch` in page/component files.
- Conditional Tailwind classes via `cn()` from `lib/utils.ts` (clsx + tailwind-merge).

### Mobile
- One screen = one file in `src/screens/`.
- Navigation: drawer + native stack only (no bottom tabs without team agreement).
- Tokens in `AsyncStorage` — never in plain React state.

## Error Handling

- Backend: NestJS exceptions (`UnauthorizedException`, `NotFoundException`, etc.) — Nest formats response automatically as `{ statusCode, message, error }`.
- Fire-and-forget side effects (audit logs) wrapped in try/catch to avoid blocking main flow.
- Email send errors currently only logged, not propagated (known issue in `mail.service.ts`).
- Frontend/mobile: catch blocks should surface user-facing errors via `sonner` toasts.

## Async Patterns

- Backend: `async/await` throughout. `@Injectable()` services.
- Frontend: `async/await` in server components and `useEffect` callbacks; no Promise chains.
- Cron jobs: `@Cron()` decorator from `@nestjs/schedule` in task classes.

## Frontend Patterns (Next.js / React)

- Dark mode via `next-themes` — every new color must work in both light/dark themes.
- Route protection via `<AuthGuard allowedRoles={[...]}>` wrapper in page components.
- Auth token lifecycle: access token in memory (`authStorage.ts`), refresh via HTTP-only cookie.
- Google OAuth via `GoogleAuthProvider` wrapping root layout.

## Backend Patterns (NestJS)

- Global prefix: `api/tribeX/auth`. URI versioning default v1 → `/api/tribeX/auth/v1/...`
- Global `ValidationPipe({ transform: true, whitelist: true })` — strips unknown props.
- Rate limiting: `@Throttle()` on auth/email endpoints. Global default: 10 req/60s.
- Swagger: `@ApiTags()`, `@ApiOperation()` required on every controller/endpoint.
- JWT guards: `@UseGuards(JwtAuthGuard)` + `@Roles('Role Name')` + `@UseGuards(RolesGuard)`.

## Import Style

- Absolute imports with TypeScript path aliases (`@/components/...` in frontend).
- Backend: relative imports within modules, absolute for cross-module deps.
- No barrel `index.ts` files observed — direct file imports.

## Linting & Formatting

- ESLint + Prettier as source of truth. `npm run lint` must pass before PR.
- Backend: `eslint-plugin-prettier` enforces Prettier through ESLint.
- Frontend: `eslint-config-next`.
