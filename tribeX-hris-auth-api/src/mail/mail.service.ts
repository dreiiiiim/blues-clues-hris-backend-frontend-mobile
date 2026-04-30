import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type SendMailOptions = {
  from?: string;
  to: string;
  subject: string;
  html: string;
};

// ─── Shared design tokens ─────────────────────────────────────────────────────
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
  info:    { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', badge: '#3b82f6', headerBg: BRAND.headerBg },
};

function emailWrapper(headerHtml: string, bodyHtml: string, footerExtra = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1.0" />
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<style>
  @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;500;600;700&family=Poppins:wght@600;700&display=swap');
  body,table,td,a{-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table,td{mso-table-lspace:0;mso-table-rspace:0;}
  img{-ms-interpolation-mode:bicubic;border:0;outline:none;text-decoration:none;}
  body{margin:0;padding:0;background:${BRAND.pageBg};}
  @media screen and (max-width:600px){
    .email-outer-padding{padding:20px 10px !important;}
    .email-body-padding{padding:24px 20px !important;}
    .email-header-padding{padding:28px 24px 24px !important;}
    .email-footer{padding:16px 20px !important;}
    .email-title{font-size:22px !important;}
    .email-card-wrap{border-radius:10px !important;}
  }
  @media screen and (prefers-color-scheme:dark){
    .email-bg{background-color:#0f172a !important;}
    .email-card-wrap{background-color:#1e293b !important;box-shadow:0 4px 32px rgba(0,0,0,0.5) !important;}
    .email-body-padding{background-color:#1e293b !important;}
    .email-footer{background-color:#0f172a !important;border-top-color:#334155 !important;}
    .email-text-primary{color:#f1f5f9 !important;}
    .email-text-body{color:#cbd5e1 !important;}
    .email-text-muted{color:#94a3b8 !important;}
    .email-text-faint{color:#64748b !important;}
    .email-divider{background:#334155 !important;}
    .email-info-card{background-color:#162032 !important;border-color:#334155 !important;}
    .email-note-card{background-color:#1a2535 !important;border-color:#334155 !important;}
    .email-badge-label{color:#94a3b8 !important;}
  }
</style>
</head>
<body style="margin:0;padding:0;background:${BRAND.pageBg};font-family:'Open Sans',Helvetica,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="email-bg email-outer-padding" style="background:${BRAND.pageBg};padding:40px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <!-- Card -->
        <tr>
          <td class="email-card-wrap" style="background:${BRAND.cardBg};border-radius:16px;overflow:hidden;box-shadow:0 4px 32px rgba(15,23,42,0.10);">
            <!-- Header -->
            ${headerHtml}
            <!-- Body -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr><td class="email-body-padding" style="padding:36px 40px 32px;">${bodyHtml}</td></tr>
            </table>
            <!-- Footer -->
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td class="email-footer email-footer-padding" style="background:${BRAND.footerBg};border-top:1px solid ${BRAND.border};padding:20px 40px;">
                  ${footerExtra}
                  <p class="email-text-faint" style="margin:0;font-size:11px;color:${BRAND.textFaint};text-align:center;line-height:1.6;">
                    This is an automated message from <strong>${BRAND.name}</strong>. Please do not reply to this email.<br>
                    If you have questions, contact your HR administrator.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function brandHeader(title: string, subtitle?: string, bg = BRAND.headerBg) {
  const sub = subtitle
    ? `<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.65);font-family:'Open Sans',sans-serif;">${subtitle}</p>`
    : '';
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td class="email-header-padding" style="background:${bg};padding:40px 40px 36px;">
      <!-- Wordmark row -->
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
      <!-- Title -->
      <h1 class="email-title" style="margin:22px 0 0;font-family:'Poppins',sans-serif;font-size:26px;font-weight:700;color:#ffffff;line-height:1.25;">${title}</h1>
      ${sub}
    </td>
  </tr>
</table>`;
}

function ctaButton(href: string, label: string, color = BRAND.accentDark) {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:28px auto 0;">
  <tr>
    <td style="border-radius:10px;background:${color};">
      <a href="${href}" target="_blank" style="display:inline-block;padding:14px 36px;font-family:'Poppins',sans-serif;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:10px;letter-spacing:0.01em;">${label}</a>
    </td>
  </tr>
</table>`;
}

function infoCard(rows: { label: string; value: string }[], bg = STATUS.info.bg, border = STATUS.info.border) {
  const rowHtml = rows.map(r => `
    <tr>
      <td class="email-text-muted" style="padding:10px 0;border-bottom:1px solid ${border};font-size:13px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;width:140px;vertical-align:top;">${r.label}</td>
      <td class="email-text-primary" style="padding:10px 0;border-bottom:1px solid ${border};font-size:13px;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;font-weight:600;vertical-align:top;">${r.value}</td>
    </tr>`).join('');
  return `
<div class="email-info-card" style="background:${bg};border:1px solid ${border};border-radius:12px;padding:20px 24px;margin:20px 0;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rowHtml}</table>
</div>`;
}

function noteCard(title: string, content: string, bg = BRAND.surface, border = BRAND.border, textColor = BRAND.textBody) {
  return `
<div class="email-note-card" style="background:${bg};border:1px solid ${border};border-radius:10px;padding:16px 20px;margin-top:16px;">
  <p class="email-badge-label" style="margin:0 0 6px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${title}</p>
  <p class="email-text-body" style="margin:0;font-size:13px;color:${textColor};line-height:1.65;font-family:'Open Sans',sans-serif;white-space:pre-wrap;">${content}</p>
</div>`;
}

function statusBadge(label: string, color: string, bg: string, border: string) {
  return `<span style="display:inline-block;padding:5px 14px;background:${bg};border:1px solid ${border};border-radius:20px;font-size:12px;font-weight:700;color:${color};font-family:'Open Sans',sans-serif;letter-spacing:0.04em;">${label}</span>`;
}

function divider() {
  return `<div class="email-divider" style="height:1px;background:${BRAND.border};margin:24px 0;"></div>`;
}

function bodyText(html: string, mt = '0') {
  return `<p class="email-text-body" style="margin:${mt} 0 0;font-size:14px;line-height:1.7;color:${BRAND.textBody};font-family:'Open Sans',sans-serif;">${html}</p>`;
}

// ─── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class MailService {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly senderEmail: string;
  private readonly senderName: string;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('BREVO_API_KEY') ?? '';
    this.baseUrl = this.config.get<string>('BREVO_BASE_URL') ?? 'https://api.brevo.com';
    this.senderEmail = this.config.get<string>('BREVO_SENDER_EMAIL') ?? '';
    this.senderName = this.config.get<string>('BREVO_SENDER_NAME') ?? 'Blues Clues HRIS';
    this.timeoutMs = Number(this.config.get<string>('BREVO_TIMEOUT_MS') ?? 15000);

    this.from = `"${this.senderName}" <${this.senderEmail}>`;

    if (!this.apiKey || !this.senderEmail) {
      this.logger.warn('Brevo email is not fully configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL.');
    }
  }

  private async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.apiKey || !this.senderEmail) {
      throw new Error('Brevo email is not configured');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl.replace(/\/$/, '')}/v3/smtp/email`, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'api-key': this.apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            email: this.senderEmail,
            name: this.senderName,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Brevo send failed with HTTP ${response.status}: ${body}`);
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  // ─── Invite ─────────────────────────────────────────────────────────────────

  async sendInvite(to: string, inviteLink: string) {
    try {
      const header = brandHeader(
        "You're invited to join the team",
        'Your HR system account is ready to activate',
      );

      const body = `
        ${bodyText(`An administrator has created an <strong>${BRAND.name}</strong> account for you. Click the button below to set your password and access your employee portal.`)}

        ${ctaButton(inviteLink, 'Activate My Account')}

        ${divider()}

        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">What you can do once activated</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;background:#eff6ff;border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:${BRAND.accentDark};font-family:'Poppins',sans-serif;">1</div>
            </td>
            <td style="padding:8px 0 8px 10px;vertical-align:top;">
              <p style="margin:0;font-size:13px;color:${BRAND.textPrimary};font-weight:600;font-family:'Open Sans',sans-serif;">Clock in &amp; out</p>
              <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Track your attendance directly from the portal</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;background:#eff6ff;border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:${BRAND.accentDark};font-family:'Poppins',sans-serif;">2</div>
            </td>
            <td style="padding:8px 0 8px 10px;vertical-align:top;">
              <p style="margin:0;font-size:13px;color:${BRAND.textPrimary};font-weight:600;font-family:'Open Sans',sans-serif;">Complete your onboarding</p>
              <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Submit required documents and profile information</p>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 0;vertical-align:top;width:28px;">
              <div style="width:24px;height:24px;background:#eff6ff;border-radius:6px;text-align:center;line-height:24px;font-size:11px;font-weight:700;color:${BRAND.accentDark};font-family:'Poppins',sans-serif;">3</div>
            </td>
            <td style="padding:8px 0 8px 10px;vertical-align:top;">
              <p style="margin:0;font-size:13px;color:${BRAND.textPrimary};font-weight:600;font-family:'Open Sans',sans-serif;">View your schedule &amp; payslips</p>
              <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Access your work schedule and HR records anytime</p>
            </td>
          </tr>
        </table>

        ${divider()}

        <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">
          <strong style="color:${BRAND.textBody};">Link expires in 48 hours.</strong> If you did not expect this invitation, you can safely ignore this email — no account will be created without activation.
        </p>`;

      await this.sendMail({
        from: this.from,
        to,
        subject: `You're invited to ${BRAND.name}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send invite email', error);
      throw new Error('Failed to send invite email');
    }
  }

  // ─── Password Reset ──────────────────────────────────────────────────────────

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    try {
      const header = brandHeader(
        'Reset your password',
        'A password reset was requested for your account',
      );

      const body = `
        ${bodyText('We received a request to reset the password for your <strong>Blues Clues HRIS</strong> account. Click the button below to choose a new password.')}

        ${ctaButton(resetLink, 'Reset My Password')}

        ${divider()}

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="width:20px;vertical-align:top;padding-top:2px;">
              <div style="width:16px;height:16px;background:#fef9c3;border:1px solid #fde68a;border-radius:4px;text-align:center;line-height:16px;font-size:10px;font-weight:700;color:#92400e;">!</div>
            </td>
            <td style="padding-left:10px;vertical-align:top;">
              <p style="margin:0;font-size:13px;color:${BRAND.textBody};line-height:1.65;font-family:'Open Sans',sans-serif;">
                <strong>Didn't request this?</strong> Your account is safe — simply ignore this email and your password will remain unchanged. The link expires in <strong>48 hours</strong>.
              </p>
            </td>
          </tr>
        </table>

        <p style="margin:16px 0 0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">
          For security, never share this link with anyone. If you think your account has been compromised, contact your HR administrator immediately.
        </p>`;

      await this.sendMail({
        from: this.from,
        to,
        subject: `Reset your ${BRAND.name} password`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
      throw new Error('Failed to send password reset email');
    }
  }

  // ─── Verify Email ────────────────────────────────────────────────────────────


  async sendRegistrationConfirmation(to: string, companyName: string): Promise<void> {
    try {
      const header = brandHeader(
        'Registration Received',
        "We've received your company registration",
      );

      const body = `
        ${bodyText(`Thank you for registering <strong>${companyName}</strong> on <strong>${BRAND.name}</strong>. Your registration has been received and is under review.`)}

        ${infoCard([
          { label: 'Company', value: companyName },
          { label: 'Status', value: 'Under Review' },
          { label: 'Next Step', value: 'Select a subscription plan and complete payment' },
        ])}

        ${divider()}

        <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">
          Once you complete payment, your System Admin credentials will be sent to this email address. Keep it secure.
        </p>`;

      await this.sendMail({
        from: this.from,
        to,
        subject: `Registration received - ${BRAND.name}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send registration confirmation email', error);
      throw new Error('Failed to send registration confirmation email');
    }
  }

  async sendPaymentConfirmation(
    to: string,
    companyName: string,
    plan: string | null,
  ): Promise<void> {
    try {
      const appUrl = this.config.get<string>('APP_URL') ?? 'http://localhost:3000';

      const header = brandHeader(
        'Payment Confirmed',
        'Your subscription is now active',
        STATUS.success.headerBg,
      );

      const planLabel =
        plan === 'annual'
          ? 'Annual Plan'
          : plan === 'monthly'
            ? 'Monthly Plan'
            : 'Standard Plan';

      const body = `
        ${bodyText(`Congratulations! Payment for <strong>${companyName}</strong> has been confirmed. Your <strong>${BRAND.name}</strong> subscription is now active.`)}

        ${infoCard([
          { label: 'Company', value: companyName },
          { label: 'Plan', value: planLabel },
          { label: 'Status', value: 'Active' },
        ], STATUS.success.bg, STATUS.success.border)}

        ${bodyText('Your System Admin credentials are being sent in a separate email. Use them to log in and configure your HR system.', '16px')}

        ${ctaButton(`${appUrl}/login`, 'Go to Login', STATUS.success.badge)}

        ${divider()}

        <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">
          If you did not initiate this subscription or have any concerns, contact support immediately.
        </p>`;

      await this.sendMail({
        from: this.from,
        to,
        subject: `Payment confirmed - ${BRAND.name}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send payment confirmation email', error);
      throw new Error('Failed to send payment confirmation email');
    }
  }

  async sendSystemAdminCredentials(to: string, inviteLink: string): Promise<void> {
    try {
      const header = brandHeader(
        'System Admin Account Created',
        'Set your password to get started',
      );

      const body = `
        ${bodyText(`A System Admin account has been created for your company on <strong>${BRAND.name}</strong>. Click the button below to set your password and access the admin dashboard.`)}

        ${ctaButton(inviteLink, 'Set My Password')}

        ${noteCard(
          'Security Notice',
          'This link expires in 48 hours. Do not share it with anyone. Each link can only be used once.',
          STATUS.warning.bg,
          STATUS.warning.border,
          STATUS.warning.text,
        )}

        ${divider()}

        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">As System Admin you can</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${[
            ['Create HR, Manager & Employee accounts', 'Set up your team and assign roles'],
            ['Configure HR modules', 'Enable or disable Recruitment, Onboarding, C&B, Performance, Offboarding'],
            ['Set tenant settings', 'Configure timezone, currency, date format, and org structure'],
            ['Manage RBAC', 'Define exactly what each role can access per module'],
          ]
            .map(
              ([title, desc]) => `
            <tr>
              <td style="padding:8px 0;vertical-align:top;width:28px;">
                <div style="width:8px;height:8px;background:${BRAND.accent};border-radius:50%;margin-top:6px;"></div>
              </td>
              <td style="padding:8px 0 8px 10px;vertical-align:top;">
                <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;">${title}</p>
                <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${desc}</p>
              </td>
            </tr>`,
            )
            .join('')}
        </table>`;

      await this.sendMail({
        from: this.from,
        to,
        subject: `Your System Admin credentials - ${BRAND.name}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send System Admin credentials email', error);
      throw new Error('Failed to send System Admin credentials email');
    }
  }
  async sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
    const header = brandHeader(
      'Verify your email address',
      'One quick step to activate your applicant account',
    );

    const body = `
      ${bodyText('Thank you for registering on <strong>Blues Clues HRIS</strong>. Please verify your email address to complete your registration and access job opportunities.')}

      ${ctaButton(verifyLink, 'Verify My Email')}

      ${divider()}

      <p style="margin:0;font-size:12px;color:${BRAND.textMuted};line-height:1.6;font-family:'Open Sans',sans-serif;">
        This verification link expires in <strong>24 hours</strong>. If you did not create an account, you can safely ignore this email.
      </p>`;

    await this.sendMail({
      from: this.from,
      to,
      subject: `Verify your email – ${BRAND.name}`,
      html: emailWrapper(header, body),
    });
  }

  // ─── Interview Schedule ──────────────────────────────────────────────────────

  async sendInterviewScheduleEmail(opts: {
    to: string;
    applicantName: string;
    jobTitle: string;
    stageLabel?: string;
    isReschedule?: boolean;
    scheduledDate: string;
    scheduledTime: string;
    durationMinutes: number;
    format: string;
    location?: string | null;
    meetingLink?: string | null;
    interviewerName: string;
    interviewerTitle?: string | null;
    notes?: string | null;
  }): Promise<void> {
    const formatLabel: Record<string, string> = {
      in_person: 'In-Person',
      video:     'Video Call',
      phone:     'Phone Call',
    };

    const fmtDate = new Date(`${opts.scheduledDate}T${opts.scheduledTime}`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmtTime = new Date(`2000-01-01T${opts.scheduledTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    const action      = opts.isReschedule ? 'Rescheduled' : 'Scheduled';
    const stagePrefix = opts.stageLabel ? `${opts.stageLabel} ` : '';
    const subjectLine = `${stagePrefix}Interview ${action} – ${opts.jobTitle}`;
    const headerTitle = opts.stageLabel
      ? `${opts.stageLabel} Interview ${action}`
      : `Interview ${action}`;

    const locationValue = opts.meetingLink
      ? `<a href="${opts.meetingLink}" style="color:${BRAND.accentDark};text-decoration:none;">${opts.meetingLink}</a>`
      : opts.location ?? '—';

    const detailRows = [
      { label: 'Date', value: fmtDate },
      { label: 'Time', value: `${fmtTime} &nbsp;<span style="color:${BRAND.textMuted};font-weight:400;">(${opts.durationMinutes} min)</span>` },
      { label: 'Format', value: formatLabel[opts.format] ?? opts.format },
      ...(opts.meetingLink || opts.location
        ? [{ label: opts.meetingLink ? 'Meeting Link' : 'Location', value: locationValue }]
        : []),
      {
        label: 'Interviewer',
        value: opts.interviewerTitle
          ? `${opts.interviewerName} <span style="color:${BRAND.textMuted};font-weight:400;">· ${opts.interviewerTitle}</span>`
          : opts.interviewerName,
      },
    ];

    const rescheduleNotice = opts.isReschedule
      ? noteCard(
          'Schedule Updated',
          'Your interview has been rescheduled by HR. The new details are shown below — please update your calendar.',
          STATUS.warning.bg,
          STATUS.warning.border,
          STATUS.warning.text,
        )
      : '';

    const notesSection = opts.notes
      ? noteCard('Notes from HR', opts.notes)
      : '';

    const prepSection = !opts.isReschedule
      ? `
        ${divider()}
        <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">Interview tips</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          ${[
            ['Research the role', 'Review the job description and prepare examples of relevant experience.'],
            ['Test your setup', opts.format === 'video' ? 'Check your camera, microphone, and internet connection ahead of time.' : opts.format === 'phone' ? 'Ensure you are in a quiet location with good reception at the scheduled time.' : 'Plan your route and aim to arrive 10–15 minutes early.'],
            ['Prepare questions', 'Have 2–3 thoughtful questions ready to ask the interviewer.'],
          ].map(([title, desc]) => `
          <tr>
            <td style="padding:7px 0;vertical-align:top;width:20px;">
              <div style="width:6px;height:6px;background:${BRAND.accent};border-radius:50%;margin-top:6px;"></div>
            </td>
            <td style="padding:7px 0 7px 10px;vertical-align:top;">
              <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;">${title}</p>
              <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${desc}</p>
            </td>
          </tr>`).join('')}
        </table>`
      : '';

    const header = brandHeader(headerTitle, `Application for ${opts.jobTitle}`);

    const body = `
      ${rescheduleNotice}
      ${bodyText(`Hi <strong>${opts.applicantName}</strong>, your <strong>${opts.stageLabel ?? 'interview'}</strong> for <strong>${opts.jobTitle}</strong> has been ${opts.isReschedule ? 'rescheduled' : 'scheduled'}. Here are your interview details:`)}
      ${infoCard(detailRows)}
      ${notesSection}
      ${prepSection}
      ${divider()}
      ${bodyText(`Log in to your applicant portal to view this schedule, accept or request a reschedule, and track your application status.`, '0')}`;

    await this.sendMail({
      from: this.from,
      to: opts.to,
      subject: subjectLine,
      html: emailWrapper(header, body),
    });
  }

  // ─── Applicant Response (to HR) ──────────────────────────────────────────────

  async sendApplicantResponseEmail(opts: {
    to: string;
    applicantName: string;
    applicantEmail: string;
    jobTitle: string;
    action: 'accepted' | 'declined' | 'reschedule_requested';
    note?: string | null;
    scheduledDate: string;
    scheduledTime: string;
  }): Promise<void> {
    const actionLabel = {
      accepted:             'Accepted the Interview',
      declined:             'Declined the Interview',
      reschedule_requested: 'Requested a Reschedule',
    }[opts.action];

    const st = opts.action === 'accepted'
      ? STATUS.success
      : opts.action === 'declined'
      ? STATUS.danger
      : STATUS.warning;

    const fmtDate = new Date(`${opts.scheduledDate}T${opts.scheduledTime}`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmtTime = new Date(`2000-01-01T${opts.scheduledTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    const noteSection = opts.note
      ? noteCard('Note from Applicant', opts.note)
      : '';

    const nextSteps = {
      accepted:             'No action needed — the interview proceeds as scheduled.',
      declined:             'You may close this application or reach out to discuss alternatives.',
      reschedule_requested: 'Log in to the HR portal to propose a new interview time.',
    }[opts.action];

    const header = brandHeader('Interview Response Received', `${opts.applicantName} has responded to their interview invitation`);

    const body = `
      <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin-bottom:20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:top;padding-right:14px;">
              ${statusBadge(actionLabel, st.text, st.bg, st.border)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:10px;">
              ${bodyText(`<strong>${opts.applicantName}</strong> has responded to their interview for <strong>${opts.jobTitle}</strong>.`)}
            </td>
          </tr>
        </table>
      </div>

      ${infoCard([
        { label: 'Applicant',       value: opts.applicantName },
        { label: 'Email',           value: `<a href="mailto:${opts.applicantEmail}" style="color:${BRAND.accentDark};text-decoration:none;">${opts.applicantEmail}</a>` },
        { label: 'Position',        value: opts.jobTitle },
        { label: 'Scheduled',       value: `${fmtDate} at ${fmtTime}` },
        { label: 'Response',        value: actionLabel },
      ])}

      ${noteSection}

      ${divider()}

      ${bodyText(`<strong>Next step:</strong> ${nextSteps}`, '0')}`;

    await this.sendMail({
      from: this.from,
      to: opts.to,
      subject: `${opts.applicantName} ${actionLabel} — ${opts.jobTitle}`,
      html: emailWrapper(header, body),
    });
  }

  // ─── Interview Cancellation ──────────────────────────────────────────────────

  async sendInterviewCancellationEmail(opts: {
    to: string;
    applicantName: string;
    jobTitle: string;
    scheduledDate: string;
    scheduledTime: string;
    stageLabel: string;
    reason?: string | null;
  }): Promise<void> {
    const fmtDate = new Date(`${opts.scheduledDate}T${opts.scheduledTime}`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmtTime = new Date(`2000-01-01T${opts.scheduledTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    const reasonSection = opts.reason
      ? noteCard('Note from HR', opts.reason, STATUS.warning.bg, STATUS.warning.border, STATUS.warning.text)
      : '';

    const header = brandHeader('Interview Cancelled', `${opts.stageLabel} for ${opts.jobTitle}`);

    const body = `
      ${bodyText(`Hi <strong>${opts.applicantName}</strong>, we regret to inform you that your <strong>${opts.stageLabel}</strong> for <strong>${opts.jobTitle}</strong> has been cancelled.`)}

      <div style="background:${STATUS.danger.bg};border:1px solid ${STATUS.danger.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${STATUS.danger.badge};font-family:'Open Sans',sans-serif;">Cancelled Interview</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:${STATUS.danger.text};font-family:'Poppins',sans-serif;">${fmtDate} &middot; ${fmtTime}</p>
      </div>

      ${reasonSection}

      ${divider()}

      <p style="margin:0;font-size:13px;color:${BRAND.textBody};line-height:1.7;font-family:'Open Sans',sans-serif;">
        Our team will be in touch regarding next steps. If you have urgent questions, please reach out to your HR contact directly. We appreciate your patience and understanding.
      </p>`;

    await this.sendMail({
      from: this.from,
      to: opts.to,
      subject: `Interview Cancelled – ${opts.jobTitle}`,
      html: emailWrapper(header, body),
    });
  }

  // ─── Onboarding Item Reviewed ────────────────────────────────────────────────

  async sendOnboardingItemReviewedEmail(opts: {
    to: string;
    employeeName: string;
    itemTitle: string;
    tabCategory: string;
    status: 'approved' | 'rejected';
    remarks?: string | null;
  }): Promise<void> {
    const isApproved   = opts.status === 'approved';
    const st           = isApproved ? STATUS.success : STATUS.danger;
    const statusLabel  = isApproved ? 'Approved' : 'Rejected';

    const remarksSection = opts.remarks
      ? noteCard('Note from HR', opts.remarks, isApproved ? STATUS.success.bg : STATUS.warning.bg, isApproved ? STATUS.success.border : STATUS.warning.border)
      : '';

    const nextStepText = isApproved
      ? 'No action needed. Continue completing your remaining onboarding items — your HR team is reviewing each submission.'
      : 'Please log in to your onboarding portal, review the HR note above, correct the issue, and resubmit the item.';

    const header = brandHeader(
      `Onboarding Item ${statusLabel}`,
      'Your submitted document has been reviewed',
      st.headerBg,
    );

    const body = `
      ${bodyText(`Hi <strong>${opts.employeeName}</strong>, your HR team has reviewed one of your onboarding submissions.`)}

      <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">${opts.tabCategory}</p>
        <p style="margin:0;font-size:16px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">"${opts.itemTitle}"</p>
        <p style="margin:8px 0 0;font-size:13px;font-weight:600;color:${st.badge};font-family:'Open Sans',sans-serif;">
          ${statusBadge(statusLabel, st.text, st.bg, st.border)}
        </p>
      </div>

      ${remarksSection}

      ${divider()}

      ${bodyText(`<strong>Next step:</strong> ${nextStepText}`, '0')}`;

    try {
      await this.sendMail({
        from: this.from,
        to: opts.to,
        subject: `Onboarding Update: "${opts.itemTitle}" has been ${statusLabel}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send onboarding item reviewed email', error);
    }
  }

  // ─── Onboarding Approved ─────────────────────────────────────────────────────

  async sendOnboardingApprovedEmail(opts: {
    to: string;
    employeeName: string;
  }): Promise<void> {
    const header = brandHeader(
      'Welcome to the team!',
      'Your onboarding has been fully approved',
      STATUS.success.headerBg,
    );

    const body = `
      ${bodyText(`Hi <strong>${opts.employeeName}</strong>, great news — your onboarding has been reviewed and <strong>approved</strong> by HR. Your employee account is now fully active.`)}

      <div style="background:${STATUS.success.bg};border:1px solid ${STATUS.success.border};border-radius:12px;padding:20px 24px;margin:20px 0;text-align:center;">
        <p style="margin:0;font-size:32px;">&#10003;</p>
        <p style="margin:8px 0 0;font-size:16px;font-weight:600;color:${STATUS.success.text};font-family:'Poppins',sans-serif;">Onboarding Complete</p>
      </div>

      ${divider()}

      <p style="margin:0 0 12px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">You now have access to</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${[
          ['Employee Dashboard',  'View your schedule, attendance records, and announcements'],
          ['Timekeeping',         'Clock in and out, and report absences directly from the portal'],
          ['Documents & Profile', 'Access your employment documents and manage your profile information'],
        ].map(([title, desc]) => `
        <tr>
          <td style="padding:8px 0;vertical-align:top;width:10px;">
            <div style="width:8px;height:8px;background:${STATUS.success.badge};border-radius:50%;margin-top:5px;"></div>
          </td>
          <td style="padding:8px 0 8px 12px;vertical-align:top;">
            <p style="margin:0;font-size:13px;font-weight:600;color:${BRAND.textPrimary};font-family:'Open Sans',sans-serif;">${title}</p>
            <p style="margin:2px 0 0;font-size:12px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${desc}</p>
          </td>
        </tr>`).join('')}
      </table>`;

    try {
      await this.sendMail({
        from: this.from,
        to: opts.to,
        subject: 'Your onboarding is complete — Welcome to the team!',
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send onboarding approved email', error);
    }
  }

  // ─── Profile Change Reviewed ─────────────────────────────────────────────────

  async sendProfileChangeReviewedEmail(opts: {
    to: string;
    employeeName: string;
    fieldType: 'legal_name' | 'bank';
    status: 'approved' | 'rejected';
    reviewReason: string;
  }): Promise<void> {
    const fieldLabel  = opts.fieldType === 'legal_name' ? 'Legal Name' : 'Bank Account';
    const isApproved  = opts.status === 'approved';
    const statusLabel = isApproved ? 'Approved' : 'Rejected';
    const st          = isApproved ? STATUS.success : STATUS.danger;

    const nextStep = isApproved
      ? 'Your updated information is now reflected on your employee profile. No further action is needed.'
      : 'You may log in to your employee portal and submit a new request with the correct information.';

    const header = brandHeader(
      `${fieldLabel} Change ${statusLabel}`,
      'Your profile update request has been reviewed',
      st.headerBg,
    );

    const body = `
      ${bodyText(`Hi <strong>${opts.employeeName}</strong>, your request to update your <strong>${fieldLabel}</strong> has been reviewed by HR.`)}

      <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:${st.badge};font-family:'Open Sans',sans-serif;">Profile Change</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">${fieldLabel} &mdash; ${statusLabel}</p>
      </div>

      ${opts.reviewReason ? noteCard('Note from HR', opts.reviewReason) : ''}

      ${divider()}

      ${bodyText(`<strong>Next step:</strong> ${nextStep}`, '0')}`;

    try {
      await this.sendMail({
        from: this.from,
        to: opts.to,
        subject: `Your ${fieldLabel} change request has been ${statusLabel}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send profile change reviewed email', error);
    }
  }

  // ─── Absence Review ──────────────────────────────────────────────────────────

  async sendAbsenceReviewEmail(opts: {
    to: string;
    employeeName: string;
    reviewerName: string;
    action: 'APPROVED' | 'DENIED';
    absenceDate: string;
    absenceReason: string;
    reviewNote?: string | null;
  }): Promise<void> {
    const isApproved  = opts.action === 'APPROVED';
    const actionLabel = isApproved ? 'Approved' : 'Denied';
    const st          = isApproved ? STATUS.success : STATUS.danger;

    const fmtDate = new Date(`${opts.absenceDate}T12:00:00`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    const reviewNoteSection = opts.reviewNote
      ? noteCard('Note from HR', opts.reviewNote)
      : '';

    const nextStep = isApproved
      ? 'Your absence has been excused. This will be reflected in your attendance record.'
      : 'If you believe this is incorrect, please contact your HR administrator directly.';

    const header = brandHeader(
      `Absence Request ${actionLabel}`,
      'Your absence request has been reviewed',
      st.headerBg,
    );

    const body = `
      ${bodyText(`Hi <strong>${opts.employeeName}</strong>, your absence request has been reviewed by HR.`)}

      <div style="background:${st.bg};border:1px solid ${st.border};border-radius:12px;padding:20px 24px;margin:20px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td style="vertical-align:middle;">
              ${statusBadge(actionLabel, st.text, st.bg, st.border)}
            </td>
          </tr>
          <tr>
            <td style="padding-top:10px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${st.text};font-family:'Poppins',sans-serif;">${opts.absenceReason}</p>
              <p style="margin:4px 0 0;font-size:13px;color:${BRAND.textMuted};font-family:'Open Sans',sans-serif;">${fmtDate}</p>
            </td>
          </tr>
        </table>
      </div>

      ${infoCard([
        { label: 'Date',        value: fmtDate },
        { label: 'Reason',      value: opts.absenceReason },
        { label: 'Reviewed by', value: opts.reviewerName },
        { label: 'Decision',    value: actionLabel },
      ], st.bg, st.border)}

      ${reviewNoteSection}

      ${divider()}

      ${bodyText(`<strong>Next step:</strong> ${nextStep}`, '0')}`;

    try {
      await this.sendMail({
        from: this.from,
        to: opts.to,
        subject: `Absence Request ${actionLabel} – ${fmtDate}`,
        html: emailWrapper(header, body),
      });
    } catch (error) {
      this.logger.error('Failed to send absence review email', error);
    }
  }
}

