import fs from 'node:fs';

const CAL_BASE = 'https://api.cal.com/v1';

export function getCalCreds() {
  return {
    apiKey: process.env.CAL_API_KEY ?? '',
    eventId: Number(process.env.CAL_EVENT_TYPE_ID ?? '0') || 0,
  };
}

export async function getAvailableSlots(dateStr: string): Promise<
  Array<{ time: string; label: string; start_time?: string }>
> {
  const gcalId = process.env.GOOGLE_CALENDAR_ID ?? '';
  const gcalCreds = process.env.GOOGLE_SERVICE_ACCOUNT_FILE ?? 'google_creds.json';
  if (gcalId && fs.existsSync(gcalCreds)) {
    console.warn('[GCAL] Google Calendar slots not ported in TS — using Cal.com');
  }
  return getSlotsCalcom(dateStr);
}

async function getSlotsCalcom(dateStr: string) {
  const creds = getCalCreds();
  if (!creds.apiKey || !creds.eventId) return [];
  try {
    const params = new URLSearchParams({
      apiKey: creds.apiKey,
      eventTypeId: String(creds.eventId),
      startTime: `${dateStr}T00:00:00.000Z`,
      endTime: `${dateStr}T23:59:59.000Z`,
    });
    const resp = await fetch(`${CAL_BASE}/slots?${params}`, {
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      console.error(`[CAL] slots ${resp.status}: ${await resp.text()}`);
      return [];
    }
    const data = (await resp.json()) as {
      data?: { slots?: Record<string, Array<{ time: string }>> };
    };
    const raw = data.data?.slots?.[dateStr] ?? [];
    return raw.map((s) => {
      const dt = new Date(s.time);
      return {
        time: s.time,
        start_time: s.time,
        label: dt.toLocaleTimeString('en-IN', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      };
    });
  } catch (e) {
    console.error('[CAL] getAvailableSlots error:', e);
    return [];
  }
}

export async function createBooking(
  startTime: string,
  callerName: string,
  callerPhone: string,
  notes = '',
): Promise<{ success: boolean; booking_id: string | null; message: string }> {
  return createBookingCalcom(startTime, callerName, callerPhone, notes);
}

async function createBookingCalcom(
  startTime: string,
  callerName: string,
  callerPhone: string,
  notes: string,
) {
  const creds = getCalCreds();
  if (!creds.apiKey || !creds.eventId) {
    return {
      success: false,
      booking_id: null,
      message: 'Cal.com not configured',
    };
  }
  const payload = {
    eventTypeId: creds.eventId,
    start: startTime,
    attendee: {
      name: callerName,
      email: `${callerPhone.replace(/\+/g, '').replace(/\s/g, '')}@voiceagent.placeholder`,
      phoneNumber: callerPhone,
      timeZone: 'Asia/Kolkata',
      language: 'en',
    },
    bookingFieldsResponses: {
      notes: notes || `Booked via AI voice agent. Phone: ${callerPhone}`,
    },
  };
  try {
    const resp = await fetch('https://api.cal.com/v2/bookings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
        'cal-api-version': '2024-08-13',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[CAL] Booking failed ${resp.status}: ${text}`);
      return { success: false, booking_id: null, message: text };
    }
    const body = (await resp.json()) as { data?: { uid?: string } };
    const uid = body.data?.uid ?? 'unknown';
    console.log(`[CAL] Booking created: uid=${uid}`);
    return { success: true, booking_id: uid, message: 'Booking confirmed' };
  } catch (e) {
    console.error('[CAL] Booking error:', e);
    return {
      success: false,
      booking_id: null,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
