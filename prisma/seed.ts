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
  const hashedPassword = await bcrypt.hash("HacheAdmin", 10);

  const existingAdmin = await prisma.user.findUnique({
    where: { username: "HacheJota" },
  });

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        username: "HacheJota",
        password: hashedPassword,
        role: "ADMIN",
        credits: 9999,
        referralCode: generateReferralCode(),
      },
    });

    console.log("✅ Admin creado con referralCode");
  } else {
    // 🔥 IMPORTANTE: si ya existe, asegúrate que tenga referralCode
    if (!existingAdmin.referralCode) {
      await prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          referralCode: generateReferralCode(),
        },
      });

      console.log("♻️ Admin actualizado con referralCode");
    } else {
      console.log("ℹ️ Admin ya existe y está correcto");
    }
  }
}

main()
  .catch((e) => {
    console.error("❌ Error en seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
