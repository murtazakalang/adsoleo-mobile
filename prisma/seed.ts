import 'dotenv/config';
import { PrismaClient, Role } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(connectionString),
});

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@adsoleo.local';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'AdminPass123!';
const CREATOR_EMAIL = process.env.SEED_CREATOR_EMAIL ?? 'creator@adsoleo.local';
const CREATOR_PASSWORD =
  process.env.SEED_CREATOR_PASSWORD ?? 'CreatorPass123!';

async function upsertUser(email: string, password: string, role: Role) {
  const passwordHash = await bcrypt.hash(password, 12);
  return prisma.user.upsert({
    where: { email },
    update: { passwordHash, role },
    create: { email, passwordHash, role },
  });
}

async function main() {
  const admin = await upsertUser(ADMIN_EMAIL, ADMIN_PASSWORD, Role.ADMIN);
  const creator = await upsertUser(
    CREATOR_EMAIL,
    CREATOR_PASSWORD,
    Role.CREATOR,
  );

  await prisma.creatorProfile.upsert({
    where: { userId: creator.id },
    update: {},
    create: {
      userId: creator.id,
      publicName: 'Seed Creator',
      profileCompleted: false,
    },
  });

  console.log('Seeded users:');
  console.log(`  admin    → ${admin.email} / ${ADMIN_PASSWORD}`);
  console.log(`  creator  → ${creator.email} / ${CREATOR_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
