#!/usr/bin/env tsx
import 'dotenv/config';
import {
  evaluateCallLogs,
  formatEvalReport,
} from '../src/lib/call-eval.js';

const limit = Number(process.argv[2] ?? 50);

async function main() {
  const summary = await evaluateCallLogs(limit);
  console.log(formatEvalReport(summary));
  if (summary.rows.length === 0) {
    console.log('\nNo calls in database. Set DATABASE_URL and complete a few calls first.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
