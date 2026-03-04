# BluesClues HRIS

A monorepo containing the authentication API and manager/applicant dashboard for the BluesClues HR Information System.

**Stack:** NestJS 11 · Next.js 16 · Supabase · JWT · Tailwind CSS · shadcn/ui

---

## Repository Structure

```
supabase-auth-to-JWT-bluetribe/
├── tribeX-hris-auth-api/        # NestJS backend — runs on port 5000
└── frontend/manager-dashboard/  # Next.js frontend — runs on port 3000
```

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### 1. Clone the repo

```bash
git clone https://github.com/dreiiiiim/hris-bluesclues-backend-frontend.git
cd blues-clues-hris-backend-frontend-mobile
```

### 2. Set up the backend

```bash
cd tribeX-hris-auth-api
npm install
cp .env.example .env   # then fill in your values (see Environment Variables below)
npm run start:dev
```

API runs at `http://localhost:5000`
Swagger docs at `http://localhost:5000/api/docs`

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
cd blues-clues-hris-frontend-web
npm install
npm run dev
```

App runs at `http://localhost:3000`

---

## Environment Variables

Create `tribeX-hris-auth-api/.env` based on `.env.example`:

| Variable | Description | Required |
|---|---|---|
| `PORT` | Port for the API server (default: `5000`) | No |
| `SUPABASE_URL` | Your Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (admin access) | Yes |
| `SUPABASE_ANON_KEY` | Supabase anon/public key | Yes |
| `JWT_SECRET` | Secret used to sign JWT tokens | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins (production only) | Production |

> **Never commit `.env` files.** They are in `.gitignore`. Ask a team member for the values.

---

## Branch Strategy

```
feature/<ticket>-<short-description>  →  master
```

- **Never commit directly to `master`**
- Create a short-lived feature branch for every task
- Keep branch names lowercase with hyphens

```bash
# Start a new feature
git checkout master
git pull origin master
git checkout -b feature/t3-142-user-profile-header

# Sync with master while working (do this regularly)
git fetch origin
git rebase origin/master
```

---

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | When to use |
|---|---|
| `feat:` | Adding new functionality |
| `fix:` | Fixing a bug |
| `refactor:` | Restructuring code without behavior change |
| `chore:` | Deps, config, tooling changes |
| `test:` | Adding or updating tests |

**Examples from this repo:**
```
feat: make all role dashboards accessible
fix: logout flow — call logoutApi from Sidebar
chore: remove .claude folder from tracking
```

---

## Pull Request Requirements

1. Open a PR from your `feature/*` branch to `master`
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

| Command | What it does |
|---|---|
| `npm run start:dev` | Dev server with hot reload |
| `npm run start:prod` | Production server |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run lint` | Lint and auto-fix |
| `npm run test` | Run unit tests |
| `npm run test:cov` | Unit tests with coverage report |
| `npm run test:e2e` | End-to-end tests |

### Frontend (`frontend/manager-dashboard/`)

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Lint check |

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

## Test Accounts

Use these accounts for local development and testing (Supabase seed data):

| Role | Email |
|---|---|
| System Admin | `johndoedoe@gmail.com` |
| Admin | `rickgrimes@gmail.com` |
| HR Manager | `chiarraalteri@gmail.com` |
| Employee | `ludovicastorti@gmail.com` |

> Passwords are shared separately — ask your team lead.

---

## Definition of Done

A task is considered done only when:

- Code is merged to `master` via PR with at least 1 approval
- `npm run lint` passes in affected projects
- No regressions introduced to existing functionality
- Any behavior or config changes are reflected in documentation

---

## Testing the API Manually (Postman / curl)

**Login:**
```
POST http://localhost:5000/api/tribeX/auth/v1/login
Content-Type: application/json

{ "identifier": "johndoedoe@gmail.com", "password": "<password>" }
```

**Authenticated request:**
```
GET http://localhost:5000/api/tribeX/auth/v1/users
Authorization: Bearer <access_token>
```

Full API reference: `http://localhost:5000/api/docs`
