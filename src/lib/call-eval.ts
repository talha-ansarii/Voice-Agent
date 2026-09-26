import { prisma } from './prisma.js';
import {
  extractEmailsFromText,
  extractPhonesFromText,
  validateEmail,
  validatePhone,
} from './lead-validation.js';

export interface CallEvalRow {
  call_id: string;
  created_at: string;
  phone_number: string | null;
  duration_seconds: number | null;
  interrupt_count: number;
  lead_captured: boolean;
  transcript_has_email: boolean;
  transcript_has_phone: boolean;
  lead_email_matches_transcript: boolean | null;
  lead_phone_matches_transcript: boolean | null;
  summary_mentions_lead: boolean;
  quality_flags: string[];
  manual_scorecard: {
    stt_accuracy: string;
    llm_on_script: string;
    latency: string;
    lead_correct: string;
  };
}

export interface CallEvalSummary {
  evaluated: number;
  lead_capture_rate: number;
  avg_interrupt_count: number;
  calls_with_transcript_pii: number;
  lead_mismatch_count: number;
  rows: CallEvalRow[];
}

function parseLeadFromSummary(summary: string | null | undefined): {
  email?: string;
  phone?: string;
} {
  if (!summary) return {};
  const emailMatch = summary.match(
    /[\w.+-]+@[\w.-]+\.[a-zA-Z]{2,}/,
  );
  const phoneMatch = summary.match(/\+?\d{10,15}/);
  return {
    email: emailMatch?.[0]?.toLowerCase(),
    phone: phoneMatch?.[0],
  };
}

export function evaluateTranscript(
  transcript: string | null | undefined,
  summary: string | null | undefined,
  interruptCount = 0,
): Omit<CallEvalRow, 'call_id' | 'created_at' | 'phone_number' | 'duration_seconds'> {
  const text = transcript ?? '';
  const emails = extractEmailsFromText(text);
  const phones = extractPhonesFromText(text);
  const summaryLead = parseLeadFromSummary(summary);
  const leadCaptured =
    Boolean(summary?.includes('Lead captured')) ||
    Boolean(summaryLead.email || summaryLead.phone);

  const qualityFlags: string[] = [];
  if (interruptCount >= 3) qualityFlags.push('high_interrupts');
  if (!text || text === 'unavailable') qualityFlags.push('missing_transcript');
  if (leadCaptured && emails.length === 0 && !summaryLead.email) {
    qualityFlags.push('lead_without_transcript_email');
  }

  let emailMatch: boolean | null = null;
  let phoneMatch: boolean | null = null;
  if (summaryLead.email) {
    emailMatch = emails.includes(summaryLead.email);
    if (!emailMatch) qualityFlags.push('lead_email_mismatch');
  }
  if (summaryLead.phone) {
    const normSummary = summaryLead.phone.replace(/\D/g, '');
    phoneMatch = phones.some(
      (p) => p.replace(/\D/g, '').endsWith(normSummary.slice(-10)),
    );
    if (!phoneMatch) qualityFlags.push('lead_phone_mismatch');
  }

  return {
    interrupt_count: interruptCount,
    lead_captured: leadCaptured,
    transcript_has_email: emails.length > 0,
    transcript_has_phone: phones.length > 0,
    lead_email_matches_transcript: emailMatch,
    lead_phone_matches_transcript: phoneMatch,
    summary_mentions_lead: leadCaptured,
    quality_flags: qualityFlags,
    manual_scorecard: {
      stt_accuracy: emails.length || phones.length ? 'review' : '—',
      llm_on_script: 'review',
      latency: interruptCount <= 1 ? 'likely_ok' : 'review',
      lead_correct:
        leadCaptured && !qualityFlags.includes('lead_email_mismatch')
          ? 'likely_ok'
          : leadCaptured
            ? 'review'
            : 'n/a',
    },
  };
}

export async function evaluateCallLogs(
  limit = 50,
  scope?: { userId: string; agentId: string },
): Promise<CallEvalSummary> {
  if (!process.env.DATABASE_URL) {
    return {
      evaluated: 0,
      lead_capture_rate: 0,
      avg_interrupt_count: 0,
      calls_with_transcript_pii: 0,
      lead_mismatch_count: 0,
      rows: [],
    };
  }

  const rows = await prisma.callLog.findMany({
    where: scope
      ? { userId: scope.userId, agentId: scope.agentId }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      createdAt: true,
      phoneNumber: true,
      durationSeconds: true,
      transcript: true,
      summary: true,
      interruptCount: true,
    },
  });

  const evalRows: CallEvalRow[] = rows.map((row) => {
    const partial = evaluateTranscript(
      row.transcript,
      row.summary,
      row.interruptCount ?? 0,
    );
    return {
      call_id: row.id.toString(),
      created_at: row.createdAt.toISOString(),
      phone_number: row.phoneNumber,
      duration_seconds: row.durationSeconds,
      ...partial,
    };
  });

  const withLead = evalRows.filter((r) => r.lead_captured).length;
  const withPii = evalRows.filter(
    (r) => r.transcript_has_email || r.transcript_has_phone,
  ).length;
  const mismatches = evalRows.filter((r) =>
    r.quality_flags.some((f) => f.includes('mismatch')),
  ).length;
  const avgInterrupt =
    evalRows.length > 0
      ? evalRows.reduce((a, r) => a + r.interrupt_count, 0) / evalRows.length
      : 0;

  return {
    evaluated: evalRows.length,
    lead_capture_rate:
      evalRows.length > 0
        ? Math.round((withLead / evalRows.length) * 100)
        : 0,
    avg_interrupt_count: Number(avgInterrupt.toFixed(1)),
    calls_with_transcript_pii: withPii,
    lead_mismatch_count: mismatches,
    rows: evalRows,
  };
}

export function formatEvalReport(summary: CallEvalSummary): string {
  const lines = [
    `Call quality eval — ${summary.evaluated} calls`,
    `Lead capture rate: ${summary.lead_capture_rate}%`,
    `Avg interrupts: ${summary.avg_interrupt_count}`,
    `Transcripts with email/phone: ${summary.calls_with_transcript_pii}`,
    `Lead mismatches: ${summary.lead_mismatch_count}`,
    '',
  ];
  for (const row of summary.rows.slice(0, 20)) {
    lines.push(
      `#${row.call_id} ${row.phone_number ?? '?'} ${row.duration_seconds ?? 0}s ` +
        `flags=[${row.quality_flags.join(',') || 'none'}]`,
    );
  }
  return lines.join('\n');
}

// Re-export for scripts
export { validateEmail, validatePhone };
