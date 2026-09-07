// Seeds the founder user only. Not run automatically by the test gate;
// invoked by hand or by deploy tooling via `npm run prisma:seed`.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.FOUNDER_EMAIL ?? "founder@example.com";
  const password = process.env.FOUNDER_PASSWORD ?? "change-me-locally";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, passwordHash, role: "FOUNDER" },
  });
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
