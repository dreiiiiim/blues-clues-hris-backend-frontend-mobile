/**
 * Email template smoke test — sends all templates to a target address via Brevo.
 * Run: node test-emails.mjs
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// ─── Load .env ────────────────────────────────────────────────────────────────
const __dir = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dir, '.env');
for (const line of readFileSync(envPath, 'utf8').split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq === -1) continue;
  const key = trimmed.slice(0, eq).trim();
  const val = trimmed.slice(eq + 1).trim();
  process.env[key] ??= val;
}

const API_KEY      = process.env.BREVO_API_KEY;
const BASE_URL     = process.env.BREVO_BASE_URL ?? 'https://api.brevo.com';
const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL;
const SENDER_NAME  = process.env.BREVO_SENDER_NAME ?? 'Blues Clues HRIS';
const TO           = 'afdmandreimontaniel@gmail.com';

if (!API_KEY || !SENDER_EMAIL) {
  console.error('❌  BREVO_API_KEY or BREVO_SENDER_EMAIL not set in .env');
  process.exit(1);
}

// ─── Design tokens (mirrors mail.service.ts) ──────────────────────────────────
const BRAND = {
  name:       'Blues Clues HRIS',
  monogram:   'BC',
  headerBg:   'linear-gradient(135deg,#0f172a 0%,#1a2f4e 60%,#0c3a5e 100%)',
  accent:     '#99e0fe',
  accentDark: '#0369a1',
  pageBg:     '#eef2f7',
  cardBg:     '#ffffff',
  border:     '#e2e8f0',
  textPrimary:'#020617',
  textBody:   '#374151',
  textMuted:  '#6b7280',
  textFaint:  '#9ca3af',
  surface:    '#f8fafc',
  footerBg:   '#f1f5f9',
};

const STATUS = {
  success: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d', badge: '#16a34a', headerBg: 'linear-gradient(135deg,#052e16 0%,#14532d 100%)' },
  danger:  { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c', badge: '#dc2626', headerBg: 'linear-gradient(135deg,#3b0000 0%,#7f1d1d 100%)' },
  warning: { bg: '#fffbeb', border: '#fde68a', text: '#92400e', badge: '#d97706', headerBg: 'linear-gradient(135deg,#1c1400 0%,#78350f 100%)' },
  info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#3b82f6', headerBg: 'linear-gradient(135deg,#0f172a 0%,#1a2f4e 60%,#0c3a5e 100%)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function emailWrapper(headerHtml, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<style>
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');
body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
body{margin:0;padding:0;background:${BRAND.pageBg};}
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:'Open Sans',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${BRAND.pageBg};padding:40px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
      <tr>
        <td style="background:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(15,23,42,0.10);">
          ${headerHtml}
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="padding:36px 40px 32px;">${bodyHtml}</td></tr>
          </table>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="background:${BRAND.footerBg};border-top:1px solid ${BRAND.border};padding:20px 40px;">
                <p style="margin:0;font-size:11px;color:${BRAND.textFaint};text-align:center;line-height:1.6;">
                  This is an automated message from <strong>${BRAND.name}</strong>. Please do not reply to this email.<br>
                  If you have questions, contact your HR administrator.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function brandHeader(title, subtitle = '', bg = BRAND.headerBg) {
  const sub = subtitle
    ? `<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.65);font-family:'Open Sans',sans-serif;">${subtitle}</p>`
    : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="background:${bg};padding:40px 40px 36px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="background:${BRAND.accent};width:38px;height:38px;border-radius:9px;text-align:center;vertical-align:middle;">
            <span style="font-family:'Poppins',sans-serif;font-weight:700;font-size:15px;color:#0c1a2e;line-height:38px;display:block;">${BRAND.monogram}</span>
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.16em;color:rgba(255,255,255,0.55);font-family:'Open Sans',sans-serif;">${BRAND.name}</span>
          </td>
        </tr>
      </table>
      <h1 style="margin:22px 0 0;font-family:'Poppins',sans-serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${title}</h1>
      ${sub}
    </td>
  </tr>
</table>`;
}

function ctaButton(href, label, color = BRAND.accentDark) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
  <tr>
    <td style="border-radius:10px;background:${color};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
    </td>
  </tr>
</table>`;
}

function infoCard(rows, bg = STATUS.info.bg, border = STATUS.info.border) {
  const rowHtml = rows.map(r => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid ${border};font-size:13px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;width:140px;vertical-align:top;">${r.label}</td>
      <td style="padding:10px 0;border-bottom:1px solid ${border};font-size:13px;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;font-weight:600;vertical-align:top;">${r.value}</td>
    </tr>`).join('');
  return `
<div style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px 24px;margin:20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowHtml}</table>
</div>`;
}

function noteCard(title, content, bg = BRAND.surface, border = BRAND.border, textColor = BRAND.textBody) {
  return `
<div style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;margin-top:16px;">
  <p style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${title}</p>
  <p style="margin:0;font-size:13px;color:${textColor};line-height:1.65;font-family:'Open Sans',sans-serif;white-space:pre-wrap;">${content}</p>
</div>`;
}

function divider() {
  return `<div style="height:1px;background:${BRAND.border};margin:24px 0;"></div>`;
}

function bodyText(html, mt = '0') {
  return `<p style="margin:${mt} 0 0;font-size:14px;line-height:1.7;color:${BRAND.textBody};font-family:'Open Sans',sans-serif;">${html}</p>`;
}

function statusBadge(label, color, bg, border) {
  return `<span style="display:inline-block;padding:5px 14px;background:${bg};border:1px solid ${border};border-radius:20px;font-size:12px;font-weight:700;color:${color};font-family:'Open Sans',sans-serif;">${label}</span>`;
}

// ─── Brevo send ────────────────────────────────────────────────────────────────
async function sendMail(subject, html, tag) {
  const res = await fetch(`${BASE_URL.replace(/\/$/, '')}/v3/smtp/email`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'api-key': API_KEY,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      sender: { email: SENDER_EMAIL, name: SENDER_NAME },
      to: [{ email: TO }],
      subject,
      htmlContent: html,
    }),
  });

  const body = await res.text().catch(() => '');
  if (!res.ok) {
    console.error(`  ✗ [${tag}] HTTP ${res.status}: ${body}`);
    return false;
  }
  console.log(`  ✓ [${tag}] sent → ${TO}`);
  return true;
}

// ─── Template builders ────────────────────────────────────────────────────────
function buildInviteEmail() {
  const header = brandHeader("You're invited to join the team", 'Your HR system account is ready to activate');
  const body = `
    ${bodyText(`An administrator has created an <strong>${BRAND.name}</strong> account for you. Click the button below to set your password and access your employee portal.`)}
    ${ctaButton('https://example.com/activate?token=TEST123', 'Activate My Account')}
    ${divider()}
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">What you can do once activated</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${[['1','Clock in & out','Track your attendance directly from the portal'],['2','Complete your onboarding','Submit required documents and profile information'],['3','View your schedule & payslips','Access your work schedule and HR records anytime']].map(([n,t,d])=>`
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:28px;"><div style="width:24px;height:24px;background:#eff6ff;border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:${BRAND.accentDark};font-family:'Poppins',sans-serif;">${n}</div></td>
        <td style="padding:8px 0 8px 10px;vertical-align:top;"><p style="margin:0;font-size:13px;color:${BRAND.textPrimary};font-weight:600;font-family:'Open Sans',sans-serif;">${t}</p><p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${d}</p></td>
      </tr>`).join('')}
    </table>
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;"><strong style="color:${BRAND.textBody};">Link expires in 48 hours.</strong> If you did not expect this invitation, you can safely ignore this email.</p>`;
  return emailWrapper(header, body);
}

function buildPasswordResetEmail() {
  const header = brandHeader('Reset your password', 'A password reset was requested for your account');
  const body = `
    ${bodyText('We received a request to reset the password for your <strong>Blues Clues HRIS</strong> account. Click the button below to choose a new password.')}
    ${ctaButton('https://example.com/reset?token=TEST123', 'Reset My Password')}
    ${divider()}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr>
        <td style="width:20px;vertical-align:top;padding-top:2px;"><div style="width:16px;height:16px;background:#fef9c3;border:1px solid #fde68a;border-radius:4px;text-align:center;line-height:16px;font-size:10px;font-weight:700;color:#92400e;">!</div></td>
        <td style="padding-left:10px;vertical-align:top;"><p style="margin:0;font-size:13px;color:${BRAND.textBody};line-height:1.65;font-family:'Open Sans',sans-serif;"><strong>Didn't request this?</strong> Your account is safe — simply ignore this email and your password will remain unchanged. The link expires in <strong>48 hours</strong>.</p></td>
      </tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">For security, never share this link with anyone. If you think your account has been compromised, contact your HR administrator immediately.</p>`;
  return emailWrapper(header, body);
}

function buildVerifyEmail() {
  const header = brandHeader('Verify your email address', 'One quick step to activate your applicant account');
  const body = `
    ${bodyText('Thank you for registering on <strong>Blues Clues HRIS</strong>. Please verify your email address to complete your registration and access job opportunities.')}
    ${ctaButton('https://example.com/verify?token=TEST123', 'Verify My Email')}
    ${divider()}
    <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">This verification link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.</p>`;
  return emailWrapper(header, body);
}

function buildInterviewScheduleEmail() {
  const header = brandHeader('Technical Interview Scheduled', 'Application for Senior Frontend Developer');
  const body = `
    ${bodyText('Hi <strong>Juan dela Cruz</strong>, your <strong>Technical Interview</strong> for <strong>Senior Frontend Developer</strong> has been scheduled. Here are your interview details:')}
    ${infoCard([
      { label: 'Date',        value: 'Wednesday, May 7, 2026' },
      { label: 'Time',        value: '10:00 AM &nbsp;<span style="color:'+BRAND.textMuted+';font-weight:400;">(60 min)</span>' },
      { label: 'Format',      value: 'Video Call' },
      { label: 'Meeting Link',value: '<a href="https://meet.google.com/test-link" style="color:'+BRAND.accentDark+';text-decoration:none;">https://meet.google.com/test-link</a>' },
      { label: 'Interviewer', value: 'Maria Santos <span style="color:'+BRAND.textMuted+';font-weight:400;">· HR Manager</span>' },
    ])}
    ${noteCard('Notes from HR', 'Please prepare a brief portfolio walkthrough (5 minutes). We look forward to speaking with you!')}
    ${divider()}
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Interview tips</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${[['Research the role','Review the job description and prepare examples of relevant experience.'],['Test your setup','Check your camera, microphone, and internet connection ahead of time.'],['Prepare questions','Have 2–3 thoughtful questions ready to ask the interviewer.']].map(([t,d])=>`
      <tr>
        <td style="padding:7px 0;vertical-align:top;width:20px;"><div style="width:8px;height:8px;background:${BRAND.accent};border-radius:50%;margin-top:6px;"></div></td>
        <td style="padding:7px 0 7px 10px;vertical-align:top;"><p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;">${t}</p><p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${d}</p></td>
      </tr>`).join('')}
    </table>
    ${divider()}
    ${bodyText('Log in to your applicant portal to view this schedule, accept or request a reschedule, and track your application status.', '0')}`;
  return emailWrapper(header, body);
}

function buildRescheduleEmail() {
  const header = brandHeader('Technical Interview Rescheduled', 'Application for Senior Frontend Developer');
  const rescheduleNotice = noteCard('Schedule Updated', 'Your interview has been rescheduled by HR. The new details are shown below — please update your calendar.', STATUS.warning.bg, STATUS.warning.border, STATUS.warning.text);
  const body = `
    ${rescheduleNotice}
    ${bodyText('Hi <strong>Juan dela Cruz</strong>, your <strong>Technical Interview</strong> for <strong>Senior Frontend Developer</strong> has been rescheduled. Here are the updated details:')}
    ${infoCard([
      { label: 'New Date',    value: 'Friday, May 9, 2026' },
      { label: 'New Time',    value: '2:00 PM &nbsp;<span style="color:'+BRAND.textMuted+';font-weight:400;">(60 min)</span>' },
      { label: 'Format',      value: 'Video Call' },
      { label: 'Meeting Link',value: '<a href="https://meet.google.com/test-link" style="color:'+BRAND.accentDark+';text-decoration:none;">https://meet.google.com/test-link</a>' },
      { label: 'Interviewer', value: 'Maria Santos <span style="color:'+BRAND.textMuted+';font-weight:400;">· HR Manager</span>' },
    ])}
    ${divider()}
    ${bodyText('Log in to your applicant portal to view your updated schedule.', '0')}`;
  return emailWrapper(header, body);
}

function buildApplicantResponseEmail() {
  const st = STATUS.warning;
  const header = brandHeader('Interview Response Received', 'Juan dela Cruz has responded to their interview invitation');
  const body = `
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin-bottom:20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td>${statusBadge('Requested a Reschedule', st.text, st.bg, st.border)}</td></tr>
        <tr><td style="padding-top:10px;">${bodyText('<strong>Juan dela Cruz</strong> has responded to their interview for <strong>Senior Frontend Developer</strong>.')}</td></tr>
      </table>
    </div>
    ${infoCard([
      { label: 'Applicant', value: 'Juan dela Cruz' },
      { label: 'Email',     value: '<a href="mailto:juan@example.com" style="color:'+BRAND.accentDark+';text-decoration:none;">juan@example.com</a>' },
      { label: 'Position',  value: 'Senior Frontend Developer' },
      { label: 'Scheduled', value: 'Wednesday, May 7, 2026 at 10:00 AM' },
      { label: 'Response',  value: 'Requested a Reschedule' },
    ])}
    ${noteCard('Note from Applicant', 'I have a conflicting commitment that morning. Could we move it to the afternoon?')}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> Log in to the HR portal to propose a new interview time.', '0')}`;
  return emailWrapper(header, body);
}

function buildCancellationEmail() {
  const st = STATUS.danger;
  const header = brandHeader('Interview Cancelled', 'Technical Interview for Senior Frontend Developer');
  const body = `
    ${bodyText('Hi <strong>Juan dela Cruz</strong>, we regret to inform you that your <strong>Technical Interview</strong> for <strong>Senior Frontend Developer</strong> has been cancelled.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Cancelled Interview</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Wednesday, May 7, 2026 &middot; 10:00 AM</p>
    </div>
    ${noteCard('Note from HR', 'We sincerely apologize for the inconvenience. Our team will reach out shortly to reschedule.', STATUS.warning.bg, STATUS.warning.border, STATUS.warning.text)}
    ${divider()}
    <p style="margin:0;font-size:13px;color:${BRAND.textBody};line-height:1.7;font-family:'Open Sans',sans-serif;">Our team will be in touch regarding next steps. If you have urgent questions, please reach out to your HR contact directly. We appreciate your patience and understanding.</p>`;
  return emailWrapper(header, body);
}

function buildOnboardingItemApprovedEmail() {
  const st = STATUS.success;
  const header = brandHeader('Onboarding Item Approved', 'Your submitted document has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your HR team has reviewed one of your onboarding submissions.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Personal Information</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">"Government-Issued ID" — Approved</p>
      <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${st.badge};font-family:'Open Sans',sans-serif;">${statusBadge('Approved', st.text, st.bg, st.border)}</p>
    </div>
    ${noteCard('Note from HR', 'Thank you for submitting a clear, valid ID. Your submission has been accepted.')}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> No action needed. Continue completing your remaining onboarding items — your HR team is reviewing each submission.', '0')}`;
  return emailWrapper(header, body);
}

function buildOnboardingItemRejectedEmail() {
  const st = STATUS.danger;
  const header = brandHeader('Onboarding Item Rejected', 'Your submitted document has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your HR team has reviewed one of your onboarding submissions.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Personal Information</p>
      <p style="margin:0;font-size:16px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">"Government-Issued ID" — Rejected</p>
      <p style="margin:8px 0 0;">${statusBadge('Rejected', st.text, st.bg, st.border)}</p>
    </div>
    ${noteCard('Note from HR', 'The uploaded image was unclear/blurry. Please resubmit a clearer photo of your valid government-issued ID.', STATUS.warning.bg, STATUS.warning.border, STATUS.warning.text)}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> Please log in to your onboarding portal, review the HR note above, correct the issue, and resubmit the item.', '0')}`;
  return emailWrapper(header, body);
}

function buildOnboardingApprovedEmail() {
  const st = STATUS.success;
  const header = brandHeader('Welcome to the team!', 'Your onboarding has been fully approved', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, great news — your onboarding has been reviewed and <strong>approved</strong> by HR. Your employee account is now fully active.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;">
      <p style="margin:0;font-size:32px;color:${st.badge};">&#10003;</p>
      <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Onboarding Complete</p>
    </div>
    ${divider()}
    <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">You now have access to</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      ${[['Employee Dashboard','View your schedule, attendance records, and announcements'],['Timekeeping','Clock in and out, and report absences directly from the portal'],['Documents & Profile','Access your employment documents and manage your profile information']].map(([t,d])=>`
      <tr>
        <td style="padding:8px 0;vertical-align:top;width:10px;"><div style="width:8px;height:8px;background:${st.badge};border-radius:50%;margin-top:5px;"></div></td>
        <td style="padding:8px 0 8px 12px;vertical-align:top;"><p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;">${t}</p><p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${d}</p></td>
      </tr>`).join('')}
    </table>`;
  return emailWrapper(header, body);
}

function buildProfileChangeApprovedEmail() {
  const st = STATUS.success;
  const header = brandHeader('Legal Name Change Approved', 'Your profile update request has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your request to update your <strong>Legal Name</strong> has been reviewed by HR.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Profile Change</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Legal Name &mdash; Approved</p>
    </div>
    ${noteCard('Note from HR', 'Your legal name has been updated in our system. If there are any discrepancies, please contact HR.')}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> Your updated information is now reflected on your employee profile. No further action is needed.', '0')}`;
  return emailWrapper(header, body);
}

function buildProfileChangeRejectedEmail() {
  const st = STATUS.danger;
  const header = brandHeader('Bank Account Change Rejected', 'Your profile update request has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your request to update your <strong>Bank Account</strong> has been reviewed by HR.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Profile Change</p>
      <p style="margin:0;font-size:15px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Bank Account &mdash; Rejected</p>
    </div>
    ${noteCard('Note from HR', 'The bank account number provided could not be verified. Please resubmit with a clear photo of your bank passbook or certificate.')}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> You may log in to your employee portal and submit a new request with the correct information.', '0')}`;
  return emailWrapper(header, body);
}

function buildAbsenceApprovedEmail() {
  const st = STATUS.success;
  const header = brandHeader('Absence Request Approved', 'Your absence request has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your absence request has been reviewed by HR.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td>${statusBadge('Approved', st.text, st.bg, st.border)}</td></tr>
        <tr><td style="padding-top:10px;"><p style="margin:0;font-size:14px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Emergency Leave</p><p style="margin:4px 0 0;font-size:13px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Friday, April 25, 2026</p></td></tr>
      </table>
    </div>
    ${infoCard([
      { label: 'Date',        value: 'Friday, April 25, 2026' },
      { label: 'Reason',      value: 'Emergency Leave' },
      { label: 'Reviewed by', value: 'HR Manager · Anna Reyes' },
      { label: 'Decision',    value: 'Approved' },
    ], st.bg, st.border)}
    ${noteCard('Note from HR', 'Approved. Please take care and coordinate with your team regarding any pending tasks.')}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> Your absence has been excused. This will be reflected in your attendance record.', '0')}`;
  return emailWrapper(header, body);
}

function buildAbsenceDeniedEmail() {
  const st = STATUS.danger;
  const header = brandHeader('Absence Request Denied', 'Your absence request has been reviewed', st.headerBg);
  const body = `
    ${bodyText('Hi <strong>Maria Santos</strong>, your absence request has been reviewed by HR.')}
    <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr><td>${statusBadge('Denied', st.text, st.bg, st.border)}</td></tr>
        <tr><td style="padding-top:10px;"><p style="margin:0;font-size:14px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">Personal Leave</p><p style="margin:4px 0 0;font-size:13px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Monday, April 28, 2026</p></td></tr>
      </table>
    </div>
    ${infoCard([
      { label: 'Date',        value: 'Monday, April 28, 2026' },
      { label: 'Reason',      value: 'Personal Leave' },
      { label: 'Reviewed by', value: 'HR Manager · Anna Reyes' },
      { label: 'Decision',    value: 'Denied' },
    ], st.bg, st.border)}
    ${noteCard('Note from HR', 'We are unable to approve this absence due to a critical project deadline that week. Please coordinate with your manager if you need to discuss alternatives.', STATUS.warning.bg, STATUS.warning.border, STATUS.warning.text)}
    ${divider()}
    ${bodyText('<strong>Next step:</strong> If you believe this is incorrect, please contact your HR administrator directly.', '0')}`;
  return emailWrapper(header, body);
}

// ─── Send all ──────────────────────────────────────────────────────────────────
const emails = [
  ['Account Invitation – Blues Clues HRIS [TEST]',                     buildInviteEmail(),                  'invite'],
  ['Password Reset – Blues Clues HRIS [TEST]',                          buildPasswordResetEmail(),           'password-reset'],
  ['Verify Your Email – Blues Clues HRIS [TEST]',                       buildVerifyEmail(),                  'verify-email'],
  ['Technical Interview Scheduled – Senior Frontend Developer [TEST]',   buildInterviewScheduleEmail(),       'interview-scheduled'],
  ['Technical Interview Rescheduled – Senior Frontend Developer [TEST]', buildRescheduleEmail(),              'interview-rescheduled'],
  ['Juan dela Cruz Requested a Reschedule – Sr. Frontend Dev [TEST]',    buildApplicantResponseEmail(),       'applicant-response'],
  ['Interview Cancelled – Senior Frontend Developer [TEST]',             buildCancellationEmail(),            'interview-cancelled'],
  ['Onboarding Item Approved – Government ID [TEST]',                    buildOnboardingItemApprovedEmail(),  'onboarding-item-approved'],
  ['Onboarding Item Rejected – Government ID [TEST]',                    buildOnboardingItemRejectedEmail(),  'onboarding-item-rejected'],
  ['Your Onboarding is Complete – Welcome! [TEST]',                      buildOnboardingApprovedEmail(),      'onboarding-approved'],
  ['Legal Name Change Approved [TEST]',                                  buildProfileChangeApprovedEmail(),   'profile-approved'],
  ['Bank Account Change Rejected [TEST]',                                buildProfileChangeRejectedEmail(),   'profile-rejected'],
  ['Absence Request Approved – Apr 25, 2026 [TEST]',                    buildAbsenceApprovedEmail(),         'absence-approved'],
  ['Absence Request Denied – Apr 28, 2026 [TEST]',                      buildAbsenceDeniedEmail(),           'absence-denied'],
];

console.log(`\n📧  Sending ${emails.length} test emails → ${TO}\n`);

let passed = 0;
let failed = 0;

for (const [subject, html, tag] of emails) {
  const ok = await sendMail(subject, html, tag);
  if (ok) passed++; else failed++;
  // 200ms gap to stay within Brevo rate limits
  await new Promise(r => setTimeout(r, 200));
}

console.log(`\n${'─'.repeat(50)}`);
console.log(`  Sent: ${passed}/${emails.length}  |  Failed: ${failed}`);
console.log(`${'─'.repeat(50)}\n`);
