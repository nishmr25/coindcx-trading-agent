const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function seedMasterUser() {
  try {
    // Check if master user already exists
    const existingUser = await prisma.user.findFirst({
      where: { email: "master@apextrading.com" }
    });

    if (existingUser) {
      console.log("Master user already exists");
      return;
    }

    // Create master user
    const passwordHash = await bcrypt.hash("masterpassword123", 10);
    const masterUser = await prisma.user.create({
      data: {
        email: "master@apextrading.com",
        password: passwordHash,
        balance: 10000, // Starting balance of 10,000 INR
        totalProfit: 0
      }
    });

    console.log("Master user created:", masterUser.email);
    console.log("Password: masterpassword123 (change this in production!)");
  } catch (error) {
    console.error("Error seeding master user:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedMasterUser();

