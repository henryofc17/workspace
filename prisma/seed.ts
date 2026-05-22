import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "HF-";
  for (let i = 0; i < 5; i++) {
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
    const referralCode = generateReferralCode();
    await prisma.user.create({
      data: {
        username: "HacheJota",
        password: hashedPassword,
        role: "ADMIN",
        credits: 9999,
        referralCode,
      },
    });
    console.log("Admin HacheJota created with referral code: " + referralCode);
  } else {
    console.log("Admin already exists");
    // Ensure existing admin has a referral code
    if (!existingAdmin.referralCode) {
      const referralCode = generateReferralCode();
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: { referralCode },
      });
      console.log("Admin referral code generated: " + referralCode);
    }
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
