import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

@Injectable()
export class SmsService {
  private client: Twilio | null = null;
  private readonly logger = new Logger(SmsService.name);

  constructor(private configService: ConfigService) {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');

    if (accountSid && authToken) {
      this.client = new Twilio(accountSid, authToken);
    }
  }

  async sendSms(to: string, body: string) {
    if (!this.client) {
      this.logger.warn('Twilio client not initialized, skipping SMS.');
      return;
    }

    try {
      const phoneNumber =
        this.configService.get<string>('TWILIO_PHONE_NUMBER');
      const message = await this.client.messages.create({
        body,
        from: phoneNumber,
        to,
      });
      this.logger.log(`SMS sent to ${to}, SID: ${message.sid}`);
    } catch (error) {
      this.logger.error(`Failed to send SMS to ${to}:`, error);
      throw error;
    }
  }
}
