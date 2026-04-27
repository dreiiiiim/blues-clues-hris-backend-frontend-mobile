# TESTING.md — Testing Practices
_Mapped: 2026-04-27_

## Test Framework

| Sub-project | Framework | Version |
|-------------|-----------|---------|
| Backend | Jest + `ts-jest` + Supertest | Jest 30 |
| Frontend | Jest + `@testing-library/react` + `jest-environment-jsdom` | Jest 30 |
| Mobile | None (manual via Expo Go) | — |

## Test Structure

### Backend
- Test files co-located with source: `<feature>.service.spec.ts`, `<feature>.controller.spec.ts`
- Pattern: `.*\.spec\.ts$` (configured in `package.json` jest config)
- Root dir: `src/` — Jest crawls from there
- E2E tests in `test/` with separate `jest-e2e.json` config

### Frontend
- Test files presumably co-located or in `__tests__/` directories (jsdom env)
- `@testing-library/react` for component rendering + interaction

## What's Tested (Backend — Current State)

Observed spec files:
- `auth/auth.service.spec.ts` — AuthService unit test (stub only: `should be defined`)
- `auth/auth.controller.spec.ts` — AuthController unit test
- `timekeeping/timekeeping.service.spec.ts` — TimekeepingService
- `timekeeping/timekeeping.controller.spec.ts` — TimekeepingController
- `users/users.service.spec.ts` — UsersService
- `users/users.controller.spec.ts` — UsersController
- `app.controller.spec.ts` — root app controller

> **Note:** Most specs are boilerplate stubs (`should be defined`). Actual test coverage is low. `RULES_AND_GUIDELINES.md` says: "Add tests for auth flows, validation logic, anything fixed twice."

## Mocking Approach

Backend uses NestJS `TestingModule`:
```typescript
const module: TestingModule = await Test.createTestingModule({
  providers: [AuthService],
}).compile();
service = module.get<AuthService>(AuthService);
```
Dependencies (SupabaseService, JwtService, etc.) need to be mocked as providers in the module. Current stubs don't inject mocks — tests are skeleton-only.

Frontend uses `@testing-library/react` with jsdom environment. No observed mock setup files.

## Running Tests

```bash
# Backend
cd tribeX-hris-auth-api
npm run test          # unit tests
npm run test:watch    # watch mode
npm run test:cov      # with coverage report → /coverage/
npm run test:e2e      # E2E via Supertest

# Frontend
cd frontend/blues-clues-hris-frontend-web
npm run test          # jest --coverage
```

## Coverage

- Backend: `collectCoverageFrom: ["**/*.(t|j)s"]` — covers all src files
- Coverage output: `tribeX-hris-auth-api/coverage/`
- Frontend: `jest --coverage` per `package.json` test script
- **Current coverage: low** — most spec files are empty stubs

## Gap Assessment

| Area | Coverage | Risk |
|------|----------|------|
| Auth service (login, refresh, JWT) | Low (stub only) | High — core flow |
| Timekeeping service | Low (stub only) | Medium |
| Users service | Low (stub only) | Medium |
| Mail service | None | High — email failures silently swallowed |
| Applicants / Jobs / Onboarding | None | Medium |
| Frontend components | Unknown | Medium |
| Mobile | None | Low (Expo Go manual) |

Priority: write real tests for auth flows, DTO validation, timekeeping logic.
