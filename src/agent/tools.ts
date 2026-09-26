import { llm } from '@livekit/agents';
import { z } from 'zod';
import { getAvailableSlots } from '../lib/calendar.js';
import { saveLead } from '../lib/db.js';
import { getSipClient } from '../lib/livekit-clients.js';
import { validateLeadInput } from '../lib/lead-validation.js';
import type { CallLifecycle } from './call-lifecycle.js';

export interface BookingIntent {
  start_time: string;
  caller_name: string;
  caller_phone: string;
  notes: string;
}

export interface LeadSaved {
  name: string;
  email: string;
  phone: string;
  requirements: string;
  interest_level: string;
}

export interface AgentToolsState {
  callerPhone: string;
  callerName: string;
  roomName: string;
  sipIdentity: string | null;
  bookingIntent: BookingIntent | null;
  leadSaved: LeadSaved | null;
  userId?: string;
  agentId?: string;
}

export function createAgentTools(
  state: AgentToolsState,
  lifecycle: CallLifecycle,
): llm.ToolContext {
  const transferCall = llm.tool({
    description: 'Transfer this call to a human agent.',
    execute: async () => {
      console.log('[TOOL] transfer_call triggered');
      let destination = process.env.DEFAULT_TRANSFER_NUMBER ?? '';
      const sipDomain = process.env.VOBIZ_SIP_DOMAIN ?? '';
      if (destination && sipDomain && !destination.includes('@')) {
        const clean = destination.replace('tel:', '').replace('sip:', '');
        destination = `sip:${clean}@${sipDomain}`;
      }
      if (destination && !destination.startsWith('sip:')) {
        destination = `sip:${destination}`;
      }
      try {
        if (
          state.roomName &&
          destination &&
          state.sipIdentity
        ) {
          const sip = getSipClient();
          await sip.transferSipParticipant(
            state.roomName,
            state.sipIdentity,
            destination,
            { playDialtone: false },
          );
          return 'Transfer initiated successfully.';
        }
        return 'Unable to transfer right now.';
      } catch (e) {
        console.error('Transfer failed:', e);
        return 'Unable to transfer right now.';
      }
    },
  });

  const endCall = llm.tool({
    description:
      'Hang up the phone. Call IMMEDIATELY after your goodbye when the conversation is over, the caller is not interested, or they ask to end the call.',
    execute: async () => {
      console.log('[TOOL] end_call triggered');
      void lifecycle.terminateCall('end_call tool');
      return 'Call ended.';
    },
  });

  const saveBookingIntent = llm.tool({
    description:
      'Save booking intent after caller confirms appointment.',
    parameters: z.object({
      start_time: z.string().describe('ISO 8601 datetime'),
      caller_name: z.string().describe('Full name'),
      caller_phone: z.string().describe('Phone number'),
      notes: z.string().optional().describe('Notes or email'),
    }),
    execute: async ({ start_time, caller_name, caller_phone, notes }) => {
      console.log(`[TOOL] save_booking_intent: ${caller_name} at ${start_time}`);
      state.bookingIntent = {
        start_time,
        caller_name,
        caller_phone,
        notes: notes ?? '',
      };
      state.callerName = caller_name;
      return `Booking intent saved for ${caller_name} at ${start_time}.`;
    },
  });

  const checkAvailability = llm.tool({
    description: 'Check available appointment slots for a date.',
    parameters: z.object({
      date: z.string().describe('YYYY-MM-DD'),
    }),
    execute: async ({ date }) => {
      try {
        const slots = await getAvailableSlots(date);
        if (!slots.length) return `No available slots on ${date}.`;
        const labels = slots.slice(0, 6).map((s) => {
          const t = s.start_time ?? s.time;
          return t.slice(-8, -3);
        });
        return `Available slots on ${date}: ${labels.join(', ')} IST.`;
      } catch (e) {
        console.error('[TOOL] check_availability failed:', e);
        return "I'm having trouble checking the calendar right now.";
      }
    },
  });

  const getBusinessHours = llm.tool({
    description: 'Check business operating hours.',
    execute: async () => {
      const now = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }),
      );
      const hours: Array<[string, string | null, string | null]> = [
        ['Monday', '10:00', '19:00'],
        ['Tuesday', '10:00', '19:00'],
        ['Wednesday', '10:00', '19:00'],
        ['Thursday', '10:00', '19:00'],
        ['Friday', '10:00', '19:00'],
        ['Saturday', '10:00', '17:00'],
        ['Sunday', null, null],
      ];
      const [dayName, openT, closeT] = hours[now.getDay() === 0 ? 6 : now.getDay() - 1] ?? hours[0];
      const currentTime = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      if (!openT) return 'We are closed on Sundays.';
      if (openT <= currentTime && currentTime <= closeT!) {
        return `We are OPEN. Today (${dayName}): ${openT}–${closeT} IST.`;
      }
      return `We are CLOSED. Today (${dayName}): ${openT}–${closeT} IST.`;
    },
  });

  const saveLeadTool = llm.tool({
    description:
      "Save a qualified outreach lead. Call ONLY after the caller has confirmed their name, email, and phone aloud.",
    parameters: z.object({
      name: z.string().describe('Full name of the prospect'),
      email: z.string().describe('Email address of the prospect'),
      phone: z.string().describe('Phone with country code e.g. +91XXXXXXXXXX'),
      requirements: z
        .string()
        .optional()
        .describe('Project type, pain points, timeline'),
      interest_level: z
        .enum(['low', 'medium', 'high'])
        .optional()
        .describe('Interest level'),
      confirmed_by_caller: z
        .boolean()
        .describe(
          'True only if the caller explicitly confirmed email and phone after you read them back',
        ),
    }),
    execute: async ({
      name,
      email,
      phone,
      requirements,
      interest_level,
      confirmed_by_caller,
    }) => {
      console.log(`[TOOL] save_lead: ${name} <${email}> ${phone}`);
      const validation = validateLeadInput({
        name,
        email,
        phone,
        confirmedByCaller: confirmed_by_caller,
      });
      if (!validation.valid || !validation.normalized) {
        const msg = validation.errors.join(' ');
        console.warn(`[TOOL] save_lead rejected: ${msg}`);
        return `Cannot save lead yet: ${msg} Ask the caller to confirm details.`;
      }

      const result = await saveLead({
        name: name.trim(),
        email: validation.normalized.email,
        phone: validation.normalized.phone,
        requirements: requirements ?? '',
        interestLevel: interest_level ?? 'medium',
        source: 'outbound_call',
        callRoomId: state.roomName,
        userId: state.userId ?? null,
        agentId: state.agentId ?? null,
      });
      if (result.success) {
        state.leadSaved = {
          name: name.trim(),
          email: validation.normalized.email,
          phone: validation.normalized.phone,
          requirements: requirements ?? '',
          interest_level: interest_level ?? 'medium',
        };
        state.callerName = name.trim();
        return `Lead saved for ${name.trim()}. Our team will follow up soon.`;
      }
      return `Could not save lead: ${result.message ?? 'unknown error'}`;
    },
  });

  return {
    transfer_call: transferCall,
    end_call: endCall,
    save_booking_intent: saveBookingIntent,
    save_lead: saveLeadTool,
    check_availability: checkAvailability,
    get_business_hours: getBusinessHours,
  };
}
