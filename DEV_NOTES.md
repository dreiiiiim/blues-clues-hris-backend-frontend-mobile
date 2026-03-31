# Dev Session Notes

## What Was Accomplished

### Signup Flow Fixed
- Applicants can now register and have their data saved to Supabase (`applicant_profile` and `email_verifications` tables).
- The signup → login → apply flow is working end to end.

### Job Application Working
- Applicants can successfully apply to job postings.
- Applications are saved to the `job_applications` table in Supabase.
- Answers (if any) are saved to `applicant_answers`.

---

## Dev Notes / Known Workarounds

### Email Verification (Gmail SMTP - Commented Out)
`tribeX-hris-auth-api/src/applicants/applicants.service.ts` ~line 104

The `sendVerificationEmail` call is currently **commented out** for local development because `MAIL_USER` and `MAIL_PASS` in `.env` are placeholder values. Instead, the verify link is logged to the backend console.

**To verify an account in dev:** check the backend console output for a line like:
```
[DEV] Verify link for user@email.com: http://localhost:3000/applicant/verify-email?token=...
```
Open that URL in the browser to verify the account before signing in.

**To enable real email sending:** set valid Gmail credentials in `.env`:
```
MAIL_USER=youremail@gmail.com
MAIL_PASS=xxxx xxxx xxxx xxxx   # Gmail App Password (not your regular password)
```
Then uncomment the try/catch block in `applicants.service.ts`.

### Company ID Required for Job Applications
Applicants must have a `company_id` linked to their account to apply for jobs. This is normally set at registration via a `?company=<uuid>` query parameter in the signup URL.

In dev, if an account was registered without this, manually set the `company_id` directly in the `applicant_profile` table in Supabase.

### Staff Admin / HR Officer Account Creation
Unlike applicants, Staff Admin and HR Officer accounts **cannot self-register**. They are created by a System Admin through the app, which:
1. Inserts the user into `user_profile` with `account_status: 'Pending'`
2. Generates an invite token in `user_invites` and sends an activation email (same Gmail SMTP issue applies)
3. The user clicks the invite link → `/set-password?token=...` → sets their password → account becomes `Active`

**In dev (since email is broken)**, the activation link is automatically logged to the backend console:
```
==========================================
DEV MODE - activation link
Recipient: user@email.com
http://localhost:3000/set-password?token=...
==========================================
```
Open that URL in the browser to set the password and activate the account.

The same flow applies to **password resets** for these accounts — the reset link is also logged to the console in dev.

### Viewing Data in Supabase
If rows aren't visible in the Supabase table editor, check if **Row Level Security (RLS)** is filtering results. Toggle the RLS filter off in the table editor to view all rows.
