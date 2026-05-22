# Subdomain-Per-Company Login Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each provisioned company a branded login at `http://{slug}.localhost:3001/login` that enforces company-scoped authentication and shows the company logo/name on the login page.

**Architecture:** Single shared deployment, multi-tenant by `company_id`. The subdomain is detected client-side via `window.location.hostname`. A new public `/jobs/public/branding/:slug` endpoint returns company branding. Login DTO gains an optional `slug` field; the backend rejects cross-company logins. CORS is widened to allow `*.localhost` origins. The super-admin companies page computes and displays the access URL from the slug returned by the list query.

**Tech Stack:** NestJS 10 (backend), Next.js 16 App Router (frontend), Supabase JS client, TypeScript, class-validator, Tailwind CSS + shadcn/ui.

---

## File Map

| Action | File |
|--------|------|
| Modify | `tribeX-hris-auth-api/src/jobs/jobs.service.ts` |
| Modify | `tribeX-hris-auth-api/src/jobs/jobs.controller.ts` |
| Modify | `tribeX-hris-auth-api/src/common/security/security.config.ts` |
| Modify | `tribeX-hris-auth-api/src/auth/dto/login.dto.ts` |
| Modify | `tribeX-hris-auth-api/src/auth/auth.service.ts` |
| Modify | `frontend/blues-clues-hris-frontend-web/src/lib/authApi.ts` |
| Modify | `frontend/blues-clues-hris-frontend-web/src/app/(auth)/login/page.tsx` |
| Modify | `frontend/blues-clues-hris-frontend-web/src/app/(super-admin)/super-admin/companies/page.tsx` |

---

## Task 1: Backend — Public branding endpoint

**Files:**
- Modify: `tribeX-hris-auth-api/src/jobs/jobs.service.ts`
- Modify: `tribeX-hris-auth-api/src/jobs/jobs.controller.ts`

Context: `JobsService` already has `getPublicCareersBySlug()` which queries `company` + `tenant_config.branding_settings`. The branding endpoint reuses that pattern minus the jobs query. `JobsController` already has a public (unguarded) `GET /jobs/public/careers/:slug` route — add the branding route directly above it.

- [ ] **Step 1: Add `getPublicBrandingBySlug()` to JobsService**

In `jobs.service.ts`, add this method after `getPublicCareersBySlug` (around line 1515):

```typescript
async getPublicBrandingBySlug(slug: string) {
  const supabase = this.supabaseService.getClient();

  const { data: company } = await supabase
    .from('company')
    .select('company_id, company_name, slug')
    .eq('slug', slug)
    .maybeSingle();

  if (!company) throw new NotFoundException('Company not found');

  const { data: tenantConfig } = await supabase
    .from('tenant_config')
    .select('branding_settings')
    .eq('company_id', company.company_id)
    .maybeSingle();

  const branding = (tenantConfig?.branding_settings as Record<string, unknown> | null) ?? null;

  return {
    company_id: company.company_id,
    company_name: company.company_name,
    company_display_name:
      typeof branding?.company_display_name === 'string' ? branding.company_display_name : null,
    company_logo_url:
      typeof branding?.company_logo_url === 'string' ? branding.company_logo_url : null,
    slug: company.slug,
  };
}
```

- [ ] **Step 2: Add route in JobsController**

In `jobs.controller.ts`, add this route immediately after `@Get('public/careers/:slug')` block (around line 48):

```typescript
@Get('public/branding/:slug')
@ApiOperation({ summary: 'Public: Get company branding by slug' })
getPublicBrandingBySlug(@Param('slug') slug: string) {
  return this.jobsService.getPublicBrandingBySlug(slug);
}
```

No `@UseGuards` — intentionally unguarded (mirrors the careers pattern).

- [ ] **Step 3: Verify endpoint**

Start the API: `cd tribeX-hris-auth-api && npm run start:dev`

In a browser or curl, hit (replace `acme` with an actual slug from your DB):
```
GET http://localhost:5000/api/tribeX/auth/v1/jobs/public/branding/acme
```

Expected: `200 { company_id, company_name, company_display_name, company_logo_url, slug }`
If company doesn't exist: `404 { message: 'Company not found' }`

- [ ] **Step 4: Commit**

```bash
git add tribeX-hris-auth-api/src/jobs/jobs.service.ts tribeX-hris-auth-api/src/jobs/jobs.controller.ts
git commit -m "feat(api): add public branding-by-slug endpoint GET /jobs/public/branding/:slug"
```

---

## Task 2: Backend — Allow `*.localhost` in CORS

**Files:**
- Modify: `tribeX-hris-auth-api/src/common/security/security.config.ts`

Context: `isImplicitDevOrigin()` currently allows `localhost` and `127.0.0.1` but NOT `acme.localhost`. A fetch from `http://acme.localhost:3001` to `localhost:5000` is blocked by CORS. Adding a `.localhost` suffix check fixes it.

- [ ] **Step 1: Add wildcard localhost check**

In `security.config.ts`, inside `isImplicitDevOrigin()`, add this block right before `return false` (after the `172.x` range check, around line 28):

```typescript
// Allow *.localhost subdomains — Chrome resolves them to 127.0.0.1
if (hostname.endsWith('.localhost')) {
  return true;
}
```

Full function after edit:
```typescript
function isImplicitDevOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    const hostname = url.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return true;
    }

    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) {
      return true;
    }

    const match = hostname.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
    if (match) {
      const secondOctet = Number(match[1]);
      return secondOctet >= 16 && secondOctet <= 31;
    }

    // Allow *.localhost subdomains — Chrome resolves them to 127.0.0.1
    if (hostname.endsWith('.localhost')) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Verify CORS allows subdomain**

Restart the API. In Chrome DevTools console (while on `http://acme.localhost:3001`), run:
```javascript
fetch('http://localhost:5000/api/tribeX/auth/v1/jobs/public/branding/acme', { credentials: 'include' })
  .then(r => r.json()).then(console.log)
```
Expected: JSON response, no CORS error.

- [ ] **Step 3: Commit**

```bash
git add tribeX-hris-auth-api/src/common/security/security.config.ts
git commit -m "fix(cors): allow *.localhost subdomain origins for dev subdomain login"
```

---

## Task 3: Backend — Enforce company boundary on subdomain login

**Files:**
- Modify: `tribeX-hris-auth-api/src/auth/dto/login.dto.ts`
- Modify: `tribeX-hris-auth-api/src/auth/auth.service.ts`

Context: When a user signs in at `acme.localhost:3001/login`, the frontend will send `slug: 'acme'` in the POST body. The backend must verify that the signing-in user's `company_id` matches the company identified by that slug — rejecting cross-company logins.

- [ ] **Step 1: Add optional `slug` to LoginDto**

Replace `login.dto.ts` with:

```typescript
import { IsNotEmpty, IsString, MinLength, IsBoolean, Matches, IsOptional } from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9._@-]+$/, { message: 'Invalid identifier format' })
  identifier: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Invalid slug format' })
  slug?: string;
}
```

- [ ] **Step 2: Enforce boundary in `AuthService.login()`**

In `auth.service.ts`, in the `login()` method, add the slug check **after** the `if (!isMatch)` block (after line 584, after the incorrect-password throw). Insert:

```typescript
// Enforce company boundary when logging in via a company subdomain
if (loginDto.slug) {
  const { data: slugCompany } = await supabase
    .from('company')
    .select('company_id, company_name')
    .eq('slug', loginDto.slug)
    .maybeSingle();
  if (!slugCompany) {
    throw new UnauthorizedException('Company not found for this login URL');
  }
  if (slugCompany.company_id !== user.company_id) {
    throw new UnauthorizedException(
      `This account doesn't belong to ${slugCompany.company_name}`,
    );
  }
}
```

- [ ] **Step 3: Verify slug check works**

With API running, POST to `http://localhost:5000/api/tribeX/auth/v1/auth/login`:
```json
{ "identifier": "admin@wrongcompany.com", "password": "testpass", "rememberMe": false, "slug": "acme" }
```
Expected: `401 { message: "This account doesn't belong to Acme Corp" }`

POST with correct company user:
```json
{ "identifier": "admin@acme.com", "password": "testpass", "rememberMe": false, "slug": "acme" }
```
Expected: `200` with access_token.

- [ ] **Step 4: Commit**

```bash
git add tribeX-hris-auth-api/src/auth/dto/login.dto.ts tribeX-hris-auth-api/src/auth/auth.service.ts
git commit -m "feat(auth): enforce company boundary via optional slug on login"
```

---

## Task 4: Frontend — Branding fetch + slug in login API

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/lib/authApi.ts`

Context: The login page needs to (a) fetch company branding before rendering and (b) pass `slug` in the login POST body so the backend can enforce the boundary.

- [ ] **Step 1: Add `CompanyBranding` type and `getCompanyBySlug()`**

At the top of `authApi.ts`, after the existing type exports, add:

```typescript
export type CompanyBranding = {
  company_id: string;
  company_name: string;
  company_display_name: string | null;
  company_logo_url: string | null;
  slug: string;
};

export async function getCompanyBySlug(slug: string): Promise<CompanyBranding> {
  const res = await fetch(
    `${API_BASE_URL}/jobs/public/branding/${encodeURIComponent(slug)}`,
  );
  if (!res.ok) throw new Error('Company not found');
  return res.json() as Promise<CompanyBranding>;
}
```

- [ ] **Step 2: Add optional `slug` to `loginApi` body**

Change the `loginApi` signature from:
```typescript
export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
}) {
```
To:
```typescript
export async function loginApi(body: {
  identifier: string;
  password: string;
  rememberMe: boolean;
  slug?: string;
}) {
```

The `JSON.stringify(body)` already serializes `slug` when present — no other changes needed inside the function body.

- [ ] **Step 3: Verify build**

```bash
cd frontend/blues-clues-hris-frontend-web && npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/blues-clues-hris-frontend-web/src/lib/authApi.ts
git commit -m "feat(frontend): add getCompanyBySlug() and slug param to loginApi"
```

---

## Task 5: Frontend — Login page subdomain detection + branding

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(auth)/login/page.tsx`

Context: The login page is a client component. On mount, detect if the page is served from a `*.localhost` subdomain. If yes, fetch branding and render the company name + logo. Pass `slug` in the login call.

- [ ] **Step 1: Add slug detection helper and branding state**

At the top of `EmployeeLoginPage()` (after the existing state declarations), add:

```typescript
// Detect company slug from subdomain (e.g. acme.localhost → 'acme')
function getSubdomainSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const hostname = window.location.hostname;
  if (hostname.endsWith('.localhost')) {
    const slug = hostname.slice(0, -('.localhost'.length));
    return slug && slug !== 'www' ? slug : null;
  }
  return null;
}
```

Add to existing imports:
```typescript
import { loginApi, refreshApi, getCompanyBySlug, CompanyBranding } from "@/lib/authApi";
```

Add state after existing state declarations:
```typescript
const [companyBranding, setCompanyBranding] = useState<CompanyBranding | null>(null);
const [slug, setSlug] = useState<string | null>(null);
```

- [ ] **Step 2: Fetch branding in useEffect**

Add a second `useEffect` (keep the existing remember-me effect unchanged):

```typescript
useEffect(() => {
  const detectedSlug = getSubdomainSlug();
  if (!detectedSlug) return;
  setSlug(detectedSlug);
  getCompanyBySlug(detectedSlug)
    .then(data => setCompanyBranding(data))
    .catch(() => {}); // fall back to default branding silently
}, []);
```

- [ ] **Step 3: Pass slug in login call**

In `handleLogin`, change:
```typescript
const login = await loginApi({ identifier, password, rememberMe });
```
To:
```typescript
const login = await loginApi({ identifier, password, rememberMe, slug: slug ?? undefined });
```

- [ ] **Step 4: Render branded left panel**

In the left panel JSX, find the branding block (around lines 101–110):
```tsx
<div className="flex items-center gap-3 mb-14">
  <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
    <Shield className="h-5 w-5 text-white" />
  </div>
  <div>
    <p className="text-white font-bold text-sm leading-none">Blue&apos;s Clues HRIS</p>
    <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Internal Staff Portal</p>
  </div>
</div>
```

Replace with:
```tsx
<div className="flex items-center gap-3 mb-14">
  <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center overflow-hidden">
    {companyBranding?.company_logo_url ? (
      <img
        src={companyBranding.company_logo_url}
        alt="Company logo"
        className="h-full w-full object-cover"
      />
    ) : (
      <Shield className="h-5 w-5 text-white" />
    )}
  </div>
  <div>
    <p className="text-white font-bold text-sm leading-none">
      {companyBranding?.company_display_name ?? companyBranding?.company_name ?? "Blue's Clues HRIS"}
    </p>
    <p className="text-white/50 text-[10px] uppercase tracking-widest mt-0.5">Internal Staff Portal</p>
  </div>
</div>
```

- [ ] **Step 5: Render branded right panel heading**

Find the right panel heading (around line 143):
```tsx
<h2 className="text-5xl font-bold tracking-tight">Staff Portal</h2>
<p className="text-lg text-muted-foreground">Welcome back, please sign in</p>
```

Replace with:
```tsx
<h2 className="text-5xl font-bold tracking-tight">
  {companyBranding ? 'Sign in to' : 'Staff Portal'}
</h2>
{companyBranding && (
  <p className="text-xl font-bold text-primary">
    {companyBranding.company_display_name ?? companyBranding.company_name}
  </p>
)}
<p className="text-lg text-muted-foreground">Welcome back, please sign in</p>
```

- [ ] **Step 6: Verify in browser**

Start frontend: `cd frontend/blues-clues-hris-frontend-web && npm run dev`

Open Chrome (not Firefox) and navigate to `http://acme.localhost:3001/login` (replace `acme` with a real slug).

Expected:
- Left panel shows company logo (if set) and company display name
- Right panel shows "Sign in to" + company name
- Bare `http://localhost:3001/login` still shows the default Blue's Clues HRIS branding

- [ ] **Step 7: Commit**

```bash
git add frontend/blues-clues-hris-frontend-web/src/app/\(auth\)/login/page.tsx
git commit -m "feat(login): detect subdomain, fetch company branding, brand login page"
```

---

## Task 6: Frontend — Companies page shows access URL

**Files:**
- Modify: `frontend/blues-clues-hris-frontend-web/src/app/(super-admin)/super-admin/companies/page.tsx`

Context: After provisioning, the super-admin should see a clickable access URL for each company. The list query in `SuperAdminCompaniesService.list()` already selects `company(company_name, slug)` as a joined column. The frontend `Company` type just needs to include that nested object, then the table can render the link.

- [ ] **Step 1: Update `Company` type to include slug**

Find the `Company` type (around line 9):
```typescript
type Company = {
  registration_id: string;
  company_id: string;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  subscription_status: string;
  payment_date: string;
  billing_cycle: string;
};
```

Replace with:
```typescript
type Company = {
  registration_id: string;
  company_id: string;
  company_name: string;
  email: string;
  industry: string;
  subscription_plan: string;
  subscription_status: string;
  payment_date: string;
  billing_cycle: string;
  company?: { company_name: string; slug: string } | null;
};
```

- [ ] **Step 2: Add "Open Instance" link in table row**

Find the action cell in the table (the `<td>` with the Provision and Suspend buttons, around line 168). Inside that `<div className="flex items-center gap-2">`, add this before the Provision button block:

```tsx
{c.company?.slug && (
  <a
    href={`http://${c.company.slug}.localhost:3001/login`}
    target="_blank"
    rel="noopener noreferrer"
    className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
  >
    Open Instance
  </a>
)}
```

- [ ] **Step 3: Verify in browser**

Navigate to `http://localhost:3001/super-admin/companies` (or the super-admin route in your app).

For a provisioned company (has `company_id`), the table should show a green "Open Instance" link. Clicking it opens `http://{slug}.localhost:3001/login` in a new tab.

For unprovisioned companies (no `company_id` → no slug join), no link appears.

- [ ] **Step 4: Commit**

```bash
git add "frontend/blues-clues-hris-frontend-web/src/app/(super-admin)/super-admin/companies/page.tsx"
git commit -m "feat(super-admin): show Open Instance link for provisioned companies"
```

---

## End-to-End Demo Script

After all 6 tasks complete, verify the full flow:

**Setup:** Chrome browser. Backend on port 5000, frontend on port 3001 (`npm run dev`).

1. **Login as super-admin** at `http://localhost:3001/super-admin` (or wherever the super-admin login is).
2. **Go to Companies** — find a Paid company that hasn't been provisioned yet (Provision button visible).
3. **Click Provision** and confirm. List refreshes. The row now shows a green **Open Instance** link.
4. **Click Open Instance** → `http://{slug}.localhost:3001/login` opens in Chrome.
5. **Check branding** — left panel shows company name (and logo if set). Right panel shows "Sign in to {Company Name}".
6. **Sign in** with that company's admin account → lands in their workspace.
7. **Negative test** — sign in with a different company's account on the same subdomain URL → rejected with "This account doesn't belong to {Company Name}".
8. **Bare login sanity** — `http://localhost:3001/login` still shows default Blue's Clues HRIS branding.

**Note:** Chrome only. Firefox/Safari require manual `/etc/hosts` entries.
