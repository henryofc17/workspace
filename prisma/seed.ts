import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "NF-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function main() {
  // Case-insensitive lookup for existing admin
  const existingAdmin = await prisma.user.findFirst({
    where: { username: { equals: "HacheJota", mode: "insensitive" } },
  });

  if (!existingAdmin) {
    const hashedPassword = await bcrypt.hash("HacheAdmin", 10);
    await prisma.user.create({
      data: {
        username: "HacheJota",
        password: hashedPassword,
        role: "ADMIN",
        credits: 9999,
        referralCode: generateReferralCode(),
      },
    });
    console.log("Admin HacheJota created");
  } else {
    console.log("Admin already exists");
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
