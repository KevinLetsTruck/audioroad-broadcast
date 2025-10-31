/**
 * Script to create the first admin user
 * Run with: npx tsx server/scripts/createAdminUser.ts
 */

import { PrismaClient } from '@prisma/client';
import { createUser } from '../services/authService.js';

const prisma = new PrismaClient();

async function main() {
  console.log('🔐 Creating admin user...\n');

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@audioroad.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  // Check if admin already exists
  const existingAdmin = await prisma.broadcastUser.findUnique({
    where: { email: adminEmail }
  });

  if (existingAdmin) {
    console.log('⚠️  Admin user already exists!');
    console.log('   Email:', existingAdmin.email);
    console.log('   Name:', existingAdmin.name);
    console.log('   Role:', existingAdmin.role);
    console.log('\nTo reset password, delete the user first or create a new one with a different email.');
    return;
  }

  try {
    await createUser({
      email: adminEmail,
      password: adminPassword,
      name: adminName,
      role: 'admin'
    });

    console.log('✅ Admin user created successfully!\n');
    console.log('📧 Email:', adminEmail);
    console.log('🔑 Password:', adminPassword);
    console.log('👤 Name:', adminName);
    console.log('🎭 Role: admin\n');
    console.log('⚠️  IMPORTANT: Change this password after first login!\n');
    console.log('You can now login at: http://localhost:5173/login\n');
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

