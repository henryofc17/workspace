import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create admin if not exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: "HacheJota" },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("HacheAdmin", 10);
    await prisma.user.create({
      data: {
        username: "HacheJota",
        password: hashedPassword,
        role: "ADMIN",
        credits: 9999,
      },
    });
    console.log("✅ Admin HacheJota created");
  } else {
    console.log("ℹ️  Admin already exists");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
