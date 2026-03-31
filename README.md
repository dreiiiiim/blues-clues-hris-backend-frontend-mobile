# BluesClues HRIS

A monorepo containing the authentication API and manager/applicant dashboard for the BluesClues HR Information System.

**Stack:** NestJS 11 · Next.js 16 · React Native (Expo) · Supabase · JWT · Tailwind CSS · shadcn/ui

---

## Repository Structure

```
blues-clues-hris-backend-frontend-mobile/
├── tribeX-hris-auth-api/                          # NestJS backend — runs on port 5000
├── frontend/blues-clues-hris-frontend-web/        # Next.js frontend — runs on port 3000
└── blues-clues-hris-mobile/                       # Expo React Native app
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- Expo Go app (for mobile)

---

### Step 1 — Clone and pull latest

```bash
git clone https://github.com/<your-org>/<your-repo>.git
cd <your-repo>
git pull origin main
```

> Always pull before starting work to avoid conflicts.

---

### Step 2 — Set up environment files

**The main branch connects to the deployed Railway backend by default.**
If you are adding features that touch the backend, switch to localhost (see [Switching Environments](#switching-environments) below).

#### Backend — create `tribeX-hris-auth-api/.env`

```env
PORT=5000
SUPABASE_URL=https://<your-project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-role-key>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
JWT_SECRET=<your-jwt-secret>
MAIL_USER=<your-gmail-address>
MAIL_PASS=<your-gmail-app-password>
APP_URL=http://localhost:3000
```

#### Frontend — create `frontend/blues-clues-hris-frontend-web/.env.local`

For local development (pointing to localhost backend):
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

#### Mobile — edit `blues-clues-hris-mobile/.env`

For local development (replace IP with your machine's Wi-Fi IPv4 from `ipconfig`):
```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:5000/api/tribeX/auth/v1
```

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

| Scenario | Use |
|---|---|
| Testing UI changes only | Production — no need to run backend locally |
| Adding/changing backend endpoints | Localhost — run the backend yourself |
| Demoing or reviewing a PR | Production |
| Testing timekeeping, auth, or any API feature | Localhost |

---

### Switching the Frontend

Edit `frontend/blues-clues-hris-frontend-web/.env.local`:

**→ Localhost:**
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

**→ Production:**
```env
NEXT_PUBLIC_API_BASE_URL=https://<your-production-backend-url>/api/tribeX/auth/v1
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

**→ Production:**
```env
EXPO_PUBLIC_API_BASE_URL=https://<your-production-backend-url>/api/tribeX/auth/v1
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

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port for the API server (default: `5000`) | No |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access) | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `JWT_SECRET` | Secret used to sign JWT tokens | Yes |
| `MAIL_USER` | Gmail address used to send system emails | Yes |
| `MAIL_PASS` | Gmail App Password (not your real password) | Yes |
| `APP_URL` | Frontend URL (used in email links) | Yes |

> **Never commit `.env` files.** They are in `.gitignore`. Full values are in Step 2 above.

---

## Test Accounts

Test accounts are available for local development and testing. Contact the project maintainer or refer to the internal team documentation for credentials.

> **Never share test account credentials in public repositories.**

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

| Prefix      | When to use                                |
| ----------- | ------------------------------------------ |
| `feat:`     | Adding new functionality                   |
| `fix:`      | Fixing a bug                               |
| `refactor:` | Restructuring code without behavior change |
| `chore:`    | Deps, config, tooling changes              |
| `test:`     | Adding or updating tests                   |

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

{ "identifier": "<your-username-or-email>", "password": "<your-password>" }
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

- Code is merged to `main` via PR with at least 1 approval
- `npm run lint` passes in affected projects
- No regressions introduced to existing functionality
- Any behavior or config changes are reflected in documentation
