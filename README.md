# BluesClues HRIS

Monorepo: authentication API + manager/applicant dashboard + mobile app for BluesClues HR Information System. Purely para sa devs lang to check progress ng lahat and para madali iconnect front at backend.

GDocs Link:
https://docs.google.com/document/d/1QbcjtozYNobPMb_ffn4uEWH5RwJ_TpOB4eTlkHVu4oE/edit?tab=t.0

**Stack at a glance:** NestJS 11 · Next.js 16 · React 19 · React Native (Expo 54) · Supabase · JWT · Tailwind 4 · shadcn/ui · **Brevo** (email)

> **Do we need AWS?** **No.** Supabase covers DB + storage + auth. Railway hosts backend. **Brevo** handles transactional email via REST (`POST /v3/smtp/email`). See [Infrastructure](#infrastructure) for full breakdown.

For deeper rules (code style per project, DB rules, secrets policy, gotchas), see **[RULES_AND_GUIDELINES.md](./RULES_AND_GUIDELINES.md)**.

Last updated: 2026-04-27.

---

## Repository Structure

```
blues-clues-hris-backend-frontend-mobile/
├── tribeX-hris-auth-api/                          # NestJS backend — runs on port 5000
├── frontend/blues-clues-hris-frontend-web/        # Next.js frontend — runs on port 3000
└── blues-clues-hris-mobile/                       # Expo React Native app
```

Each project has own `package.json` + `node_modules`. No workspace tooling — install deps per-project.

---

## Tech Stack (Detailed)

### Backend — `tribeX-hris-auth-api/`

| Layer         | Tech                                        | Version |
| ------------- | ------------------------------------------- | ------- |
| Framework     | NestJS                                      | 11.x    |
| Language      | TypeScript                                  | 5.7     |
| Runtime       | Node.js                                     | 20+     |
| Auth          | `@nestjs/jwt` + `passport-jwt` + `bcryptjs` | —       |
| DB Client     | `@supabase/supabase-js`                     | 2.97    |
| Email         | **Brevo** REST API via `fetch` → `POST https://api.brevo.com/v3/smtp/email` | v3 |
| File Upload   | `multer` (`@types/multer`) — resume uploads | —       |
| API Docs      | `@nestjs/swagger` + `swagger-ui-express`    | 11.x    |
| Validation    | `class-validator` + `class-transformer`     | —       |
| Rate Limiting | `@nestjs/throttler`                         | 6.5     |
| Cron          | `@nestjs/schedule`                          | 6.1     |
| File Parsing  | `pdf-parse`, `mammoth` (resume parsing)     | —       |
| Testing       | Jest + Supertest                            | 30.x    |

**Modules:** `auth`, `users`, `applicants`, `jobs`, `onboarding`, `timekeeping`, `notifications`, `mail`, `audit`, `supabase`.

### Frontend — `frontend/blues-clues-hris-frontend-web/`

| Layer       | Tech                         | Version |
| ----------- | ---------------------------- | ------- |
| Framework   | Next.js (App Router)         | 16.1    |
| UI Lib      | React                        | 19.2    |
| Styling     | Tailwind CSS                 | 4.x     |
| Components  | shadcn/ui (Radix primitives) | —       |
| Theme       | `next-themes` (dark mode)    | 0.4     |
| Icons       | `lucide-react`               | —       |
| Toasts      | `sonner`                     | 2.0     |
| Drag & Drop | `@dnd-kit/core` + sortable   | 6.3     |
| OAuth       | `@react-oauth/google`        | 0.13    |
| Testing     | Jest + Testing Library       | 30.x    |

### Mobile — `blues-clues-hris-mobile/`

| Layer      | Tech                                   | Version |
| ---------- | -------------------------------------- | ------- |
| Framework  | Expo (managed)                         | 54      |
| RN Version | React Native                           | 0.81    |
| Styling    | NativeWind (Tailwind for RN)           | 4.2     |
| Navigation | `@react-navigation/*` (drawer + stack) | 7.x     |
| Storage    | `@react-native-async-storage`          | 2.2     |
| Animation  | `react-native-reanimated`              | 4.1     |

---

## Infrastructure

| Service      | Used For                                    | Notes                                                 |
| ------------ | ------------------------------------------- | ----------------------------------------------------- |
| **Supabase** | Postgres DB, auth tables, file storage, RLS | Project ref `xvofqboilmzlhrnkyyif`                    |
| **Railway**  | Backend deploy (NestJS)                     | Prod URL below                                        |
| **Vercel**   | Frontend deploy (Next.js) — recommended     | —                                                     |
| **Brevo**    | Transactional email                         | Sends via `POST https://api.brevo.com/v3/smtp/email`. Auth header `api-key: <BREVO_API_KEY>`. Verified sender required. |
| **Expo Go**  | Mobile dev + OTA preview                    | Same Wi-Fi for localhost                              |

**Why no AWS:**
- Supabase = managed Postgres + Storage + Auth (replaces RDS + S3 + Cognito)
- Railway = container deploy with logs/env (replaces ECS / Elastic Beanstalk)
- Brevo = transactional email (replaces SES)

> Note: `resend` package is still in `package.json` but **unused** — Brevo is called via plain `fetch` in `src/mail/mail.service.ts`. Safe to remove on next cleanup PR.

Adding AWS = more DevOps work + more bills + more surface area. Stick with current stack unless we hit a real wall (e.g., scale limits or a feature only AWS provides).

**Prod URLs:**
- Backend: `https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app`
- Swagger (local): `http://localhost:5000/api/docs`

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Expo Go app (for mobile)

---

### Step 1 — Clone and pull latest

```bash
git clone https://github.com/dreiiiiim/blues-clues-hris-backend-frontend-mobile.git
cd blues-clues-hris-backend-frontend-mobile
git pull origin main
```

> Always pull before starting work to avoid conflicts.

---

### Step 2 — Set up environment files

**Never paste real `.env` values into this README or any committed file.**
Real keys are shared privately through the team chat/password manager only. Keep local secrets in `.env` / `.env.local`, which are ignored by Git.

**The main branch can point to the deployed Railway backend by default.**
If you are adding features that touch the backend, switch the frontend/mobile API URL to localhost (see [Switching Environments](#switching-environments) below).

#### Backend — create `tribeX-hris-auth-api/.env`

```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_ANON_KEY=your-anon-key
JWT_SECRET=replace-with-a-long-random-secret-at-least-32-characters

# Brevo (transactional email) — get API key from https://app.brevo.com/settings/keys/api
BREVO_API_KEY=your-brevo-api-key
BREVO_BASE_URL=https://api.brevo.com
BREVO_SENDER_EMAIL=your-verified-sender@example.com
BREVO_SENDER_NAME=Blues Clues HRIS
BREVO_TIMEOUT_MS=15000

APP_URL=http://localhost:3000
```

Backend notes:
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never put it in frontend/mobile env files.
- `JWT_SECRET` must be at least 32 characters.
- `BREVO_SENDER_EMAIL` must be verified in Brevo or email sends will fail.
- If you are only testing UI against Railway, you do not need to run the backend locally.

#### Frontend — create `frontend/blues-clues-hris-frontend-web/.env.local`

For local development (pointing to localhost backend):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For local development against the deployed Railway backend:

```env
NEXT_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Frontend notes:
- Only variables starting with `NEXT_PUBLIC_` are exposed to the browser.
- Restart `npm run dev` after changing `.env.local`.

#### Mobile — edit `blues-clues-hris-mobile/.env`

You can copy the template first:

```bash
cd blues-clues-hris-mobile
cp .env.example .env
```

For local development (replace IP with your machine's Wi-Fi IPv4 from `ipconfig`):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000/api/tribeX/auth/v1
```

For local development against the deployed Railway backend:

```env
EXPO_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
```

Mobile notes:
- Do not use `localhost` on a physical phone. Use your PC's Wi-Fi IPv4 address.
- Restart Expo with `npx expo start -c` after changing `.env`.
- Your phone and development machine must be on the same Wi-Fi network for local backend testing.

---

### Step 3 — Install dependencies and run

Open **three separate terminals**:

**Terminal 1 — Backend:**

```bash
cd tribeX-hris-auth-api
npm install
npm run start:dev
# API at http://localhost:5000
# Swagger docs at http://localhost:5000/api/docs
```

**Terminal 2 — Frontend:**

```bash
cd frontend/blues-clues-hris-frontend-web
npm install
npm run dev
# App at http://localhost:3000
```

**Terminal 3 — Mobile:**

```bash
cd blues-clues-hris-mobile
npm install
npx expo start -c
# Scan the QR code with the Expo Go app on your phone
# Your phone must be on the same Wi-Fi network as your machine
```

---

## Switching Environments

The project has two environments: **localhost** (local dev) and **Railway** (deployed production).

### When to use which

| Scenario                                      | Use                                      |
| --------------------------------------------- | ---------------------------------------- |
| Testing UI changes only                       | Railway — no need to run backend locally |
| Adding/changing backend endpoints             | Localhost — run the backend yourself     |
| Demoing or reviewing a PR                     | Railway                                  |
| Testing timekeeping, auth, or any API feature | Localhost                                |

---

### Switching the Frontend

Edit `frontend/blues-clues-hris-frontend-web/.env.local`:

**→ Localhost:**

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

**→ Railway:**

```env
NEXT_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
```

Then restart the dev server: `npm run dev`

> If `.env.local` does not exist, the frontend falls back to `localhost:5000` automatically.

---

### Switching the Mobile App

Edit `blues-clues-hris-mobile/.env`:

**→ Localhost** (find your Wi-Fi IPv4 with `ipconfig` → look for IPv4 Address under Wi-Fi):

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000/api/tribeX/auth/v1
```

**→ Railway:**

```env
EXPO_PUBLIC_API_BASE_URL=https://blues-clues-hris-backend-frontend-mobile-production.up.railway.app/api/tribeX/auth/v1
```

After editing `.env`, always restart with cache cleared:

```bash
npx expo start -c
```

> Your phone and your machine must be on the **same Wi-Fi network** for localhost to work.

---

---

## Environment Variables Reference

### Backend — `tribeX-hris-auth-api/.env`

| Variable                    | Description                                                     | Required |
| --------------------------- | --------------------------------------------------------------- | -------- |
| `PORT`                      | API server port (default: `5000`)                               | No       |
| `SUPABASE_URL`              | Supabase project URL                                            | Yes      |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access — server only)          | Yes      |
| `SUPABASE_ANON_KEY`         | Supabase anon/public key                                        | Yes      |
| `JWT_SECRET`                | Secret used to sign JWT access tokens                           | Yes      |
| `BREVO_API_KEY`             | Brevo API key (`api-key` header on `POST /v3/smtp/email`)       | Yes      |
| `BREVO_BASE_URL`            | Brevo API base URL — default `https://api.brevo.com`            | No       |
| `BREVO_SENDER_EMAIL`        | Verified sender email registered in Brevo                       | Yes      |
| `BREVO_SENDER_NAME`         | Display name on outgoing emails (default: `Blues Clues HRIS`)   | No       |
| `BREVO_TIMEOUT_MS`          | Fetch timeout for Brevo API call (default: `15000`)             | No       |
| `APP_URL`                   | Frontend URL (used in email links — verification, reset, etc.)  | Yes      |

> **Never commit `.env` files or real secret values.** They are in `.gitignore`. Use placeholders in committed docs and get real values from the private team setup document.
> Brevo sender email **must be verified** in your Brevo dashboard or sends will 401/403.

### Frontend web — `frontend/blues-clues-hris-frontend-web/.env.local`

| Variable                   | Description                                                | Required |
| -------------------------- | ---------------------------------------------------------- | -------- |
| `NEXT_PUBLIC_API_BASE_URL` | Backend API base URL used by the browser                   | Yes      |
| `NEXT_PUBLIC_APP_URL`      | Local/public frontend URL used by frontend-generated links | No       |

### Mobile — `blues-clues-hris-mobile/.env`

| Variable                   | Description                                                           | Required |
| -------------------------- | --------------------------------------------------------------------- | -------- |
| `EXPO_PUBLIC_API_BASE_URL` | Backend API base URL bundled into the Expo app. Use PC IPv4 for local | Yes      |

---

## Test Accounts

Use these accounts for local development and testing. Passwords and live credentials are kept in the private team setup document, not in this public README.

### Company 3

| Role                                   | Identifier                        | Password source   | Notes                         |
| -------------------------------------- | --------------------------------- | ----------------- | ----------------------------- |
| System Admin (timekeeping/recruitment) | `afdmandrei.systemadmin`          | Private setup doc | Full admin access - COMPANY 3 |
| Applicant                              | `montanielandrei@gmail.com`       | Private setup doc | COMPANY 3                     |
| Applicant                              | `andreimontanielcoding@gmail.com` | Private setup doc | Applicant portal COMPANY 3    |
| Manager                                | `cheenamarilenejaring@gmail.com`  | Private setup doc | Team management               |
| HR Officer                             | `rickgrimes`                      | Private setup doc | HR portal                     |
| Employee                               | `ludovicastorti`                  | Private setup doc | Employee                      |

### Company 2

| Role       | Identifier                | Password source   | Notes            |
| ---------- | ------------------------- | ----------------- | ---------------- |
| HR Officer | `chiarraalteri@gmail.com` | Private setup doc | COMP 2 HR portal |

> Do not commit real test account passwords. Share them only in the private setup document or password manager.

---

## Branch Strategy

```
feature/<ticket>-<short-description>  →  main
```

- **Never commit directly to `main`**
- Create a short-lived feature branch for every task
- Keep branch names lowercase with hyphens

```bash
# Start a new feature
git checkout main
git pull origin main
git checkout -b feature/t3-142-user-profile-header

# Sync with main while working (do this regularly)
git fetch origin
git rebase origin/main
```

---

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix      | When to use                                       |
| ----------- | ------------------------------------------------- |
| `feat:`     | New functionality                                 |
| `fix:`      | Bug fix                                           |
| `refactor:` | Restructuring code without behavior change        |
| `chore:`    | Deps, config, tooling changes                     |
| `test:`     | Adding or updating tests                          |
| `docs:`     | Documentation only                                |
| `ux:`       | UX/UI polish (used in repo, e.g. `ux(sfia): ...`) |

Subject ≤ 72 chars. Imperative mood ("add", not "added"). Scope optional: `feat(mail): ...`.

**Examples from this repo:**

```
feat: make all role dashboards accessible
fix: logout flow — call logoutApi from Sidebar
chore: remove .claude folder from tracking
```

---

## Pull Request Requirements

1. Open a PR from your `feature/*` branch to `main`
2. **At least 1 peer review approval** — self-approval is not allowed
3. `npm run lint` must pass in both projects before requesting review
4. Write a clear PR description:
   - What changed and why
   - How to test it manually
   - Any affected areas or risks
5. Keep PRs small and focused — one task per PR

---

## Available Commands

### Backend (`tribeX-hris-auth-api/`)

| Command              | What it does                    |
| -------------------- | ------------------------------- |
| `npm run start:dev`  | Dev server with hot reload      |
| `npm run start:prod` | Production server               |
| `npm run build`      | Compile TypeScript to `dist/`   |
| `npm run lint`       | Lint and auto-fix               |
| `npm run test`       | Run unit tests                  |
| `npm run test:cov`   | Unit tests with coverage report |
| `npm run test:e2e`   | End-to-end tests                |

### Frontend (`frontend/blues-clues-hris-frontend-web/`)

| Command         | What it does               |
| --------------- | -------------------------- |
| `npm run dev`   | Dev server with hot reload |
| `npm run build` | Production build           |
| `npm run start` | Serve the production build |
| `npm run lint`  | Lint check                 |

### Mobile (`blues-clues-hris-mobile/`)

| Command             | What it does                         |
| ------------------- | ------------------------------------ |
| `npx expo start`    | Start Expo dev server                |
| `npx expo start -c` | Start with cleared cache (use this!) |

---

## API Conventions

All API routes follow this structure (already configured in `main.ts`):

```
/api/tribeX/auth/v{major}/{resource}
```

Current base: `http://localhost:5000/api/tribeX/auth/v1/`

**Rules:**

- Always version your endpoints (`/v1`, `/v2`) — never break existing consumers
- No direct database access across services — all integration must go through the API
- All endpoints are documented via Swagger at `/api/docs`

---

## Testing the API Manually (Postman / curl)

**Login:**

```
POST http://localhost:5000/api/tribeX/auth/v1/login
Content-Type: application/json

{ "identifier": "afdmandrei.systemadmin", "password": "<password-from-private-setup-doc>" }
```

**Authenticated request:**

```
GET http://localhost:5000/api/tribeX/auth/v1/users
Authorization: Bearer <access_token>
```

Full API reference: `http://localhost:5000/api/docs`

---

## Definition of Done

A task is considered done only when:

- Code merged to `main` via PR with ≥1 approval
- `npm run lint` passes in all affected projects
- Manual smoke test on the feature passes
- No regressions in adjacent areas
- Docs updated (README / `RULES_AND_GUIDELINES.md` / Swagger) if behavior or config changed
- Works in **both light and dark mode** (frontend/mobile)
- Tested against Railway backend, not just localhost

---

## Common Gotchas

- **Mobile localhost:** phone + machine on **same Wi-Fi**. Use machine's IPv4 from `ipconfig` (look under Wi-Fi adapter).
- **Expo cache:** always `npx expo start -c` after `.env` change. Stale cache causes silent failures.
- **Next.js env:** restart dev server after editing `.env.local`. Only `NEXT_PUBLIC_*` vars reach the browser.
- **Supabase RLS:** if a query returns empty in prod but works locally → RLS policy mismatch. Check policies first, not the query.
- **Email failures silent:** Brevo HTTP errors (non-2xx, timeouts) swallowed in applicant verification flow. `mail.service.ts → sendMail()` only logs, doesn't propagate. Open issue.
- **`time_logs` table:** missing in some Supabase envs. Verify before timekeeping work.
- **Service-role key:** server-only. Never bundle into frontend or mobile.

---

## Where to Find Things

| Need                    | Location                                            |
| ----------------------- | --------------------------------------------------- |
| API reference           | `http://localhost:5000/api/docs` (Swagger)          |
| Project plan / spec     | GDocs link at top                                   |
| Deeper dev rules        | [`RULES_AND_GUIDELINES.md`](./RULES_AND_GUIDELINES.md) |
| SQL migrations          | `tribeX-hris-auth-api/sql/`                         |
| Email templates         | `tribeX-hris-auth-api/src/mail/`                    |
| Shared types (frontend) | `frontend/.../src/types/`                           |
| API clients (frontend)  | `frontend/.../src/lib/*Api.ts`                      |
