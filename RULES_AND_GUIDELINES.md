# BluesClues HRIS — Rules & Guidelines

Team reference for tech stack, infrastructure, conventions, and workflow.
Last updated: 2026-04-27.

> **TL;DR for the AWS question:** We do **not** need AWS. Database, auth backbone, file storage, and realtime all run on **Supabase** (managed Postgres). Backend runs on **Railway**. Email via **Resend** (with Gmail SMTP fallback). All cloud needs are covered without AWS.

---

## 1. Tech Stack (Current)

### Backend — `tribeX-hris-auth-api/`

| Layer            | Tech                                          | Version |
| ---------------- | --------------------------------------------- | ------- |
| Framework        | NestJS                                        | 11.x    |
| Language         | TypeScript                                    | 5.7     |
| Runtime          | Node.js                                       | 20+     |
| Auth             | `@nestjs/jwt` + `passport-jwt` + `bcryptjs`   | —       |
| DB Client        | `@supabase/supabase-js`                       | 2.97    |
| Email            | `resend` (primary) + Nodemailer/Gmail SMTP    | 6.9     |
| API Docs         | `@nestjs/swagger` + `swagger-ui-express`      | 11.x    |
| Validation       | `class-validator` + `class-transformer`       | —       |
| Rate Limiting    | `@nestjs/throttler`                           | 6.5     |
| Cron             | `@nestjs/schedule`                            | 6.1     |
| File Parsing     | `pdf-parse`, `mammoth` (resume parsing)       | —       |
| Testing          | Jest + Supertest                              | 30.x    |

**Modules in `src/`:** `auth`, `users`, `applicants`, `jobs`, `onboarding`, `timekeeping`, `notifications`, `mail`, `audit`, `supabase`.

### Frontend — `frontend/blues-clues-hris-frontend-web/`

| Layer       | Tech                                       | Version |
| ----------- | ------------------------------------------ | ------- |
| Framework   | Next.js (App Router)                       | 16.1    |
| UI Lib      | React                                      | 19.2    |
| Styling     | Tailwind CSS                               | 4.x     |
| Components  | shadcn/ui (Radix primitives)               | —       |
| Theme       | `next-themes` (dark mode)                  | 0.4     |
| Icons       | `lucide-react`                             | —       |
| Toasts      | `sonner`                                   | 2.0     |
| Drag & Drop | `@dnd-kit/core` + sortable                 | 6.3     |
| OAuth       | `@react-oauth/google`                      | 0.13    |
| Testing     | Jest + Testing Library                     | 30.x    |

### Mobile — `blues-clues-hris-mobile/`

| Layer        | Tech                                   | Version |
| ------------ | -------------------------------------- | ------- |
| Framework    | Expo (managed)                         | 54      |
| RN Version   | React Native                           | 0.81    |
| Styling      | NativeWind (Tailwind for RN)           | 4.2     |
| Navigation   | `@react-navigation/*` (drawer + stack) | 7.x     |
| Storage      | `@react-native-async-storage`          | 2.2     |
| Animation    | `react-native-reanimated`              | 4.1     |

### Infrastructure (No AWS)

| Service       | Used For                                       | Notes                    |
| ------------- | ---------------------------------------------- | ------------------------ |
| **Supabase**  | Postgres DB, auth tables, file storage, RLS    | Project: `xvofqboilmzlhrnkyyif` |
| **Railway**   | Backend deploy (NestJS)                        | Prod URL in README       |
| **Vercel**    | Frontend deploy (Next.js) — recommended target | —                        |
| **Resend**    | Transactional email (primary)                  | API key in backend `.env` |
| **Gmail SMTP**| Email fallback / legacy templates              | App password, not real PW |
| **Expo Go**   | Mobile dev + OTA preview                       | Same Wi-Fi for localhost |

**Why no AWS:**
Supabase = managed Postgres + Storage + Auth (replaces RDS + S3 + Cognito).
Railway = container deploy with logs/env (replaces ECS/Elastic Beanstalk).
Resend = transactional email (replaces SES).
Adding AWS means more DevOps, more bills, more surface area. Stick with current stack unless we hit a real wall.

---

## 2. Repository Layout

```
blues-clues-hris-backend-frontend-mobile/
├── tribeX-hris-auth-api/                    # NestJS API — port 5000
├── frontend/blues-clues-hris-frontend-web/  # Next.js web — port 3000
└── blues-clues-hris-mobile/                 # Expo RN app
```

Monorepo, but each project has own `package.json` + `node_modules`. No workspace tooling (npm/pnpm/yarn workspaces). Install deps per-project.

---

## 3. Environment Setup (Quick)

Full env values + walkthrough in main `README.md`. Summary:

1. `git clone` + `git pull origin main`
2. Create `.env` files for backend, frontend, mobile (values in README §2)
3. Run **3 terminals**: backend (`npm run start:dev`), frontend (`npm run dev`), mobile (`npx expo start -c`)
4. Default = `main` branch points frontend/mobile at **Railway** prod backend. Switch to localhost only if touching backend code.

---

## 4. Branching Rules

```
feature/<ticket>-<short-description>  →  main
```

- Never push to `main` directly. Protected.
- One task per branch. Short-lived.
- Rebase on `origin/main` regularly: `git fetch origin && git rebase origin/main`
- Lowercase, hyphens only.

**Examples:**
```
feature/t3-142-user-profile-header
feature/email-mobile-dark-mode
fix/sfia-category-substring-match
```

---

## 5. Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/).

| Prefix      | Use for                                      |
| ----------- | -------------------------------------------- |
| `feat:`     | New feature                                  |
| `fix:`      | Bug fix                                      |
| `refactor:` | Restructure without behavior change          |
| `chore:`    | Deps, config, tooling                        |
| `test:`     | Add/update tests                             |
| `docs:`     | Docs only                                    |
| `ux:`       | UX/UI polish (project-specific, used in repo)|

Subject line ≤ 72 chars. Imperative mood ("add", "fix", not "added"/"fixed"). Scope optional: `feat(mail): ...`.

---

## 6. Pull Request Rules

1. PR from `feature/*` → `main`
2. **At least 1 peer approval.** No self-approve.
3. `npm run lint` must pass in every affected project.
4. PR description must include:
   - **What changed** (summary)
   - **Why** (motivation / ticket link)
   - **How to test** (manual steps)
   - **Risks / affected areas**
5. Keep PRs small. One concern per PR. If diff > ~500 lines, split.
6. Resolve all review comments before merging.
7. Squash-merge or rebase-merge — no merge commits.

---

## 7. Code Style

### General
- TypeScript strict mode everywhere. No `any` unless commented why.
- ESLint + Prettier are source of truth — run `npm run lint` before PR.
- No commented-out code in commits.
- Don't add comments that just restate what the code does.

### Backend (NestJS)
- Module-per-feature: controller, service, dto/, types.
- DTOs use `class-validator` decorators. Always validate inputs.
- Services hold business logic; controllers stay thin.
- Supabase access goes through the `supabase/` module — don't `createClient` ad hoc.
- Versioned routes: `/api/tribeX/auth/v1/...` — never break v1.
- Swagger decorators (`@ApiTags`, `@ApiOperation`) on every endpoint.

### Frontend (Next.js)
- App Router (`src/app/...`). Server components by default; `'use client'` only when needed.
- shadcn/ui components live in `src/components/ui/`. Don't edit primitives — wrap them.
- Tailwind utility-first. Use `cn()` from `lib/utils.ts` for conditional classes.
- Dark mode via `next-themes` — every new color must work in both themes.
- API calls go through `src/lib/*Api.ts` — no `fetch` scattered in components.

### Mobile (Expo)
- NativeWind classes mirror web Tailwind where possible.
- Navigation: drawer + native stack only. No bottom tabs unless agreed.
- AsyncStorage for tokens — never plaintext in state.

---

## 8. API Conventions

Base path: `/api/tribeX/auth/v{major}/{resource}`

- Always version (`/v1`, `/v2`).
- No cross-service direct DB access — go through API.
- Errors return `{ statusCode, message, error }` (Nest default).
- Use `@Throttle()` on auth + email endpoints to prevent abuse.
- Document every new endpoint in Swagger.
- Reference: `http://localhost:5000/api/docs`

---

## 9. Database Rules (Supabase)

- Schema changes via SQL files in `tribeX-hris-auth-api/sql/` — commit them.
- Don't run destructive migrations on Supabase prod without team review.
- RLS policies: keep enabled. If you disable for debugging, re-enable before commit.
- Sensitive cols (passwords, tokens) — never `select *` to client.
- `time_logs` table currently missing in some envs — verify before assuming it exists.

---

## 10. Secrets & Security

- **Never commit `.env` files.** They're gitignored.
- Don't paste real secrets in PRs, issues, or screenshots.
- Service-role Supabase key = server-only. Never ship to frontend/mobile.
- JWT secret rotation = coordinate with team; invalidates all sessions.
- Gmail uses App Password (not real password). Resend uses API key.
- Hash passwords with `bcryptjs` — never store plaintext.

---

## 11. Testing

| Project   | Command            | What runs                         |
| --------- | ------------------ | --------------------------------- |
| Backend   | `npm run test`     | Jest unit tests (`*.spec.ts`)     |
| Backend   | `npm run test:e2e` | E2E via Supertest                 |
| Backend   | `npm run test:cov` | Coverage report                   |
| Frontend  | `npm run test`     | Jest + Testing Library + jsdom    |
| Mobile    | (no tests yet)     | Manual via Expo Go                |

Add tests for: auth flows, validation logic, anything fixed twice.

---

## 12. Definition of Done

A task is done only when:

- [ ] Merged to `main` via PR with ≥1 approval
- [ ] `npm run lint` passes in all affected projects
- [ ] Manual smoke test on the feature passes
- [ ] No regressions in adjacent areas
- [ ] Docs updated (README / this file / Swagger) if behavior or config changed
- [ ] Works in both light and dark mode (frontend/mobile)
- [ ] Tested against Railway backend (not just localhost)

---

## 13. Common Gotchas

- **Mobile localhost:** phone + machine on **same Wi-Fi**, use machine's IPv4 from `ipconfig`.
- **Expo cache:** always `npx expo start -c` after `.env` change.
- **Next.js env:** restart dev server after editing `.env.local`. `NEXT_PUBLIC_*` only is exposed to browser.
- **Supabase RLS:** if a query returns empty in prod but works locally — RLS policy mismatch.
- **Email failures silent:** SMTP/Resend errors currently swallowed on applicant verification flow (open issue).
- **`time_logs` table:** missing in some Supabase envs — check before timekeeping work.

---

## 14. Test Accounts

See main `README.md` §Test Accounts. Default password (unless listed) = `password123`.

---

## 15. Where to Find Things

| Need                       | Location                                                |
| -------------------------- | ------------------------------------------------------- |
| API reference              | `http://localhost:5000/api/docs` (Swagger)              |
| Project plan / spec        | GDocs link in README                                    |
| Design system rules        | `~/.claude/skills/design-inspo-hris/skill.md` (internal)|
| SQL migrations             | `tribeX-hris-auth-api/sql/`                             |
| Email templates            | `tribeX-hris-auth-api/src/mail/`                        |
| Shared types (frontend)    | `frontend/.../src/types/`                               |
| API clients (frontend)     | `frontend/.../src/lib/*Api.ts`                          |

---

## 16. When to Ask for Help

- Touching auth, RLS, JWT, or password flows → ping team lead.
- Schema migrations on prod Supabase → review first.
- Adding a new third-party service (paid tier) → discuss in chat before signup.
- Anything affecting > 1 project (backend + frontend + mobile) → coordinate so envs stay aligned.
