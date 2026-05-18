# Offboarding + Leave + CNB Merge Report

**Status**: ✅ **FRONTEND MERGE COMPLETE** | ⏳ **BACKEND IMPLEMENTATION REQUIRED**

**Date**: 2026-05-15  
**Scope**: Leave, Offboarding, CNB/Payroll modules merged into featsprint5 workspace

---

## Summary

The frontend for Leave, Offboarding, and Payroll (CNB) modules has been successfully merged from `offboarding_leave_cnb.zip` into the existing featsprint5 workspace. All UI components, API function definitions, and type definitions are in place. **Backend endpoints and database schema implementation are required to make the system fully functional.**

---

## Frontend Merge Completion

### ✅ Completed Tasks

#### 1. Leave Module
- **API Functions** (authApi.ts)
  - `getMyLeaveBalances()` - Fetch leave balance cards
  - `getMyLeaveRequests()` - Fetch recent leave requests
  - `fileLeaveRequestApi()` - Submit new leave request
  - Types: `LeaveReason`, `LeaveBalanceCard`, `LeaveRequestItem`, `LeaveRequestStatus`

- **UI Components**
  - `/employee/leave/page.tsx` - Full leave dashboard with balance tracking and filing form

#### 2. Offboarding Module
- **API Functions** (offboardingApi.ts - 173 lines)
  - Employee APIs: `getMyOffboardingCase()`, `submitResignation()`, `acknowledgeChecklistItem()`
  - Manager APIs: `getManagerCases()`, `getManagerCaseDetail()`, `initiateTermination()`, `acknowledgeCase()`, `saveKnowledgeTransfer()`
  - HR APIs: `getHRCases()`, `getHRCaseDetail()`, `initiateHROffboarding()`, `reviewCase()`, `updateHRCaseStatus()`, `updateUserAccountStatus()`, `triggerJobPosting()`, plus 10+ additional endpoints
  - Types: `OffboardingCaseDetail`, `ChecklistItem`, `FinalPay`, `SystemAccessItem`, etc.

- **UI Components**
  - `/employee/offboarding/page.tsx` - Employee resignation submission with checklist acknowledgement (280+ lines)
  - `/hr/offboarding/page.tsx` - HR offboarding management and case review (1365 lines)
  - `/manager/offboarding/page.tsx` - Manager offboarding oversight (567 lines)

#### 3. Payroll & CNB Module
- **API Functions** (payrollApi.ts - 700+ lines)
  - Salary Management: `setSalaryBaseline()`, `getSalaryBaseline()`, `getAllSalaryBaselines()`
  - Benefits: `getBenefitsCatalog()`, `getEmployeeBenefits()`, `assignEmployeeBenefit()`, `removeEmployeeBenefit()`
  - Statutory: `getStatutoryIds()`, `saveStatutoryIds()`
  - Tax: `getTaxBrackets()`, `createTaxBracket()`, `deleteTaxBracket()`
  - Payroll: `getMyPayslips()`, `getPayslipDetail()`, `runPayrollCutoff()`, `getPayrollPeriods()`, `getPayslipsForPeriod()`
  - Compensation: `getMyCompensation()`, `compute13thMonthPay()`, `computeSalaryAnnualization()`, `getBenefitDefaults()`, `setBenefitDefaults()`

- **Supporting APIs**
  - hrDirectoryApi.ts - HR directory and org chart operations
  - securityApi.ts - Security operations

### Files Merged (Location: `frontend/blues-clues-hris-frontend-web/src/`)
```
lib/
  ├── authApi.ts (modified - added leave functions)
  ├── offboardingApi.ts (new)
  ├── payrollApi.ts (new)
  ├── hrDirectoryApi.ts (new)
  └── securityApi.ts (new)

app/(dashboard)/
  ├── employee/
  │   ├── leave/page.tsx (new)
  │   └── offboarding/page.tsx (updated)
  ├── hr/
  │   └── offboarding/page.tsx (new)
  └── manager/
      └── offboarding/page.tsx (new)
```

---

## Backend Implementation Required

### 🚨 Critical Path: Backend Endpoints

The frontend is ready to call these endpoints. Backend must implement:

#### Leave Management (`/leave/*`)
```
GET    /leave/balances                    - Employee's leave balance
GET    /leave/requests/me                 - Employee's leave requests
POST   /leave/requests                    - File new leave request
PATCH  /leave/requests/{id}               - Update leave request status
GET    /leave/requests                    - Get leave requests for approval
PATCH  /leave/requests/{id}               - Approve/reject leave
```

**Request/Response Examples:**
```json
// GET /leave/balances response
[
  { "type": "Vacation", "remaining": 10, "total": 15 },
  { "type": "Sick", "remaining": 5, "total": 10 }
]

// POST /leave/requests body
{ "leave_type": "Vacation Leave", "start_date": "2026-06-01", "end_date": "2026-06-05", "reason": "Vacation" }
```

#### Offboarding Management (`/offboarding/*`)
```
// Employee Routes
GET    /offboarding/employee/cases/my     - Get employee's active case
POST   /offboarding/employee/cases        - Submit resignation
PATCH  /offboarding/employee/cases/{id}/checklist/{itemId}/acknowledge - Acknowledge checklist

// Manager Routes
GET    /offboarding/manager/cases         - List manager's cases
GET    /offboarding/manager/cases/{id}    - Get case detail
PATCH  /offboarding/manager/cases/{id}/status - Change status
PATCH  /offboarding/manager/cases/{id}/knowledge-transfer - Save knowledge transfer

// HR Routes
GET    /offboarding/hr/cases              - List all cases with filters
POST   /offboarding/hr/cases              - Initiate termination
GET    /offboarding/hr/cases/{id}         - Get case detail
PATCH  /offboarding/hr/cases/{id}/review  - Accept/reject case
PATCH  /offboarding/hr/cases/{id}/checklist/{itemId} - Verify/flag checklist item
PATCH  /offboarding/hr/cases/{id}/final-pay - Update final pay
POST   /offboarding/hr/cases/{id}/final-pay/release - Release payment
PATCH  /offboarding/hr/cases/{id}/bank-transfer/confirm - Confirm transfer
PATCH  /offboarding/hr/cases/{id}/clearance - Release clearance
DELETE /offboarding/hr/cases/{id}/system-access/{accessId} - Revoke system access
PATCH  /offboarding/hr/cases/{id}/status  - Update case status
```

#### Compensation & Benefits (`/cnb/*`)
```
GET    /cnb/salary-baselines              - Get all salary baselines
POST   /cnb/salary-baselines              - Create salary baseline
GET    /cnb/salary-baselines/{userId}     - Get employee's salary
PATCH  /cnb/salary-baselines/{userId}     - Update salary

GET    /cnb/benefits-catalog              - List available benefits
POST   /cnb/benefits-catalog              - Create benefit type
GET    /cnb/employee-benefits/{userId}    - Get employee benefits
POST   /cnb/employee-benefits             - Assign benefit to employee
DELETE /cnb/employee-benefits/{mappingId} - Remove benefit

GET    /cnb/statutory-ids/{userId}        - Get statutory IDs
PATCH  /cnb/statutory-ids/{userId}        - Save statutory IDs

GET    /cnb/tax-brackets                  - Get tax brackets
POST   /cnb/tax-brackets                  - Create tax bracket

GET    /cnb/benefit-defaults              - Get benefit defaults
POST   /cnb/benefit-defaults              - Set benefit defaults

GET    /cnb/me/compensation               - Employee's compensation package
GET    /cnb/me/payslips                   - Employee's payslips
GET    /cnb/payslips/{payslipId}          - Payslip detail
PATCH  /cnb/payslips/{payslipId}/review   - Review payslip

POST   /cnb/payroll/run                   - Run payroll cutoff
GET    /cnb/payroll/periods               - Get payroll periods
GET    /cnb/payroll/periods/{periodId}/payslips - Get period payslips

GET    /payroll/me/payslips               - Employee payslips (alternate route)
GET    /payroll/ledger                    - HR payroll ledger view
POST   /payroll/cutoff/run                - Run cutoff (alternate route)
```

---

### 📊 Database Schema Required

Key tables to create (see DATABLES.md for full schema):

**Leave Tables:**
- `leave_requests` - Leave request records
- `leave_balances` - Employee leave balance tracking
- `leave_types` - Leave type definitions

**Offboarding Tables:**
- `offboarding_cases` - Main offboarding case record
- `checklist_items` - Offboarding checklist items
- `system_access` - System access records
- `clearance_documents` - Clearance document tracking
- `final_pay` - Final payment details
- `knowledge_transfer` - Knowledge transfer records

**CNB/Payroll Tables:**
- `salary_baselines` - Employee salary information
- `cnb_benefits_catalog` - Available benefits
- `cnb_employee_benefits` - Employee benefit assignments
- `cnb_benefit_defaults` - Default benefit amounts (SSS, PhilHealth, Pag-IBIG)
- `statutory_ids` - Employee statutory IDs (TIN, SSS, etc.)
- `tax_brackets` - Tax bracket definitions
- `payslips` - Employee payslips
- `payroll_periods` - Payroll cutoff periods
- `employee_benefit_history` - Audit trail of benefit changes

SQL migration files are available at:
- `tribeX-hris-auth-api/sql/` (check existing migration files)

---

### 🏗️ Backend Module Structure

The backend needs NestJS modules for:
1. **Leave Module** - Handle leave requests, balances, approvals
2. **Offboarding Module** - Manage offboarding workflows for resignation/termination
3. **CNB Module** - Compensation, benefits, payroll management
4. **Payroll Module** - Payroll processing and ledger

Each module should include:
- `*.controller.ts` - Route handlers
- `*.service.ts` - Business logic
- `*.module.ts` - Module definition
- DTOs - Data transfer objects for requests/responses

---

## Linting Status

**Non-Critical Warnings** (compile and run fine):
- Unused imports in offboarding page (can be cleaned)
- Accessibility warnings on form labels (best practice)
- Nested ternary operators (code style)
- TODO comments for file upload implementations (mock upload currently in place)

**No blocking errors** - application will compile and run.

---

## Next Steps

### Immediate (Required for functionality)
1. **Implement Backend Endpoints**
   - Start with Leave module (simpler, foundational)
   - Then Offboarding (more complex workflows)
   - Then CNB/Payroll (most complex, depends on leave)

2. **Create Database Schema**
   - Run migrations for all tables
   - Set up foreign key relationships
   - Seed default benefit types and tax brackets

3. **Connect Authentication**
   - Ensure JWT token extraction from Bearer header
   - Implement role-based access (Employee, Manager, HR)
   - Verify Supabase/auth integration

### Testing
4. **Frontend Testing**
   - Fix linting issues (optional but recommended)
   - Test API calls with postman/insomnia
   - Verify error handling and loading states

5. **Cross-Module Integration**
   - Test leave request impact on payroll
   - Test offboarding impact on system access
   - Verify timekeeping module still works unchanged

6. **UAT**
   - Employee: File leave, submit resignation
   - Manager: Acknowledge offboarding, save knowledge transfer
   - HR: Review cases, manage CNB, run payroll

---

## Project Files

- **Merge Documentation**: This file (`MERGE_STATUS_REPORT.md`)
- **Frontend Code**: All files in `frontend/blues-clues-hris-frontend-web/src/`
- **Database Schema**: `temp_cnb_extract/offboarding_leave_cnb/DATABLES.md`
- **API Documentation**: 
  - `temp_cnb_extract/offboarding_leave_cnb/frontend/blues-clues-hris-frontend-web/LEAVE_BACKEND_HANDOFF.md`
  - `temp_cnb_extract/offboarding_leave_cnb/tribeX-hris-auth-api/CNB_INTEGRATION_GUIDE.md`
  - `temp_cnb_extract/offboarding_leave_cnb/tribeX-hris-auth-api/BENEFIT_DEFAULTS_FEATURE.md`

---

## Constraints

✅ **Met**:
- No new top-level folders created
- Existing timekeeping and landing page unchanged
- Merged into existing repository structure
- All frontend modules integrated

⏳ **Pending**:
- Backend module implementation (source code only available as compiled dist/)
- Database schema creation
- Cross-module integration testing

---

**Contact**: For backend implementation guidance, refer to the extracted system's NestJS modules in `temp_cnb_extract/offboarding_leave_cnb/tribeX-hris-auth-api/dist/` and documentation files.
