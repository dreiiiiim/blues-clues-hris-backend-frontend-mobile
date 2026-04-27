# INTEGRATIONS.md — External Integrations
_Mapped: 2026-04-27_

## Database

**Supabase (PostgreSQL)**
- Client: `@supabase/supabase-js` ^2.97 using service-role key
- Provider: `tribeX-hris-auth-api/src/supabase/supabase.service.ts` — single shared `SupabaseClient` injected via `SupabaseModule`
- Auth config: `persistSession: false` (backend-only usage)
- All DB operations go through `supabase.getClient()` — raw query interface, no ORM
- SQL migration files: `tribeX-hris-auth-api/sql/*.sql`
- Known gap: `time_logs` table missing in Supabase (open issue)

## Authentication

**JWT (Passport.js)**
- `@nestjs/jwt` + `passport-jwt` — stateless JWT tokens
- Cookies: HTTP-only via `cookie-parser`
- Auth flow: `tribeX-hris-auth-api/src/auth/`
- Global throttle: 10 requests per 60s (`@nestjs/throttler`)

**Google OAuth (Frontend)**
- `@react-oauth/google` on the frontend web app
- Google Sign-In button on auth pages

## Email / Notifications

**Brevo (formerly Sendinblue)**
- Config keys: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`
- Service: `tribeX-hris-auth-api/src/mail/mail.service.ts`
- Transactional emails: verification, password reset, onboarding notifications
- HTML email templates embedded inline in `mail.service.ts` with brand tokens
- Note: `resend` package is listed in `package.json` but actual implementation uses Brevo API — may be a partial migration
- Known issue: SMTP failure silently swallowed on applicant verification email

## Storage

- Supabase Storage (implied by service-role key usage; no dedicated storage service found in code)
- File parsing in-memory: DOCX via `mammoth`, PDF via `pdf-parse`, Word via `word-extractor` — used in applicant/resume processing

## Third-Party APIs

| Service | Package | Usage |
|---------|---------|-------|
| Supabase | `@supabase/supabase-js` | DB + (implied) Storage |
| Brevo | HTTP (via Brevo SDK or fetch) | Transactional email |
| Google OAuth | `@react-oauth/google` | Frontend sign-in |

## Scheduled Jobs

- `@nestjs/schedule` — cron jobs registered in `tribeX-hris-auth-api/src/jobs/jobs.service.ts`
- Used for: automated notifications, status updates (e.g. timekeeping, leave)

## API Surface

- Base URL pattern: `http://localhost:5000/api/tribeX/auth/v1/`
- Frontend calls via `API_BASE_URL` env var (`src/lib/api.ts`)
- Swagger docs available at `/api/tribeX/auth` when running locally
- CORS: configurable via `CORS_ORIGINS` env var (comma-separated)

## Mobile API

- Mobile app (`blues-clues-hris-mobile/src/services/`) calls same REST API
- Local storage: `@react-native-async-storage/async-storage` for token/session persistence
