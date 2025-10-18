/**
 * Seed Shows Script
 * 
 * Creates the 5 weekly shows in the database
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const shows = [
  {
    name: 'Industry Insights',
    slug: 'industry-insights',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Deep dive into trucking industry trends, regulations, and business insights',
    schedule: {
      days: ['monday'],
      time: '08:00', // 8 AM PT
      duration: 180, // 3 hours
      timezone: 'America/Los_Angeles'
    },
    color: '#3b82f6' // Blue
  },
  {
    name: 'The PowerHour',
    slug: 'the-powerhour',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'High-energy discussion on trucking business and success strategies',
    schedule: {
      days: ['tuesday'],
      time: '08:00', // 8 AM PT
      duration: 180,
      timezone: 'America/Los_Angeles'
    },
    color: '#f59e0b' // Amber
  },
  {
    name: 'DestinationHealth',
    slug: 'destinationhealth',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Health, wellness, and medical topics for professional drivers',
    schedule: {
      days: ['wednesday'],
      time: '08:00', // 8 AM PT
      duration: 180,
      timezone: 'America/Los_Angeles'
    },
    color: '#10b981' // Green
  },
  {
    name: 'Trucking Technology and Efficiency',
    slug: 'trucking-tech',
    hostId: 'default-host',
    hostName: 'AudioRoad Host',
    description: 'Latest technology, tools, and efficiency tips for modern trucking',
    schedule: {
      days: ['thursday'],
      time: '08:00', // 8 AM PT
      duration: 180,
      timezone: 'America/Los_Angeles'
    },
    color: '#8b5cf6' // Purple
  },
  {
    name: 'Rolling Toe',
    slug: 'rolling-toe',
    hostId: 'rolling-toe-host',
    hostName: 'Rolling Toe',
    description: 'Evening conversations with Rolling Toe',
    schedule: {
      days: ['thursday'],
      time: '10:00', // 10 AM PT
      duration: 180,
      timezone: 'America/Los_Angeles'
    },
    color: '#ef4444' // Red
  }
];

async function seedShows() {
  console.log('🌱 Seeding shows...');

  for (const showData of shows) {
    try {
      const show = await prisma.show.upsert({
        where: { slug: showData.slug },
        update: showData,
        create: showData
      });
      console.log(`✅ Created/Updated: ${show.name}`);
    } catch (error) {
      console.error(`❌ Error creating ${showData.name}:`, error);
    }
  }

  console.log('🎉 Shows seeded successfully!');
}

seedShows()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Error:', error);
    prisma.$disconnect();
    process.exit(1);
  });

