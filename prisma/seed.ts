import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("HacheAdmin", 10);

  await prisma.user.upsert({
    where: { username: "HacheJota" },
    update: {
      password: hashedPassword,
      role: "ADMIN",
      credits: 9999
    },
    create: {
      username: "HacheJota",
      password: hashedPassword,
      role: "ADMIN",
      credits: 9999
    }
  });

  console.log("✅ Admin listo");
}

main()
  .finally(async () => {
    await prisma.$disconnect();
  });
