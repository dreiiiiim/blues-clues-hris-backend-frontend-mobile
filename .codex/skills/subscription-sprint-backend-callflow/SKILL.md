---
name: subscription-sprint-backend-callflow
description: Build and review backend APIs for the subscription sprint using the CALLFLOW source artifacts. Use when Codex or Claude needs to implement endpoints, DTOs, services, entities, DB migrations, RBAC, tenant provisioning, signup links, payment and activation flows, and audit logs based on callflow diagrams/text in D:\Documents(D)\3rdYR-2nd\CALLFLOW. Also use to detect inconsistencies in callflow logic and propose concrete corrections before coding.
---
# Subscription Sprint Backend Callflow Skill

Use this skill to convert callflow artifacts into production-ready backend API work.

## Source of Truth

Always use files in `D:\Documents(D)\3rdYR-2nd\CALLFLOW`:
- `company representative.txt`
- `system admin.txt`
- `user account creation.txt`
- `Sprint 3-2026-04-26-111548.svg`
- `Sprint 3-2026-04-26-111649.svg`
- `Sprint 3-2026-04-26-111757.svg`

If a file is missing or empty, note it in output and continue with remaining artifacts.

## Workflow

1. Load all callflow artifacts.
2. Extract actors, phases, state transitions, and data objects.
3. Build an API contract map:
- route
- method
- auth role
- request DTO
- response DTO
- side effects (email, payment, tenant provisioning)
4. Build persistence map:
- tables/entities touched
- create/update/read operations per phase
- tenant isolation requirements
5. Detect callflow issues before coding. Flag:
- contradictory transitions
- missing failure paths
- missing idempotency boundaries
- security gaps (RBAC, tenant leakage, token expiry)
- vague fields that block implementation
6. Propose corrections in a "Callflow Corrections" section with:
- issue
- risk
- exact corrected behavior
7. Implement backend incrementally after corrections are documented.
8. Add or update tests for happy path and failure path per endpoint.

## Implementation Rules

- Enforce tenant scoping on every read/write.
- Make payment confirmation endpoint idempotent.
- Never activate subscription before verified payment callback.
- Generate short-lived signup/reset links with explicit expiry and one-time use.
- Track audit logs for admin-level user/account and RBAC changes.
- Validate all required fields and return field-level errors.
- Separate orchestration logic (service layer) from transport layer (controllers).

## Required Output Shape

Always return these sections when using this skill:
1. `Callflow Coverage` (which files were read)
2. `API Plan` (endpoint matrix)
3. `Schema/Entity Changes`
4. `Callflow Corrections`
5. `Implementation Summary`
6. `Test Coverage`

## Quick Commands

Use PowerShell to inspect source artifacts quickly:

```powershell
Get-ChildItem "D:\Documents(D)\3rdYR-2nd\CALLFLOW" -File
Get-Content -Raw "D:\Documents(D)\3rdYR-2nd\CALLFLOW\company representative.txt"
Get-Content -Raw "D:\Documents(D)\3rdYR-2nd\CALLFLOW\system admin.txt"
```

For this repository, use `tribeX-hris-auth-api` as the default backend implementation target unless user specifies another service.
