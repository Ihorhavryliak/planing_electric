import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type Transporter } from 'nodemailer';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly driver: string;
  private readonly from: string;
  private transporter: Transporter | null = null;

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.driver = config.get<string>('MAIL_DRIVER') ?? 'log';
    this.from =
      config.get<string>('MAIL_FROM') ?? 'DrawMyPlace <no-reply@drawmyplace.local>';
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (this.driver !== 'smtp') {
      this.logger.log(`[mail:log] to=${to} subject="${subject}"\n${text}`);
      return;
    }

    const transporter = this.getTransporter();
    await transporter.sendMail({ from: this.from, to, subject, text });
  }

  private getTransporter(): Transporter {
    if (!this.transporter) {
      const user = this.config.get<string>('SMTP_USER');
      const pass = this.config.get<string>('SMTP_PASSWORD');
      this.transporter = nodemailer.createTransport({
        host: this.config.get<string>('SMTP_HOST'),
        port: this.config.get<number>('SMTP_PORT') ?? 587,
        secure: this.config.get<string>('SMTP_SECURE') === 'true',
        auth: user && pass ? { user, pass } : undefined,
      });
    }
    return this.transporter;
  }
}