import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  private readonly transporter: nodemailer.Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    const user = this.config.get<string>('MAIL_USER') ?? '';
    const pass = this.config.get<string>('MAIL_PASS') ?? '';

    this.from = `"Blues Clues HRIS" <${user}>`;

    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }

  async sendInvite(to: string, inviteLink: string) {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'You have been invited to Blues Clues HRIS',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background-color: #99e0fe; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; color: #0c1a2e; letter-spacing: 0.5px;">Blues Clues HRIS</h1>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="margin-top: 0; color: #0c1a2e;">You're invited!</h2>
              <p style="color: #374151;">A system administrator has created an account for you on <strong>Blues Clues HRIS</strong>.</p>
              <p style="color: #374151;">Click the button below to set your password and activate your account.</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${inviteLink}" style="
                  display: inline-block;
                  padding: 12px 28px;
                  background-color: #99e0fe;
                  color: #0c1a2e;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
                  font-size: 15px;
                ">
                  Activate Account
                </a>
              </div>
              <p style="margin-top: 32px; color: #6b7280; font-size: 12px; text-align: center;">
                This link expires in 48 hours. If you did not expect this email, you can ignore it.
              </p>
            </div>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send invite email', error);
      throw new Error('Failed to send invite email');
    }
  }

  async sendPasswordResetEmail(to: string, resetLink: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject: 'Reset your Blues Clues HRIS password',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
            <div style="background-color: #99e0fe; padding: 32px 24px; text-align: center;">
              <h1 style="margin: 0; font-size: 22px; color: #0c1a2e; letter-spacing: 0.5px;">Blues Clues HRIS</h1>
            </div>
            <div style="padding: 32px 24px;">
              <h2 style="margin-top: 0; color: #0c1a2e;">Password Reset</h2>
              <p style="color: #374151;">We received a request to reset your password. Click the button below to set a new password.</p>
              <div style="text-align: center; margin-top: 24px;">
                <a href="${resetLink}" style="
                  display: inline-block;
                  padding: 12px 28px;
                  background-color: #99e0fe;
                  color: #0c1a2e;
                  text-decoration: none;
                  border-radius: 8px;
                  font-weight: bold;
                  font-size: 15px;
                ">
                  Reset Password
                </a>
              </div>
              <p style="margin-top: 32px; color: #6b7280; font-size: 12px; text-align: center;">
                This link expires in 48 hours. If you did not request a password reset, you can ignore this email.
              </p>
            </div>
          </div>
        `,
      });
    } catch (error) {
      this.logger.error('Failed to send password reset email', error);
      throw new Error('Failed to send password reset email');
    }
  }

  async sendInterviewScheduleEmail(opts: {
    to: string;
    applicantName: string;
    jobTitle: string;
    scheduledDate: string;   // "YYYY-MM-DD"
    scheduledTime: string;   // "HH:MM"
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
      video: 'Video Call',
      phone: 'Phone Call',
    };
    const fmtDate = new Date(`${opts.scheduledDate}T${opts.scheduledTime}`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmtTime = new Date(`2000-01-01T${opts.scheduledTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    const locationRow = opts.meetingLink
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Meeting Link</td><td style="padding:8px 0;font-size:13px;"><a href="${opts.meetingLink}" style="color:#1e3a8a;">${opts.meetingLink}</a></td></tr>`
      : opts.location
      ? `<tr><td style="padding:8px 0;color:#6b7280;font-size:13px;">Location</td><td style="padding:8px 0;font-size:13px;">${opts.location}</td></tr>`
      : '';

    const notesSection = opts.notes
      ? `<div style="margin-top:20px;padding:16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
           <p style="margin:0 0 6px;font-size:12px;font-weight:bold;text-transform:uppercase;color:#6b7280;letter-spacing:0.08em;">Notes from HR</p>
           <p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${opts.notes}</p>
         </div>`
      : '';

    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: `Interview Scheduled – ${opts.jobTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:linear-gradient(135deg,#0f172a 0%,#172554 55%,#134e4a 100%);padding:32px 28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;color:rgba(255,255,255,0.5);letter-spacing:0.14em;">Blues Clues HRIS</p>
            <h1 style="margin:0;font-size:22px;color:#ffffff;">Interview Scheduled</h1>
          </div>
          <div style="padding:28px;">
            <p style="margin:0 0 16px;font-size:14px;color:#374151;">
              Hi <strong>${opts.applicantName}</strong>, your interview for <strong>${opts.jobTitle}</strong> has been scheduled. Here are the details:
            </p>

            <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
              <table style="width:100%;border-collapse:collapse;">
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;width:120px;">Date</td>
                  <td style="padding:8px 0;font-size:13px;font-weight:600;color:#1e3a8a;">${fmtDate}</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;">Time</td>
                  <td style="padding:8px 0;font-size:13px;font-weight:600;color:#1e3a8a;">${fmtTime} (${opts.durationMinutes} min)</td>
                </tr>
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;">Format</td>
                  <td style="padding:8px 0;font-size:13px;">${formatLabel[opts.format] ?? opts.format}</td>
                </tr>
                ${locationRow}
                <tr>
                  <td style="padding:8px 0;color:#6b7280;font-size:13px;">Interviewer</td>
                  <td style="padding:8px 0;font-size:13px;">${opts.interviewerName}${opts.interviewerTitle ? ` <span style="color:#6b7280;">· ${opts.interviewerTitle}</span>` : ''}</td>
                </tr>
              </table>
            </div>

            ${notesSection}

            <p style="margin-top:24px;font-size:13px;color:#6b7280;">
              Log in to your applicant portal to view this schedule at any time.
            </p>
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:16px 28px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Blues Clues HRIS · This is an automated notification</p>
          </div>
        </div>
      `,
    });
  }

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

    const statusColor  = opts.action === 'accepted' ? '#16a34a' : opts.action === 'declined' ? '#dc2626' : '#d97706';
    const statusBg     = opts.action === 'accepted' ? '#f0fdf4' : opts.action === 'declined' ? '#fef2f2' : '#fffbeb';
    const statusBorder = opts.action === 'accepted' ? '#bbf7d0' : opts.action === 'declined' ? '#fecaca' : '#fde68a';

    const fmtDate = new Date(`${opts.scheduledDate}T${opts.scheduledTime}`).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const fmtTime = new Date(`2000-01-01T${opts.scheduledTime}`).toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit',
    });

    const noteSection = opts.note
      ? `<div style="margin-top:16px;padding:12px 16px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
           <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;color:#6b7280;letter-spacing:0.08em;">Note from Applicant</p>
           <p style="margin:0;font-size:13px;color:#374151;white-space:pre-wrap;">${opts.note}</p>
         </div>`
      : '';

    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: `${opts.applicantName} ${actionLabel} — ${opts.jobTitle}`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
          <div style="background:linear-gradient(135deg,#0f172a 0%,#172554 55%,#134e4a 100%);padding:28px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:bold;text-transform:uppercase;color:rgba(255,255,255,0.5);letter-spacing:0.14em;">Blues Clues HRIS</p>
            <h1 style="margin:0;font-size:20px;color:#ffffff;">Interview Response</h1>
          </div>
          <div style="padding:24px;">
            <div style="background:${statusBg};border:1px solid ${statusBorder};border-radius:10px;padding:16px 20px;margin-bottom:20px;">
              <p style="margin:0;font-size:14px;font-weight:600;color:${statusColor};">
                <strong>${opts.applicantName}</strong> has <strong>${actionLabel.toLowerCase()}</strong> for <strong>${opts.jobTitle}</strong>.
              </p>
            </div>
            <table style="width:100%;border-collapse:collapse;">
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:13px;width:140px;">Scheduled Date</td>
                <td style="padding:8px 0;font-size:13px;">${fmtDate} at ${fmtTime}</td>
              </tr>
              <tr>
                <td style="padding:8px 0;color:#6b7280;font-size:13px;">Applicant Email</td>
                <td style="padding:8px 0;font-size:13px;">${opts.applicantEmail}</td>
              </tr>
            </table>
            ${noteSection}
            <p style="margin-top:20px;font-size:13px;color:#6b7280;">Log in to the HR portal to follow up with this applicant.</p>
          </div>
          <div style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:14px 24px;">
            <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">Blues Clues HRIS · Automated notification</p>
          </div>
        </div>
      `,
    });
  }

  async sendVerificationEmail(to: string, verifyLink: string): Promise<void> {
    await this.transporter.sendMail({
      from: `"Blues Clues HRIS" <${this.config.get('MAIL_USER')}>`,
      to,
      subject: 'Verify your email address',
      html: `
        <p>Thank you for registering.</p>
        <p>Please verify your email by clicking the link below:</p>
        <p><a href="${verifyLink}">Verify Email</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    });
  }
}
