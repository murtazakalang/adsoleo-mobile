import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class ReminderCron {
  private readonly logger = new Logger(ReminderCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleClientReminders() {
    this.logger.log('Running daily client reminder cron job...');

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const pendingViews = await this.prisma.clientView.findMany({
      where: {
        createdAt: { lte: fiveDaysAgo },
        deactivatedAt: null,
        expiresAt: { gt: new Date() },
        reminderSentAt: null,
        clientEmail: { not: null },
      },
      include: {
        creators: {
          include: {
            application: {
              include: { feedbacks: true },
            },
          },
        },
        project: true,
      },
    });

    let reminderCount = 0;

    for (const view of pendingViews) {
      // At least one creator with no APPROVED/REJECTED decision yet
      const hasPendingDecisions = view.creators.some((c) => {
        const decisions = c.application.feedbacks.filter(
          (f) => f.decision !== 'COMMENT_ONLY' && f.clientViewId === view.id,
        );
        return decisions.length === 0;
      });

      if (!hasPendingDecisions) continue;
      if (!view.clientEmail) continue;

      try {
        await this.emailService.sendEmail({
          to: view.clientEmail,
          templateId: 'd-mock-template-id',
          dynamicTemplateData: {
            projectTitle: view.project.title,
            expiresAt: view.expiresAt,
          },
        });
        await this.prisma.clientView.update({
          where: { id: view.id },
          data: { reminderSentAt: new Date() },
        });
        reminderCount += 1;
      } catch (err) {
        this.logger.error(
          `Failed to send reminder for view ${view.id}: ${err}`,
        );
      }
    }

    this.logger.log(`Finished cron job. Sent ${reminderCount} reminders.`);
  }
}
