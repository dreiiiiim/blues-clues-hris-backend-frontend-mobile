# Docker Setup

This repo now includes container files for:

- `tribeX-hris-auth-api`
- `frontend/blues-clues-hris-frontend-web`

## Prerequisites

1. Install Docker Desktop for Windows.
2. Enable WSL2 integration during setup.
3. Confirm Docker is available:

```powershell
docker --version
docker compose version
```

## Environment Files

Backend:

```powershell
Copy-Item tribeX-hris-auth-api/.env.example tribeX-hris-auth-api/.env
```

Frontend:

```powershell
Copy-Item frontend/blues-clues-hris-frontend-web/.env.local.example frontend/blues-clues-hris-frontend-web/.env.local
```

Fill in the backend `.env` values, especially:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`
- `JWT_SECRET`
- `MAIL_USER`
- `MAIL_PASS`
- `APP_URL`

## Run

From repo root:

```powershell
docker compose up --build
```

## URLs

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Stop

```powershell
docker compose down
```

## Notes

- The frontend container builds Next.js in production mode.
- The frontend uses `NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/tribeX/auth/v1` in `docker-compose.yml`.
- Docker could not be executed in this environment because Docker Desktop is not installed on this machine yet.
