import 'dotenv/config';
import { CallType } from '../src/lib/call-types.js';
import { dispatchCall } from '../src/lib/dispatch.js';

const phone = process.argv.find((a) => a.startsWith('+')) ?? process.argv[2];

if (!phone?.startsWith('+')) {
  console.error('Usage: npm run call -- +91XXXXXXXXXX');
  process.exit(1);
}

const result = await dispatchCall(phone, CallType.OUTBOUND);
if (result.status === 'ok') {
  console.log(`OK — room ${result.room}, dispatch ${result.dispatchId}`);
  process.exit(0);
}
console.error(result.message ?? 'Dispatch failed');
process.exit(1);
