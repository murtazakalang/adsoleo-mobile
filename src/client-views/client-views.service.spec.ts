import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApplicationStatus, DecisionType } from '@prisma/client';
import { ClientViewsService } from './client-views.service';

type PrismaMock = {
  project: { findUnique: jest.Mock };
  application: { findMany: jest.Mock; findUnique: jest.Mock };
  clientView: { create: jest.Mock; findUnique: jest.Mock };
  clientFeedback: { findFirst: jest.Mock; create: jest.Mock };
  $transaction: jest.Mock;
};

function makePrisma(): PrismaMock {
  const prisma: PrismaMock = {
    project: { findUnique: jest.fn() },
    application: { findMany: jest.fn(), findUnique: jest.fn() },
    clientView: { create: jest.fn(), findUnique: jest.fn() },
    clientFeedback: {
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({ id: 'f1' }),
    },
    $transaction: jest.fn(),
  };
  return prisma;
}

describe('ClientViewsService.sendToClient', () => {
  let prisma: PrismaMock;
  let email: { sendEmail: jest.Mock };
  let service: ClientViewsService;

  beforeEach(() => {
    prisma = makePrisma();
    email = { sendEmail: jest.fn().mockResolvedValue(undefined) };
    const notifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new ClientViewsService(
      prisma as never,
      email as never,
      notifications as never,
    );

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb({
        clientView: {
          create: jest.fn().mockResolvedValue({ id: 'cv1' }),
        },
        application: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      }),
    );
  });

  const dto = {
    clientEmail: 'client@example.com',
    applicationIds: ['11111111-1111-1111-1111-111111111111'],
    expiresInDays: 7 as const,
  };

  it('throws NotFoundException when project does not exist', async () => {
    prisma.project.findUnique.mockResolvedValue(null);
    await expect(
      service.sendToClient('p1', 'admin1', dto),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects unknown applicationIds', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p1', title: 'X' });
    prisma.application.findMany.mockResolvedValue([]);
    await expect(
      service.sendToClient('p1', 'admin1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects applications belonging to a different project', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p1', title: 'X' });
    prisma.application.findMany.mockResolvedValue([
      {
        id: dto.applicationIds[0],
        projectId: 'other',
        status: ApplicationStatus.SELECTED,
      },
    ]);
    await expect(
      service.sendToClient('p1', 'admin1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects applications that are not in SELECTED status', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p1', title: 'X' });
    prisma.application.findMany.mockResolvedValue([
      {
        id: dto.applicationIds[0],
        projectId: 'p1',
        status: ApplicationStatus.PENDING,
      },
    ]);
    await expect(
      service.sendToClient('p1', 'admin1', dto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('sends email + returns id on the happy path', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'p1', title: 'X' });
    prisma.application.findMany.mockResolvedValue([
      {
        id: dto.applicationIds[0],
        projectId: 'p1',
        status: ApplicationStatus.SELECTED,
      },
    ]);

    const result = await service.sendToClient('p1', 'admin1', dto);
    expect(result).toMatchObject({ success: true, id: 'cv1' });
    expect(email.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: dto.clientEmail,
        dynamicTemplateData: expect.objectContaining({
          projectTitle: 'X',
          expiresInDays: 7,
        }),
      }),
    );
  });
});

describe('ClientViewsService.getShortlistByToken', () => {
  let prisma: PrismaMock;
  let service: ClientViewsService;

  beforeEach(() => {
    prisma = makePrisma();
    const email = { sendEmail: jest.fn() };
    const notifications = { dispatch: jest.fn() };
    service = new ClientViewsService(
      prisma as never,
      email as never,
      notifications as never,
    );
  });

  it('throws not-found when token is unknown', async () => {
    prisma.clientView.findUnique.mockResolvedValue(null);
    await expect(service.getShortlistByToken('bad')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws forbidden when deactivated', async () => {
    prisma.clientView.findUnique.mockResolvedValue({
      deactivatedAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
      project: { title: 'X' },
      creators: [],
    });
    await expect(service.getShortlistByToken('tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws forbidden when expired', async () => {
    prisma.clientView.findUnique.mockResolvedValue({
      deactivatedAt: null,
      expiresAt: new Date(Date.now() - 86400000),
      project: { title: 'X' },
      creators: [],
    });
    await expect(service.getShortlistByToken('tok')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns project + creators on the happy path', async () => {
    prisma.clientView.findUnique.mockResolvedValue({
      deactivatedAt: null,
      expiresAt: new Date(Date.now() + 86400000),
      project: { title: 'X' },
      creators: [
        {
          application: {
            id: 'a1',
            message: 'pitch',
            contentIdea: null,
            availability: null,
            creator: {
              profile: {
                publicName: 'Jane',
                photoUrl: null,
                bio: 'b',
                country: 'FR',
                city: null,
                categories: [],
                subCategories: [],
                languages: [],
                contentStyles: [],
                tiktokUsername: null,
                tiktokUrl: null,
                tiktokFollowers: 0,
                instagramUsername: 'jane',
                instagramUrl: null,
                instagramFollowers: 0,
                engagementRate: null,
                media: [],
              },
            },
          },
        },
      ],
    });
    const out = await service.getShortlistByToken('tok');
    expect(out.creators).toHaveLength(1);
    expect(out.creators[0]).toMatchObject({
      applicationId: 'a1',
      profile: expect.objectContaining({ publicName: 'Jane' }),
    });
  });
});

describe('ClientViewsService.submitDecision', () => {
  let prisma: PrismaMock;
  let service: ClientViewsService;
  let notifications: { dispatch: jest.Mock };

  beforeEach(() => {
    prisma = makePrisma();
    notifications = { dispatch: jest.fn() };
    const email = { sendEmail: jest.fn() };
    service = new ClientViewsService(
      prisma as never,
      email as never,
      notifications as never,
    );

    prisma.application.findUnique.mockResolvedValue({
      id: 'app1',
      creatorId: 'creator1',
      project: { title: 'X' },
    });
  });

  const baseView = {
    id: 'cv1',
    deactivatedAt: null,
    expiresAt: new Date(Date.now() + 86400000),
    creators: [{ applicationId: 'app1' }],
  };

  it('rejects decisions for applications not in the shortlist', async () => {
    prisma.clientView.findUnique.mockResolvedValue({
      ...baseView,
      creators: [{ applicationId: 'other' }],
    });
    await expect(
      service.submitDecision('tok', {
        applicationId: 'app1',
        decision: DecisionType.APPROVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is idempotent for identical APPROVED decision', async () => {
    prisma.clientView.findUnique.mockResolvedValue(baseView);
    prisma.clientFeedback.findFirst.mockResolvedValue({
      decision: DecisionType.APPROVED,
    });
    const out = await service.submitDecision('tok', {
      applicationId: 'app1',
      decision: DecisionType.APPROVED,
    });
    expect(out.success).toBe(true);
    expect(prisma.clientFeedback.create).not.toHaveBeenCalled();
  });

  it('rejects changing an existing decision', async () => {
    prisma.clientView.findUnique.mockResolvedValue(baseView);
    prisma.clientFeedback.findFirst.mockResolvedValue({
      decision: DecisionType.REJECTED,
    });
    await expect(
      service.submitDecision('tok', {
        applicationId: 'app1',
        decision: DecisionType.APPROVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows multiple COMMENT_ONLY decisions', async () => {
    prisma.clientView.findUnique.mockResolvedValue(baseView);
    await service.submitDecision('tok', {
      applicationId: 'app1',
      decision: DecisionType.COMMENT_ONLY,
      comment: 'one',
    });
    await service.submitDecision('tok', {
      applicationId: 'app1',
      decision: DecisionType.COMMENT_ONLY,
      comment: 'two',
    });
    expect(prisma.clientFeedback.create).toHaveBeenCalledTimes(2);
  });

  it('fires a CLIENT_APPROVED dispatch on success', async () => {
    prisma.clientView.findUnique.mockResolvedValue(baseView);
    prisma.clientFeedback.findFirst.mockResolvedValue(null);
    await service.submitDecision('tok', {
      applicationId: 'app1',
      decision: DecisionType.APPROVED,
    });
    expect(notifications.dispatch).toHaveBeenCalled();
  });
});
