# ARCHITECTURE.md — System Architecture
_Mapped: 2026-04-27_

## Architectural Pattern

**Monorepo — 3-tier client-server with shared Supabase backend**

```
┌─────────────────────────────────────────────────────────┐
│  blues-clues-hris-backend-frontend-mobile (monorepo)    │
│                                                         │
│  ┌─────────────────┐  ┌──────────────────────────────┐  │
│  │  frontend/      │  │  blues-clues-hris-mobile/    │  │
│  │  Next.js 16     │  │  Expo / React Native         │  │
│  │  App Router     │  │                              │  │
│  └────────┬────────┘  └─────────────┬────────────────┘  │
│           │  REST                   │  REST              │
│           ▼                         ▼                    │
│  ┌─────────────────────────────────────────────────┐     │
│  │        tribeX-hris-auth-api (NestJS 11)         │     │
│  │  Controller → Service → SupabaseClient          │     │
│  └──────────────────────┬──────────────────────────┘     │
│                         │                                │
│                         ▼                                │
│               ┌──────────────────┐                       │
│               │  Supabase        │                       │
│               │  (PostgreSQL)    │                       │
│               └──────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

## System Overview

- No ORM — all queries via `supabase-js` client with raw SQL-like API
- Stateless JWT auth; refresh tokens via HTTP-only cookies
- Role-based access control: `Active Employee`, `Manager`, `HR Officer`, `System Admin`, `Super Admin`, `Applicant`
- Each role maps to a separate dashboard route group in the frontend
- Mobile app mirrors web dashboard features for Employee, Manager, HR, System Admin roles

## Backend (tribeX-hris-auth-api)

### Module Structure

NestJS feature modules — each owns its own controller, service, module, and DTOs:

| Module | Responsibility |
|--------|---------------|
| `auth` | JWT login, token refresh, role guards, password management |
| `users` | Employee CRUD, profile management, role assignment |
| `timekeeping` | Attendance, time logs, schedule management, leave |
| `applicants` | Recruitment pipeline, resume parsing (PDF/DOCX) |
| `jobs` | Job posting creation, draft/publish flow, SFIA skills |
| `onboarding` | New-hire onboarding, document management, multi-role onboarding controllers |
| `notifications` | In-app notification delivery |
| `mail` | Transactional email (Brevo), branded HTML templates |
| `audit` | Audit log trail |
| `supabase` | Shared Supabase client singleton |
| `jobs` (tasks) | Cron jobs via `@nestjs/schedule` |

### Data Flow (Request Lifecycle)

```
HTTP Request
  → ThrottlerGuard (rate limit)
  → JwtAuthGuard (token validation)
  → RolesGuard (role check via @Roles decorator)
  → Controller (DTO validation via ValidationPipe)
  → Service (business logic)
  → SupabaseService.getClient() (DB operations)
  → Response
```

### Auth Strategy

- `jwt-auth.guard.ts` — standard user JWT guard
- `applicant-jwt-auth.guard.ts` — separate guard for applicant portal JWT
- `roles.guard.ts` + `roles.decorator.ts` — `@Roles('System Admin')` etc.
- Onboarding module has 4 controllers split by role (admin, hr, applicant, new-hire)

## Frontend (blues-clues-hris-frontend-web)

### Routing (Next.js App Router)

Route groups map to user roles:

```
src/app/
  (auth)/                 # login, forgot-password
  (dashboard)/
    employee/             # employee dashboard, timekeeping, profile, documents, onboarding, offboarding
    hr/                   # hr dashboard, timekeeping, jobs, candidates, approvals, onboarding
    manager/              # manager dashboard, team, timekeeping
    system-admin/         # system-admin dashboard
    admin/                # admin dashboard
    layout.tsx            # shared dashboard layout
  (portal)/
    applicant/            # applicant self-service portal
  (super-admin)/
    super-admin/          # super-admin panel
  (subscription)/         # subscription pages
  careers/                # public job listings
  set-password/           # password setup flow
```

### Authentication Flow

1. Login → JWT access token stored in memory (`authStorage.ts`)
2. Refresh token via HTTP-only cookie on page reload
3. `AuthGuard` component wraps protected pages — silent refresh → role check → redirect
4. `roleToPath` maps `role_name` from JWT to correct dashboard route

### Component Architecture

```
src/
  app/          # pages (route segments)
  components/
    ui/         # shadcn/ui primitives (Button, Input, Dialog, etc.)
    layout/     # shared layout shells, sidebars
    employees/  # EmployeeProfileSheet, etc.
    timekeeping/# Timekeeping-specific components (modals, tables, cards)
    onboarding/ # Onboarding flow components
    modals/     # Shared modal components
    approvals/  # Approval workflow UI
    admin/      # Admin-specific components
    AuthGuard.tsx         # Role-based route protection
    NotificationBell.tsx  # Notification dropdown
  lib/          # API client, auth utilities, role map
  types/        # Shared TypeScript types
  data/         # Static/mock data
```

## Mobile (blues-clues-hris-mobile)

### Architecture

- Single navigator: `src/navigation/AppNavigator.tsx`
- Screens in `src/screens/` — one file per screen
- Role-based screen access mirrors web dashboard roles
- Services in `src/services/` — REST calls to same API
- `AsyncStorage` for auth token persistence

### Screens by Role

| Role | Screens |
|------|---------|
| Employee | Dashboard, Timekeeping, Onboarding |
| Manager | Dashboard, Team, Timekeeping |
| HR Officer | Dashboard, Recruitment, Candidate Evaluation, Timekeeping, Onboarding |
| System Admin | Dashboard, Users, Audit Logs, Billing, Onboarding |
| Applicant | Dashboard, Jobs, Applications, Resume Upload |

## Cross-cutting Concerns

- **Rate limiting**: `ThrottlerModule` (10 req/60s globally)
- **Validation**: Global `ValidationPipe` with `transform: true, whitelist: true`
- **CORS**: Configurable `CORS_ORIGINS` env var
- **Versioning**: URI versioning (`/v1/`), default v1
- **Scheduling**: `ScheduleModule` for cron tasks in `jobs.service.ts`
- **Swagger**: Auto-generated API docs from decorators

## Entry Points

| Sub-project | Entry Point |
|-------------|-------------|
| Backend | `tribeX-hris-auth-api/src/main.ts` |
| Frontend | `frontend/blues-clues-hris-frontend-web/src/app/layout.tsx` |
| Mobile | `blues-clues-hris-mobile/index.js` → `App.tsx` |
