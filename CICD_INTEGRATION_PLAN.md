# CI/CD Integration Plan — BluesClues HRIS Backend

This document maps out every change needed to align the `tribeX-hris-auth-api` codebase with the ImplementSprint NestJS backend template so the central `master-pipeline-be.yml` pipeline runs cleanly.

> **Scope:** Backend only. The frontend and mobile folders are excluded from this push.
> **Rule:** The template structure must be preserved exactly. Additional files/folders are allowed.
> **Reference repo:** `https://github.com/ImplementSprint/smurf-village-be` (branch: `test`)

---

## Current State vs. Required State

| Area | Before | After |
|---|---|---|
| Source layout | Flat `src/` at repo root | `apps/api/src/` + `libs/` |
| Shared modules | Inline in `src/api-center/`, `src/common/`, `src/supabase/` | Extracted to `libs/` |
| Contracts lib | Not present | `libs/contracts/` (stub) |
| `nest-cli.json` | Single-app mode (`sourceRoot: "src"`) | Monorepo mode with `apps` + `libs` entries |
| Dockerfile | `Dockerfile` at repo root | `apps/api/Dockerfile` |
| E2E tests | `test/` folder (NestJS default) | `tests/e2e/` |
| Performance tests | Not present | `tests/performance/api-smoke.js` |
| `package.json` scripts | `build`, `test:cov` (single-app) | `build:api`, `test:cov -- --selectProjects api` |
| Jest config | `rootDir: "src"`, no `moduleNameMapper` | `rootDir: "."`, `moduleNameMapper` for `@app/*` |
| GitHub variable | Not set | `BACKEND_MULTI_SYSTEMS_JSON` |
| GitHub secrets | Partially set | Full list below |

---

## Step 1 — Folder Structure (inside `tribeX-hris-auth-api/`)

```
apps/
  api/
    src/           ← all feature modules live here
      main.ts
      api.module.ts
      api.controller.ts
      api.service.ts
      health/
      auth/
      users/
      jobs/
      payroll/
      timekeeping/
      leave/
      leave-balances/
      onboarding/
      offboarding/
      applicants/
      notifications/
      overtime/
      performance/
      cnb/
      audit/
      mail/
      subscription/
      super-admin/
    Dockerfile
    tsconfig.app.json
libs/
  api-center/src/   ← moved from src/api-center/
  common/src/       ← moved from src/common/
  supabase/src/     ← moved from src/supabase/
  contracts/src/    ← new (stub)
tests/
  e2e/
    app.e2e-spec.ts
    jest-e2e.json
  performance/
    api-smoke.js
    README.md
```

### Folder move mapping

| From (original) | To (after) |
|---|---|
| `src/` (all feature modules) | `apps/api/src/` |
| `src/api-center/` | `libs/api-center/src/` |
| `src/common/` | `libs/common/src/` |
| `src/supabase/` | `libs/supabase/src/` |
| `Dockerfile` (root) | `apps/api/Dockerfile` |

---

## Step 2 — `nest-cli.json` (monorepo mode)

```json
{
  "$schema": "https://json.schemastore.org/nest-cli.json",
  "collection": "@nestjs/schematics",
  "sourceRoot": "apps/api/src",
  "monorepo": true,
  "root": "apps/api",
  "compilerOptions": {
    "webpack": true,
    "deleteOutDir": true
  },
  "projects": {
    "api": {
      "type": "application",
      "root": "apps/api",
      "sourceRoot": "apps/api/src",
      "entryFile": "main",
      "prefix": "api",
      "tsconfig": "apps/api/tsconfig.app.json"
    },
    "common":    { "type": "library", "root": "libs/common",     "sourceRoot": "libs/common/src",     "prefix": "app", "tsconfig": "libs/common/tsconfig.lib.json" },
    "api-center":{ "type": "library", "root": "libs/api-center", "sourceRoot": "libs/api-center/src", "prefix": "app", "tsconfig": "libs/api-center/tsconfig.lib.json" },
    "supabase":  { "type": "library", "root": "libs/supabase",   "sourceRoot": "libs/supabase/src",   "prefix": "app", "tsconfig": "libs/supabase/tsconfig.lib.json" },
    "contracts": { "type": "library", "root": "libs/contracts",  "sourceRoot": "libs/contracts/src",  "prefix": "app", "tsconfig": "libs/contracts/tsconfig.lib.json" }
  }
}
```

> **Why `webpack: true`?** Without webpack, `tsc` compiles TypeScript but leaves `require('@app/supabase')` in the output. Node.js cannot resolve path aliases at runtime. Webpack bundles everything and resolves `@app/*` aliases at compile time — the output file is self-contained.

---

## Step 3 — `tsconfig.json` (path aliases)

```json
{
  "compilerOptions": {
    "paths": {
      "@app/common":      ["libs/common/src"],
      "@app/common/*":    ["libs/common/src/*"],
      "@app/api-center":  ["libs/api-center/src"],
      "@app/api-center/*":["libs/api-center/src/*"],
      "@app/supabase":    ["libs/supabase/src"],
      "@app/supabase/*":  ["libs/supabase/src/*"],
      "@app/contracts":   ["libs/contracts/src"],
      "@app/contracts/*": ["libs/contracts/src/*"]
    }
  },
  "include": ["apps", "libs"],
  "exclude": ["node_modules", "dist"]
}
```

---

## Step 4 — `package.json` Scripts

```json
{
  "scripts": {
    "build":       "nest build api",
    "build:api":   "nest build api",
    "start":       "nest start api",
    "start:dev":   "nest start api --watch",
    "start:prod":  "node dist/main.js",
    "lint":        "eslint \"{apps,libs}/**/*.ts\" --fix",
    "typecheck":   "tsc --noEmit",
    "test":        "jest",
    "test:cov":    "jest --coverage",
    "test:e2e":    "jest --config ./tests/e2e/jest-e2e.json"
  },
  "jest": {
    "rootDir": ".",
    "roots": ["<rootDir>/apps/", "<rootDir>/libs/"],
    "moduleNameMapper": {
      "^@app/common$":      "<rootDir>/libs/common/src",
      "^@app/api-center$":  "<rootDir>/libs/api-center/src",
      "^@app/supabase$":    "<rootDir>/libs/supabase/src",
      "^@app/contracts$":   "<rootDir>/libs/contracts/src"
    }
  }
}
```

> **Pipeline calls:** `npm run test:cov -- --selectProjects api` and `npm run build:api` — both must exist.

---

## Step 5 — `apps/api/tsconfig.app.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "declaration": false,
    "outDir": "../../dist"
  },
  "include": ["src/**/*.ts", "../../libs/**/*.ts"],
  "exclude": ["node_modules", "dist", "test", "tests", "**/*.spec.ts"]
}
```

> `outDir: "../../dist"` resolves to `dist/` at project root. This aligns with where NestJS CLI looks for the compiled entry file (`dist/main.js`).

---

## Step 6 — `apps/api/Dockerfile`

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY apps/api ./apps/api
COPY libs ./libs
RUN npm run build:api

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
EXPOSE 5000
CMD ["node", "dist/main.js"]
```

---

## Step 7 — Each `libs/<name>/src/index.ts` (barrel exports)

| Lib | Exports |
|---|---|
| `libs/api-center/src/index.ts` | `api-center-sdk.module`, `api-center-sdk.service` |
| `libs/supabase/src/index.ts` | `supabase.module`, `supabase.service` |
| `libs/common/src/index.ts` | `database-error.handler`, `env/validate-env`, `filters/all-exceptions.filter`, `middleware/correlation-id.middleware`, `person.utils`, `security/security.config`, `types/authenticated-request` |
| `libs/contracts/src/index.ts` | (empty stub) |

---

## Step 8 — GitHub Repository Variable

**Settings → Variables → Repository variables**

**Name:** `BACKEND_MULTI_SYSTEMS_JSON`

```json
[
  {
    "name": "blues-clues-hris-api",
    "dir": ".",
    "install_dir": ".",
    "project": "api",
    "image": "ghcr.io/<YOUR_ORG>/blues-clues-hris-api",
    "backend_stack": "nestjs",
    "version_stream": "api",
    "test_command": "npm run test:cov -- --selectProjects api",
    "build_command": "npm run build:api",
    "dockerfile_path": "apps/api/Dockerfile",
    "k6_script_path": "tests/performance/api-smoke.js"
  }
]
```

> Replace `<YOUR_ORG>` with the actual GitHub organization slug.

---

## Step 9 — GitHub Repository Secrets

**Settings → Secrets → Repository secrets**

| Secret | Purpose |
|---|---|
| `SONAR_TOKEN` | SonarCloud analysis token |
| `SONAR_ORGANIZATION` | SonarCloud organization slug |
| `SONAR_PROJECT_KEY` | Unique SonarCloud project key |
| `GH_PR_TOKEN` | PAT with `pull-requests: write` for auto-promotion |
| `K6_CLOUD_TOKEN` | Grafana Cloud k6 execution token |
| `K6_CLOUD_PROJECT_ID` | Grafana Cloud k6 project ID |
| `RENDER_DEPLOY_HOOK_URL_TEST` | Render deploy hook — test environment |
| `RENDER_DEPLOY_HOOK_URL_UAT` | Render deploy hook — UAT environment |
| `RENDER_DEPLOY_HOOK_URL_MAIN` | Render deploy hook — main environment |
| `RENDER_HEALTHCHECK_URL_TEST` | Health URL — test environment |
| `RENDER_HEALTHCHECK_URL_UAT` | Health URL — UAT environment |
| `RENDER_HEALTHCHECK_URL_MAIN` | Health URL — main environment |

---

## Step 10 — Render Environment Variables

Configure per environment (test / UAT / main) in Render dashboard:

```
NODE_ENV=production
PORT=5000
ENABLE_SWAGGER=false
ALLOWED_ORIGINS=<exact frontend URL for this environment>

SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

API_CENTER_BASE_URL=
API_CENTER_TRIBE_ID=
API_CENTER_TRIBE_SECRET=
```

> `checks.apiCenter=true` is required for the pipeline health gate to pass.

---

## Pipeline Branch Flow

```
push to test  →  quality gates → security scan → SonarCloud → deploy Render test  → k6 smoke → auto-PR to uat
push to uat   →  quality gates → security scan → SonarCloud → deploy Render UAT   → k6 smoke → auto-PR to main
push to main  →  quality gates → security scan → SonarCloud → Docker build (Trivy) → deploy Render main → k6 smoke
```

---

## Completion Checklist

- [x] Create `apps/api/src/` and move all feature modules from `src/`
- [x] Extract `src/api-center/` → `libs/api-center/src/`
- [x] Extract `src/common/` → `libs/common/src/`
- [x] Extract `src/supabase/` → `libs/supabase/src/`
- [x] Create `libs/contracts/src/index.ts` (stub)
- [x] Add `index.ts` barrel exports to each `libs/<name>/src/`
- [x] Update all import paths in `apps/api/src/` to use `@app/<lib>` aliases
- [x] Rename `app.module.ts` → `api.module.ts`, `app.controller.ts` → `api.controller.ts`
- [x] Switch `nest-cli.json` to monorepo mode (`webpack: true`)
- [x] Update `tsconfig.json` with path aliases
- [x] Add `tsconfig.lib.json` to each `libs/<name>/`
- [x] Add `apps/api/tsconfig.app.json`
- [x] Add `build:api` and update scripts in `package.json`
- [x] Fix Jest config (`rootDir`, `moduleNameMapper`)
- [x] Move `Dockerfile` to `apps/api/Dockerfile` and update COPY paths
- [x] Create `tests/e2e/jest-e2e.json` + `app.e2e-spec.ts`
- [x] Create `tests/performance/api-smoke.js`
- [x] Create `sonar-project.properties`
- [x] Create `.trivyignore`, `tribe-manifest.json`, `render-build.sh`, `.env.example`
- [ ] Set `BACKEND_MULTI_SYSTEMS_JSON` GitHub repository variable
- [ ] Set all 12 GitHub repository secrets
- [ ] Configure Render environments with production env vars
- [ ] Verify health endpoint returns `checks.apiCenter: true` before first pipeline run
