# STACK.md — Technology Stack
_Mapped: 2026-04-27_

## Languages

- **TypeScript** — primary language across all three sub-projects (strict mode)
- **JavaScript** — Expo/React Native config files (`babel.config.js`, `metro.config.js`)

## Runtime & Platform

| Sub-project | Runtime | Version |
|-------------|---------|---------|
| Backend API (`tribeX-hris-auth-api`) | Node.js | ≥18 (NestJS 11 requirement) |
| Frontend Web (`blues-clues-hris-frontend-web`) | Node.js / browser | Next.js 16 |
| Mobile (`blues-clues-hris-mobile`) | React Native via Expo | Expo SDK 54, RN 0.81.5 |

## Frameworks

### Backend — NestJS 11
- `@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express` — core framework
- `@nestjs/config` — environment config (`ConfigModule.forRoot({ isGlobal: true })`)
- `@nestjs/jwt` + `passport` + `passport-jwt` — JWT auth
- `@nestjs/swagger` + `swagger-ui-express` — API docs at `/api/tribeX/auth/v1`
- `@nestjs/throttler` — rate limiting (10 req / 60s)
- `@nestjs/schedule` — cron jobs

### Frontend — Next.js 16 (App Router)
- React 19.2 with React DOM
- Tailwind CSS v4 (`@tailwindcss/postcss`)
- shadcn/ui (Radix UI primitives): `@radix-ui/react-alert-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-slot`
- `next-themes` — dark mode
- `@dnd-kit/core`, `@dnd-kit/sortable` — drag-and-drop
- `@react-oauth/google` — Google OAuth
- `lucide-react` — icons
- `sonner` — toast notifications
- `class-variance-authority`, `clsx`, `tailwind-merge` — class utilities

### Mobile — React Native (Expo ~54)
- `expo`, `expo-status-bar`, `expo-linear-gradient`
- `react-native` 0.81.5
- `nativewind` v4 — Tailwind CSS for React Native
- `@react-navigation/native`, `@react-navigation/native-stack`, `@react-navigation/drawer`
- `react-native-reanimated`, `react-native-gesture-handler`, `react-native-screens`
- `@react-native-async-storage/async-storage` — local storage
- `react-native-worklets` — worklet-based animations

## Key Backend Dependencies

| Package | Purpose |
|---------|---------|
| `@supabase/supabase-js` ^2.97 | Database client (service-role key) |
| `bcryptjs` ^3 | Password hashing |
| `resend` ^6.9 | Transactional email (Brevo API used via config; file also references Brevo keys — likely migration in progress) |
| `mammoth` ^1.12 | DOCX parsing |
| `pdf-parse` ^2.4 | PDF parsing |
| `word-extractor` ^1 | Word doc extraction |
| `cookie-parser` ^1.4 | HTTP-only cookie support |
| `class-validator` + `class-transformer` | DTO validation |

## Build & Dev Tooling

### Backend
- `@nestjs/cli` — `nest build` (webpack), `nest start --watch`
- `ts-jest` — Jest test transform
- `prettier` + `eslint-plugin-prettier` — code formatting
- `typescript-eslint` — lint

### Frontend
- `next build` / `next dev`
- `jest` ^30 + `jest-environment-jsdom` + `@testing-library/react` — unit tests
- `eslint-config-next` — lint
- `shadcn` CLI ^3.8 — component scaffolding

### Mobile
- `expo start` — development server
- TypeScript ~5.9

## Configuration

### Backend env vars (`.env.example`)
```
PORT=5000
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
JWT_SECRET=
BREVO_API_KEY=              # transactional email
BREVO_SENDER_EMAIL=
CORS_ORIGINS=http://localhost:3000
APP_URL=http://localhost:3000
```

### Frontend env vars
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1
```

### Backend global prefix
All API routes: `api/tribeX/auth/v1/...` (URI versioning, default v1)
