import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, ProjectStatus } from '@prisma/client';
import { ApplicationsService } from './applications.service';

type PrismaMock = {
  project: { findUnique: jest.Mock };
  application: {
    findUnique: jest.Mock;
    findMany: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
};

function makePrisma(): PrismaMock {
  return {
    project: { findUnique: jest.fn() },
    application: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
}

describe('ApplicationsService', () => {
  let prisma: PrismaMock;
  let service: ApplicationsService;

  beforeEach(() => {
    prisma = makePrisma();
    const notifications = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new ApplicationsService(prisma as never, notifications as never);
  });

  describe('create', () => {
    const dto = { projectId: 'p1' };

    it('throws NotFoundException when project does not exist', async () => {
      prisma.project.findUnique.mockResolvedValue(null);
      await expect(service.create('u1', dto as never)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('rejects applications to non-ACTIVE projects', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        status: ProjectStatus.DRAFT,
      });
      await expect(service.create('u1', dto as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects duplicate applications', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        status: ProjectStatus.ACTIVE,
      });
      prisma.application.findUnique.mockResolvedValue({ id: 'a1' });
      await expect(service.create('u1', dto as never)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('creates with PENDING status on the happy path', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'p1',
        status: ProjectStatus.ACTIVE,
      });
      prisma.application.findUnique.mockResolvedValue(null);
      prisma.application.create.mockResolvedValue({ id: 'a1' });
      await service.create('u1', dto as never);
      expect(prisma.application.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: ApplicationStatus.PENDING,
            creatorId: 'u1',
            projectId: 'p1',
          }),
        }),
      );
    });
  });

  describe('updateStatus state machine', () => {
    function setup(currentStatus: ApplicationStatus) {
      prisma.application.findUnique.mockResolvedValue({
        id: 'a1',
        status: currentStatus,
      });
      prisma.application.update.mockResolvedValue({ id: 'a1' });
    }

    it('PENDING → SELECTED is allowed', async () => {
      setup(ApplicationStatus.PENDING);
      await expect(
        service.updateStatus('a1', { status: ApplicationStatus.SELECTED }),
      ).resolves.toBeDefined();
    });

    it('PENDING → REJECTED is allowed', async () => {
      setup(ApplicationStatus.PENDING);
      await expect(
        service.updateStatus('a1', { status: ApplicationStatus.REJECTED }),
      ).resolves.toBeDefined();
    });

    it('PENDING → SENT_TO_CLIENT is rejected', async () => {
      setup(ApplicationStatus.PENDING);
      await expect(
        service.updateStatus('a1', {
          status: ApplicationStatus.SENT_TO_CLIENT,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('REJECTED is terminal', async () => {
      setup(ApplicationStatus.REJECTED);
      await expect(
        service.updateStatus('a1', { status: ApplicationStatus.SELECTED }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('SELECTED → SENT_TO_CLIENT is allowed', async () => {
      setup(ApplicationStatus.SELECTED);
      await expect(
        service.updateStatus('a1', {
          status: ApplicationStatus.SENT_TO_CLIENT,
        }),
      ).resolves.toBeDefined();
    });

    it('throws NotFoundException for missing application', async () => {
      prisma.application.findUnique.mockResolvedValue(null);
      await expect(
        service.updateStatus('a1', { status: ApplicationStatus.SELECTED }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
