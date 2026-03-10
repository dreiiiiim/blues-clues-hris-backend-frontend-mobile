import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly resend: Resend;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly config: ConfigService) {
    this.resend = new Resend(this.config.get<string>('RESEND_API_KEY'));
    this.from = this.config.get<string>('RESEND_FROM_EMAIL') ?? 'onboarding@resend.dev';
  }

  async sendInvite(to: string, inviteLink: string) {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'You have been invited to Blues Clues HRIS',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>You're invited!</h2>
          <p>A system administrator has created an account for you on <strong>Blues Clues HRIS</strong>.</p>
          <p>Click the button below to set your password and activate your account.</p>
          <a href="${inviteLink}" style="
            display: inline-block;
            margin-top: 16px;
            padding: 12px 24px;
            background-color: #7c3aed;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          ">
            Activate Account
          </a>
          <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
            This link expires in 48 hours. If you did not expect this email, you can ignore it.
          </p>
        </div>
      `,
    });

    if (error) {
      this.logger.error('Failed to send invite email', error);
      throw new Error('Failed to send invite email');
    }
  }

  async sendVerificationEmail(to: string, verifyLink: string) {
    const { error } = await this.resend.emails.send({
      from: this.from,
      to,
      subject: 'Verify your Blues Clues HRIS applicant account',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Verify your email</h2>
          <p>Thank you for applying through <strong>Blues Clues HRIS</strong>.</p>
          <p>Please confirm your email address by clicking the button below.</p>
          <a href="${verifyLink}" style="
            display: inline-block;
            margin-top: 16px;
            padding: 12px 24px;
            background-color: #2563eb;
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: bold;
          ">
            Verify Email
          </a>
          <p style="margin-top: 24px; color: #6b7280; font-size: 12px;">
            This link expires soon. If you did not create this account, you can ignore this email.
          </p>
        </div>
      `,
    });

    if (error) {
      this.logger.error('Failed to send verification email', error);
      throw new Error('Failed to send verification email');
    }
  }
}
