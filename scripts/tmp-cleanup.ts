import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { prisma } from '../src/lib/prisma.js';

async function main() {
  const id = readFileSync('/tmp/cleanup-user-id.txt', 'utf8').trim();
  const logs = await prisma.callLog.findMany({ where: { userId: id }, take: 5 });
  const transcripts = await prisma.callTranscript.count({ where: { userId: id } });
  const active = await prisma.activeCall.count({ where: { userId: id } });
  console.log(JSON.stringify({ logCount: logs.length, transcripts, active }));
  await prisma.user.delete({ where: { id } });
  await prisma.$disconnect();
}

void main();
