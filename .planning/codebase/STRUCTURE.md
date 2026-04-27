# STRUCTURE.md — Directory Structure
_Mapped: 2026-04-27_

## Repository Root

```
blues-clues-hris-backend-frontend-mobile/
├── .claude/                          # Claude Code project config
├── .git/
├── .gitignore
├── .planning/                        # GSD planning artifacts (created 2026-04-27)
│   └── codebase/                     # Codebase map documents
├── CLAUDE.md                         # Claude Code project instructions
├── README.md                         # Project documentation
├── RULES_AND_GUIDELINES.md           # Team guidelines (19 KB)
├── frontend/
│   └── blues-clues-hris-frontend-web/  # Next.js web app
├── tribeX-hris-auth-api/             # NestJS backend
└── blues-clues-hris-mobile/          # Expo React Native app
```

## Backend Structure

`tribeX-hris-auth-api/`
```
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
├── sql/                              # Raw SQL migration files
│   └── 2026-04-27_company_default_schedule.sql
├── test/                             # E2E test config
│   └── jest-e2e.json
└── src/
    ├── main.ts                       # Bootstrap (port, CORS, Swagger, validation)
    ├── app.module.ts                 # Root module — imports all feature modules
    ├── app.controller.ts             # Health check / root endpoint
    ├── app.service.ts
    ├── app.controller.spec.ts
    ├── supabase/
    │   ├── supabase.module.ts        # Shared Supabase client provider
    │   └── supabase.service.ts
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── jwt-auth.guard.ts         # Employee/staff JWT guard
    │   ├── applicant-jwt-auth.guard.ts  # Applicant-specific JWT guard
    │   ├── roles.guard.ts
    │   ├── roles.decorator.ts
    │   ├── dto/
    │   ├── auth.controller.spec.ts
    │   └── auth.service.spec.ts
    ├── users/
    │   ├── users.module.ts
    │   ├── users.controller.ts
    │   ├── users.service.ts
    │   ├── dto/
    │   ├── users.controller.spec.ts
    │   └── users.service.spec.ts
    ├── timekeeping/
    │   ├── timekeeping.module.ts
    │   ├── timekeeping.controller.ts
    │   ├── timekeeping.service.ts
    │   ├── timekeeping.tasks.ts      # Scheduled timekeeping tasks
    │   ├── dto/
    │   │   └── company-default-schedule.dto.ts
    │   ├── timekeeping.controller.spec.ts
    │   └── timekeeping.service.spec.ts
    ├── applicants/
    │   ├── applicants.module.ts
    │   ├── applicants.controller.ts
    │   ├── applicants.service.ts
    │   └── dto/
    ├── jobs/
    │   ├── jobs.module.ts
    │   ├── jobs.controller.ts
    │   ├── jobs.service.ts
    │   └── dto/
    ├── onboarding/
    │   ├── onboarding.module.ts
    │   ├── onboarding.service.ts
    │   ├── admin-onboarding.controller.ts
    │   ├── hr-onboarding.controller.ts
    │   ├── applicant-onboarding.controller.ts
    │   ├── applicant-portal-onboarding.controller.ts
    │   ├── new-hire.controller.ts
    │   └── dto/
    ├── notifications/
    │   ├── notifications.module.ts
    │   ├── notifications.controller.ts
    │   ├── notifications.service.ts
    │   └── dto/
    ├── mail/
    │   ├── mail.module.ts
    │   ├── mail.controller.ts
    │   └── mail.service.ts           # Brand tokens + HTML templates inline
    ├── audit/
    │   ├── audit.module.ts
    │   ├── audit.controller.ts
    │   └── audit.service.ts
    ├── jobs/ (same as above)
    └── types/
        └── mammoth.d.ts
```

## Frontend Structure

`frontend/blues-clues-hris-frontend-web/`
```
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
├── tailwind.config.ts (or via PostCSS)
└── src/
    ├── app/
    │   ├── layout.tsx                # Root layout (fonts, providers, Toaster)
    │   ├── page.tsx                  # Root redirect
    │   ├── globals.css
    │   ├── favicon.ico
    │   ├── (auth)/
    │   │   ├── login/
    │   │   └── forgot-password/
    │   ├── (dashboard)/
    │   │   ├── layout.tsx            # Dashboard shell
    │   │   ├── employee/
    │   │   │   ├── page.tsx
    │   │   │   ├── timekeeping/
    │   │   │   ├── profile/
    │   │   │   ├── documents/
    │   │   │   ├── onboarding/
    │   │   │   └── offboarding/
    │   │   ├── hr/
    │   │   │   ├── page.tsx
    │   │   │   ├── timekeeping/
    │   │   │   ├── jobs/
    │   │   │   ├── candidates/
    │   │   │   ├── approvals/
    │   │   │   └── onboarding/
    │   │   ├── manager/
    │   │   │   ├── page.tsx
    │   │   │   ├── timekeeping/
    │   │   │   └── team/
    │   │   ├── system-admin/
    │   │   └── admin/
    │   ├── (portal)/applicant/
    │   ├── (super-admin)/super-admin/
    │   ├── (subscription)/
    │   ├── careers/
    │   └── set-password/
    ├── components/
    │   ├── ui/                       # shadcn/ui primitives
    │   ├── layout/                   # Sidebar, header shells
    │   ├── employees/                # EmployeeProfileSheet.tsx, etc.
    │   ├── timekeeping/              # ScheduleManagementModal, ScheduleRosterTable,
    │   │                             # CompanyDefaultScheduleCard
    │   ├── onboarding/
    │   ├── modals/
    │   ├── approvals/
    │   ├── admin/
    │   ├── providers/
    │   │   └── GoogleAuthProvider.tsx
    │   ├── AuthGuard.tsx
    │   ├── NotificationBell.tsx
    │   └── NotificationDropdown.tsx
    ├── lib/
    │   ├── api.ts                    # API_BASE_URL constant
    │   ├── authStorage.ts            # Token memory store
    │   ├── authApi.ts                # refreshApi, login calls
    │   └── roleMap.ts                # roleToPath mapping
    ├── types/                        # Shared TS types
    └── data/                         # Static data
```

## Mobile Structure

`blues-clues-hris-mobile/`
```
├── index.js                          # Expo entry point
├── App.tsx                           # App root
├── app.json                          # Expo config
├── babel.config.js
├── metro.config.js
├── tailwind.config.js
├── tsconfig.json
├── nativewind-env.d.ts
├── global.css
├── global.d.ts
└── src/
    ├── screens/                      # One file per screen (role-prefixed names)
    │   ├── LoginScreen.tsx
    │   ├── Employee*.tsx
    │   ├── HROfficer*.tsx
    │   ├── Manager*.tsx
    │   ├── SystemAdmin*.tsx
    │   └── Applicant*.tsx
    ├── navigation/
    │   └── AppNavigator.tsx          # Single root navigator
    ├── components/                   # Shared UI components
    ├── services/                     # API call functions
    ├── lib/                          # Utilities
    └── constants/                    # App-wide constants
```

## Key File Locations

| What | Where |
|------|-------|
| API base URL | `frontend/.../src/lib/api.ts` |
| Auth guard | `frontend/.../src/components/AuthGuard.tsx` |
| Role → route map | `frontend/.../src/lib/roleMap.ts` |
| Backend bootstrap | `tribeX-hris-auth-api/src/main.ts` |
| Root NestJS module | `tribeX-hris-auth-api/src/app.module.ts` |
| Supabase client | `tribeX-hris-auth-api/src/supabase/supabase.service.ts` |
| Email templates | `tribeX-hris-auth-api/src/mail/mail.service.ts` |
| SQL migrations | `tribeX-hris-auth-api/sql/` |
| Cron jobs | `tribeX-hris-auth-api/src/jobs/jobs.service.ts` |
| Mobile navigator | `blues-clues-hris-mobile/src/navigation/AppNavigator.tsx` |

## Naming Conventions

| Thing | Convention |
|-------|-----------|
| NestJS files | `<feature>.controller.ts`, `<feature>.service.ts`, `<feature>.module.ts` |
| DTO files | `<action>-<noun>.dto.ts` (e.g. `create-job.dto.ts`) |
| Spec files | `<feature>.controller.spec.ts`, `<feature>.service.spec.ts` |
| Frontend pages | `page.tsx` inside route directory |
| Frontend components | `PascalCase.tsx` |
| Mobile screens | `<Role><Feature>Screen.tsx` |
| Frontend lib files | `camelCase.ts` |
