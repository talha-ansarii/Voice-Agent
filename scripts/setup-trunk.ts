import 'dotenv/config';
import { SIPTransport } from '@livekit/protocol';
import { getSipClient } from '../src/lib/livekit-clients.js';

const existingId = process.env.OUTBOUND_TRUNK_ID;
const address = process.env.VOBIZ_SIP_DOMAIN;
const username = process.env.VOBIZ_USERNAME;
const password = process.env.VOBIZ_PASSWORD;
const number = process.env.VOBIZ_OUTBOUND_NUMBER;

if (!address || !username || !password || !number) {
  console.error(
    'Error: set VOBIZ_SIP_DOMAIN, VOBIZ_USERNAME, VOBIZ_PASSWORD, and VOBIZ_OUTBOUND_NUMBER in .env',
  );
  process.exit(1);
}

const sip = getSipClient();

try {
  if (existingId) {
    console.log(`Updating SIP trunk: ${existingId}`);
    console.log(`  Address (unchanged on update): ${address}`);
    console.log(`  Username: ${username}`);
    console.log(`  From number: ${number}`);
    await sip.updateSipOutboundTrunkFields(existingId, {
      authUsername: username,
      authPassword: password,
      destinationCountry: 'in',
      numbers: { set: [number] },
    });
    console.log('\nSIP trunk updated. Restart the agent worker, then place a call.');
  } else {
    console.log('No OUTBOUND_TRUNK_ID — creating a new outbound trunk…');
    const trunk = await sip.createSipOutboundTrunk(
      'Vobiz outbound',
      address,
      [number],
      {
        transport: SIPTransport.SIP_TRANSPORT_AUTO,
        authUsername: username,
        authPassword: password,
        destinationCountry: 'in',
      },
    );
    console.log(`\nCreated trunk ${trunk.sipTrunkId}`);
    console.log('Add this to .env:');
    console.log(`OUTBOUND_TRUNK_ID=${trunk.sipTrunkId}`);
  }
} catch (e) {
  console.error('\nFailed to configure trunk:', e);
  process.exit(1);
}
