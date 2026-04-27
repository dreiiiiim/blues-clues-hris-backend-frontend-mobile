# CONCERNS.md — Technical Concerns
_Mapped: 2026-04-27_

## Known Bugs

### 1. Email failures silently swallowed — applicant verification flow
**File:** `tribeX-hris-auth-api/src/mail/mail.service.ts`
**Detail:** `sendMail()` throws `Error('Brevo send failed with HTTP ...')` on non-2xx, but call sites in the applicant verification flow catch and log without re-throwing or surfacing to the user. If Brevo is misconfigured or rate-limited, the applicant gets no verification email and no error feedback.
**Risk:** High — invisible to ops, user-facing data loss.

### 2. `time_logs` table missing in Supabase
**Source:** `RULES_AND_GUIDELINES.md` §13 + project memory
**Detail:** `time_logs` table doesn't exist in some/all Supabase environments. Any timekeeping code that queries it fails silently or with a Supabase 404.
**Risk:** High — timekeeping feature broken in affected environments.

## Technical Debt

### Unused `resend` package
**File:** `tribeX-hris-auth-api/package.json:43`
**Detail:** `"resend": "^6.9.3"` is in `dependencies` but the codebase uses Brevo via raw `fetch`. Documented in `RULES_AND_GUIDELINES.md` as "Cleanup TODO". Safe to remove.

### Dev-mode `console.log` blocks in production code
**Files:**
- `tribeX-hris-auth-api/src/auth/auth.service.ts:75-79` — DEV MODE invite link dump
- `tribeX-hris-auth-api/src/users/users.service.ts:1053-1058` — `[create] email error` + invite link
- `tribeX-hris-auth-api/src/users/users.service.ts:1351-1356` — `[resendInvite]` invite link
These blocks log invite/reset links and email errors to stdout in all environments. In production, links exposed in logs = security concern. Should be Logger-gated or removed.

### `console.error` without propagation
**Files:** `tribeX-hris-auth-api/src/jobs/jobs.service.ts:1349,1576,1587`, `frontend/src/components/` many locations
Errors swallowed at `console.error()` — no user feedback, no re-throw. Frontend uses `console.error(err)` as catch-all in onboarding (`HROnboardingOfficerView.tsx`), notifications, modals.

### Monorepo without workspace tooling
Each sub-project has independent `node_modules`. No `npm workspaces` / `pnpm workspaces`. Shared types must be duplicated. Deps can drift between projects.

### Large services
- `tribeX-hris-auth-api/src/users/users.service.ts` — referenced at line 1351+, suggesting 1400+ line file. God object risk.
- `tribeX-hris-auth-api/src/jobs/jobs.service.ts` — referenced at line 1576+, similarly large.
- `tribeX-hris-auth-api/src/mail/mail.service.ts` — ~900+ lines with inline HTML email templates.

### SQL in `sql/` not tracked with a migration runner
SQL files in `tribeX-hris-auth-api/sql/` are committed but there's no migration runner (no Flyway, no Liquibase, no Prisma migrate). Manual apply to Supabase dashboard required. Risk of out-of-sync environments.

### Google OAuth stub
**File:** `frontend/blues-clues-hris-frontend-web/src/app/(portal)/applicant/login/page.tsx:12,119,240`
Google OAuth on applicant login is a `// TODO (Sprint 2)` — `credentialResponse.credential` not wired to `googleLoginApi()`. Client ID not configured yet.

### SFIA integration stub
**Files:** `frontend/.../applicant/profile/page.tsx:423-428`, `frontend/.../SfiaGradeCard.tsx:20`
SFIA grade/match percentage hardcoded to `null`. Backend SFIA engine not yet live.

## Security Concerns

### Dev-mode invite links in logs
See Technical Debt — invite/reset links logged to stdout via `console.log` in `auth.service.ts` and `users.service.ts`. In a Railway deployment with log aggregation, these links would be accessible to anyone with log access.

### Brevo API key in env
Low risk if `.env` is gitignored (it is). But the `mail.service.ts` warns at startup if key is absent — check that warning doesn't leak config details in prod logs.

### `time_logs` missing may skip auth/RLS checks
If timekeeping queries fail silently, affected code paths may return empty 200s that look like success — masking authorization failures.

### `CORS_ORIGINS` defaults to localhost only
If `CORS_ORIGINS` env is not set in production, defaults to `http://localhost:3000` — would block all prod frontend requests. Must be explicitly configured on Railway.

## Performance Concerns

### No pagination observed in some list endpoints
Large datasets (users, applicants, jobs) may return all rows if pagination is not enforced. Supabase client `.from()...` without `.range()` returns up to 1000 rows by default.

### Resume parsing in-memory
`pdf-parse` and `mammoth` load entire file into memory. Large resume uploads (>15 MB body limit set) could spike memory on Railway's single container.

### Frontend timekeeping page size
`frontend/src/app/(dashboard)/hr/timekeeping/page.tsx` referenced at line 1949 — likely 2000+ line component. Large single-file components hurt code splitting.

## Fragile Areas

| Area | Why Fragile |
|------|------------|
| `mail.service.ts` + Brevo | Silent failures, no retry, sender must be Brevo-verified |
| `time_logs` Supabase table | Missing in some environments — no existence check before query |
| Auth token refresh | Memory-only access token + HTTP-only cookie — any issue breaks all sessions |
| Supabase RLS policies | Not version-controlled; mismatch between envs causes invisible data gaps |
| Onboarding module | 4 controllers + 1 service — complex role-dependent flow, hard to test |

## Missing Features / Gaps

- Google OAuth for applicant portal (stubbed)
- SFIA skill matching engine (backend not live, frontend shows nulls)
- `time_logs` table in Supabase (schema missing)
- Mobile app has no test suite

## Deprecated / Outdated

- `resend` npm package in `package.json` — replaced by direct Brevo fetch, safe to remove

## Recommendations

1. **Fix email error propagation** — `mail.service.ts` throws correctly now, but call sites in applicant flows need to surface errors to the user.
2. **Create `time_logs` table** — run `sql/` migration on all Supabase envs.
3. **Remove `resend` package** — `npm uninstall resend` in `tribeX-hris-auth-api`.
4. **Replace dev `console.log` with NestJS `Logger`** — gate behind `NODE_ENV !== 'production'` or remove.
5. **Add real test coverage for auth flows** — stubs exist but test nothing.
6. **Version-control RLS policies** — export Supabase RLS as SQL and commit to `sql/`.
7. **Set `CORS_ORIGINS` in Railway env** — prevent accidental localhost CORS in prod.
8. **Split large service files** — `users.service.ts`, `jobs.service.ts`, `mail.service.ts` should be decomposed.
