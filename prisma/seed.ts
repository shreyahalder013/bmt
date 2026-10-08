import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  if (process.env.ADMIN_EMAIL) await db.user.upsert({ where: { email: process.env.ADMIN_EMAIL }, update: { role: 'OWNER', active: true }, create: { email: process.env.ADMIN_EMAIL, name: 'Owner', role: 'OWNER' } });
  await db.siteSettings.upsert({ where: { id: 'site' }, update: {}, create: { id: 'site', phone: '087379 14988', address: 'Chandrakanta Building, 10-A, Dr Jagdish Gandhi Marg, Udaiganj, Husainganj, Lucknow, Uttar Pradesh 226001', mapLink: 'https://www.google.com/maps/search/?api=1&query=Brilliant+Minds+Tutorials+Udaiganj+Lucknow', openingHours: 'To be confirmed by owner' } });
  const programs = [['Primary Classes','Class I – V','Strong fundamentals and learning confidence.',['Strong fundamentals','Reading & writing','Mathematics','General academic development','Learning confidence']],['Middle School','Class VI – VIII','Building concepts through regular practice.',['Concept development','Mathematics','Science','English','Regular assessments']],['Secondary School','Class IX – X','A solid foundation and focused board preparation.',['Strong conceptual foundation','Board preparation','Mathematics & Science','Exam strategy','Doubt solving']],['Senior Secondary','Class XI – XII','Subject-focused preparation with personal guidance.',['Subject-focused preparation','Concept mastery','Exam preparation','Regular testing','Personalized guidance']]] as const;
  for (const [i, [title, range, description, details]] of programs.entries()) await db.classProgram.upsert({ where: { id: `seed-${i}` }, update: {}, create: { id: `seed-${i}`, title, range, description, details, order: i } });
}
main().finally(() => db.$disconnect());
