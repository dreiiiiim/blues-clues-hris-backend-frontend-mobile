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
