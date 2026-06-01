import { CreatorsService } from './creators.service';

type PrismaMock = {
  creatorProfile: { findUnique: jest.Mock; update: jest.Mock };
  creatorMedia: { create: jest.Mock };
};

function makePrisma(): PrismaMock {
  return {
    creatorProfile: { findUnique: jest.fn(), update: jest.fn() },
    creatorMedia: { create: jest.fn() },
  };
}

function profile(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    publicName: 'Jane',
    bio: 'bio',
    country: 'FR',
    categories: ['fashion'],
    instagramUsername: 'jane.creator',
    tiktokUsername: null,
    _count: { media: 1 },
    ...overrides,
  };
}

describe('CreatorsService.isProfileCompleteForUser', () => {
  let prisma: PrismaMock;
  let service: CreatorsService;

  beforeEach(() => {
    prisma = makePrisma();
    service = new CreatorsService(prisma as never);
  });

  it('returns false when profile is missing', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(null);
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(false);
  });

  it('returns true when all required fields, ≥1 category, ≥1 social username, ≥1 media item are set', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(profile());
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(true);
  });

  it('returns false when required text fields are missing', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(profile({ bio: null }));
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(false);
  });

  it('returns false when no media is uploaded', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(
      profile({ _count: { media: 0 } }),
    );
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(false);
  });

  it('returns false when no category is set', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(
      profile({ categories: [] }),
    );
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(false);
  });

  it('returns false when no social account is connected', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(
      profile({ instagramUsername: null, tiktokUsername: null }),
    );
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(false);
  });

  it('returns true when only TikTok username is set', async () => {
    prisma.creatorProfile.findUnique.mockResolvedValue(
      profile({ instagramUsername: null, tiktokUsername: 'jane' }),
    );
    await expect(service.isProfileCompleteForUser('u1')).resolves.toBe(true);
  });
});
