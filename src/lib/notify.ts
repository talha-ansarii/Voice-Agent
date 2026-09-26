function telegramUrl() {
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  return `https://api.telegram.org/bot${token}/sendMessage`;
}

export function sendTelegram(message: string): boolean {
  if (process.env.TELEGRAM_DISABLED === '1') return false;
  const token = process.env.TELEGRAM_BOT_TOKEN ?? '';
  const chatId = process.env.TELEGRAM_CHAT_ID ?? '';
  if (!token || !chatId) {
    console.warn('[TELEGRAM] Token or Chat ID not set — skipping.');
    return false;
  }
  void fetch(telegramUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      parse_mode: 'Markdown',
    }),
    signal: AbortSignal.timeout(5000),
  })
    .then((r) => {
      if (!r.ok) throw new Error(`${r.status}`);
      console.log('[TELEGRAM] Message sent.');
    })
    .catch((e) => console.error('[TELEGRAM] Failed:', e));
  return true;
}

export function sendWhatsappBookingConfirmation(
  callerPhone: string,
  callerName: string,
  bookingTimeIso: string,
): boolean {
  let readable = bookingTimeIso;
  try {
    const dt = new Date(bookingTimeIso);
    readable = dt.toLocaleString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    /* keep raw */
  }
  const message = `✅ Hi ${callerName || 'there'}! Your appointment is *confirmed*.\n\n📅 *Date & Time:* ${readable}\n\nIf you need to reschedule or cancel, just call us back.\n\n— RapidX AI 🤖`;
  return sendWhatsapp(callerPhone, message);
}

function sendWhatsapp(toPhone: string, message: string): boolean {
  const accountSid = process.env.TWILIO_ACCOUNT_SID ?? '';
  const authToken = process.env.TWILIO_AUTH_TOKEN ?? '';
  const fromNumber =
    process.env.TWILIO_WHATSAPP_NUMBER ?? 'whatsapp:+14155238886';
  if (!accountSid || !authToken) return false;
  const toWa = toPhone.startsWith('whatsapp:')
    ? toPhone
    : `whatsapp:${toPhone}`;
  const body = new URLSearchParams({
    From: fromNumber,
    To: toWa,
    Body: message,
  });
  void fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: AbortSignal.timeout(8000),
    },
  ).catch((e) => console.error('[WHATSAPP] Failed:', e));
  return true;
}

export function notifyBookingConfirmed(opts: {
  callerName: string;
  callerPhone: string;
  bookingTimeIso: string;
  bookingId: string;
  notes?: string;
  ttsVoice?: string;
  aiSummary?: string;
}) {
  let readable = opts.bookingTimeIso;
  try {
    const dt = new Date(opts.bookingTimeIso);
    readable = dt.toLocaleString('en-IN', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch {
    /* keep raw */
  }
  const message =
    `✅ *New Booking Confirmed!*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Name:*        ${opts.callerName}\n` +
    `📞 *Phone:*       \`${opts.callerPhone}\`\n` +
    `📅 *Time:*        ${readable}\n` +
    `🔖 *Booking ID:*  \`${opts.bookingId}\`\n` +
    `📝 *Notes:*       ${opts.notes || '—'}\n` +
    `🎙️ *Voice Model:* ${opts.ttsVoice || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    (opts.aiSummary ? `💬 *AI Summary:*\n_${opts.aiSummary}_\n\n` : '') +
    `_Booked via RapidX AI Voice Agent_ 🤖`;
  sendTelegram(message);
  sendWhatsappBookingConfirmation(
    opts.callerPhone,
    opts.callerName,
    opts.bookingTimeIso,
  );
}

export function notifyCallNoBooking(opts: {
  callerName: string;
  callerPhone: string;
  callSummary?: string;
  ttsVoice?: string;
  aiSummary?: string;
  durationSeconds?: number;
}) {
  const message =
    `📵 *Call Ended — No Booking*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 *Name:*        ${opts.callerName || 'Unknown'}\n` +
    `📞 *Phone:*       \`${opts.callerPhone}\`\n` +
    `⏱️ *Duration:*    ${opts.durationSeconds ?? 0}s\n` +
    `🎙️ *Voice Model:* ${opts.ttsVoice || '—'}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💬 *Summary:*\n_${opts.aiSummary || opts.callSummary || 'Caller did not schedule.'}_\n\n` +
    `_Consider a manual follow-up call_ 📲\n` +
    `_RapidX AI Voice Agent_ 🤖`;
  sendTelegram(message);
}

export function notifyAgentError(callerPhone: string, error: string) {
  const message =
    `⚠️ *Agent Error During Call*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📞 *Phone:*  \`${callerPhone}\`\n` +
    `🔴 *Error:*  \`${error}\`\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `_RapidX AI Voice Agent_ 🤖`;
  sendTelegram(message);
}
