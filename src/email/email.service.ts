import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sgMail from '@sendgrid/mail';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly enabled: boolean;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('SENDGRID_API_KEY');
    if (apiKey) {
      sgMail.setApiKey(apiKey);
      this.enabled = true;
    } else {
      this.enabled = false;
    }
  }

  async sendEmail(opts: {
    to: string;
    templateId: string;
    dynamicTemplateData: Record<string, unknown>;
  }) {
    const { to, templateId, dynamicTemplateData } = opts;

    if (!this.enabled) {
      this.logger.warn(
        `Email disabled (no SENDGRID_API_KEY). Would have sent template ${templateId} to ${to}`,
      );
      return;
    }

    const msg = {
      to,
      from: 'no-reply@adsoleo.com',
      templateId,
      dynamicTemplateData,
    };

    try {
      await sgMail.send(msg);
      this.logger.log(`Email sent to ${to} using template ${templateId}`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  }
}
