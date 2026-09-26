# Build a Voice Agent from Scratch — Step-by-Step Tutorial

[← Documentation index](README.md)

This tutorial teaches you how to build a **phone-call voice agent** like the one in this repo: real-time speech, an LLM brain, tool calling, Postgres storage, and both **inbound** and **outbound** calls over SIP.

You do not need to read the whole codebase first. Follow the steps in order. Each section explains **what** you are building, **why** it exists, and **where** it lives in this project.

---

## What you are building

A voice agent is not one script — it is a small system:

```mermaid
flowchart LR
  subgraph phone [Phone network]
    Caller[PSTN caller]
  end

  subgraph lk [LiveKit Cloud]
    Room[Room + audio]
    Dispatch[Agent dispatch]
  end

  subgraph app [Your server]
    Worker[Agent worker]
    API[REST API]
    DB[(Postgres)]
  end

  subgraph ai [AI APIs]
    STT[Speech-to-text]
    LLM[Language model]
    TTS[Text-to-speech]
  end

  Caller <-->|SIP| Room
  Dispatch --> Worker
  Worker <--> Room
  Worker --> STT
  Worker --> LLM
  Worker --> TTS
  Worker --> DB
  API --> DB
  API --> Dispatch
```

**One sentence version:** LiveKit moves audio between the phone and your worker; your worker runs STT → LLM → TTS in a loop; tools let the LLM take actions; Postgres stores leads and call logs.

| Piece | Technology in this repo |
|-------|-------------------------|
| Real-time audio + telephony | [LiveKit](https://docs.livekit.io/) + SIP trunk |
| Agent framework | `@livekit/agents` (TypeScript) |
| STT / TTS | Sarvam (Indian languages) — swappable |
| LLM | Gemini (default) — swappable |
| Database | Postgres via Prisma (Supabase) |
| Dashboard API | Express (`src/server/`) |
| UI | Next.js (`frontend/`) |

---

## Prerequisites

Before you start, create accounts and keys for:

1. **LiveKit Cloud** — rooms, agent dispatch, SIP
2. **An LLM provider** — e.g. Google Gemini (`GEMINI_API_KEY`)
3. **STT/TTS provider** — e.g. Sarvam (`SARVAM_API_KEY`)
4. **Postgres** — Supabase is the easiest path
5. **SIP provider** (for real phone calls) — e.g. Vobiz, Twilio, or LiveKit’s SIP partners

You also need **Node.js 20+**.

---

## Step 1 — Understand the call types

This agent handles three modes:

| Type | Who initiates | How the worker knows |
|------|---------------|----------------------|
| **Inbound** | Someone calls your number | SIP participant already in the room |
| **Outbound** | You dial a number | Job metadata contains `phone_number` |
| **Demo** | Browser WebRTC test | Metadata has `is_demo: true` |

Detection logic lives in `src/lib/call-types.ts`:

```typescript
export enum CallType {
  INBOUND = 'inbound',
  OUTBOUND = 'outbound',
  DEMO = 'demo',
}

export function detectCallType(ctx, metadata): CallType {
  if (metadata.call_type) return metadata.call_type;
  if (metadata.is_demo) return CallType.DEMO;
  if (hasSipParticipant(ctx)) return CallType.INBOUND;
  if (metadata.phone_number?.startsWith('+')) return CallType.OUTBOUND;
  return CallType.INBOUND;
}
```

**Why this matters:** inbound and outbound use different greeting timing and different SIP setup (see Step 8).

---

## Step 2 — Scaffold the project

### 2.1 Install dependencies

```bash
npm init -y
npm install @livekit/agents @livekit/agents-plugin-google \
  @livekit/agents-plugin-sarvam @livekit/agents-plugin-openai \
  livekit-server-sdk @prisma/client dotenv express zod
npm install -D typescript tsx prisma @types/node @types/express
```

### 2.2 Folder layout (match this repo)

```
src/
├── agent/
│   ├── index.ts       # Worker entry — registers with LiveKit
│   ├── entrypoint.ts  # Per-call logic (connect, dial, session)
│   ├── pipeline.ts    # STT + LLM + TTS wiring
│   ├── assistant.ts   # System prompt + greeting
│   ├── tools.ts       # LLM tools (save_lead, end_call, …)
│   ├── events.ts      # Turn limits, live transcript hooks
│   └── post-call.ts   # Runs when the call ends
├── server/
│   └── index.ts       # REST API for dashboard + outbound trigger
└── lib/
    ├── config.ts      # config.json loader
    ├── dispatch.ts    # Outbound: create agent dispatch
    ├── db.ts          # Prisma helpers
    ├── prisma.ts      # Prisma client singleton
    └── call-types.ts
prisma/schema.prisma
config.json            # Prompts and model settings (no secrets)
.env                   # API keys (never commit)
```

### 2.3 Environment variables

Copy `.env.example` to `.env`. Minimum set:

```env
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...

GEMINI_API_KEY=...
SARVAM_API_KEY=...

DATABASE_URL=postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require

OUTBOUND_TRUNK_ID=ST_xxxx   # for outbound SIP dial
```

**Tip:** If your database password contains `@` or `!`, URL-encode it (`@` → `%40`, `!` → `%21`). See [PRISMA_SETUP.md](PRISMA_SETUP.md).

### 2.4 Agent name (critical for telephony)

The worker registers under a fixed name. In this repo it is **`outbound-caller`** (`src/lib/dispatch.ts`).

Your LiveKit **inbound dispatch rule** must point to the same name, or inbound calls will never reach the worker.

---

## Step 3 — Register the worker

`src/agent/index.ts` is the process LiveKit starts:

```typescript
import 'dotenv/config';
import { cli, ServerOptions } from '@livekit/agents';
import { fileURLToPath } from 'node:url';

const agentPath = fileURLToPath(new URL('./entrypoint.js', import.meta.url));

cli.runApp(
  new ServerOptions({
    agent: agentPath,
    agentName: process.env.LIVEKIT_AGENT_NAME ?? 'outbound-caller',
  }),
);
```

Run in development:

```bash
npm run agent:dev
# → tsx src/agent/index.ts dev
```

You should see the worker connect to LiveKit and wait for jobs. No job = no call yet. That is normal.

---

## Step 4 — Build the voice pipeline (STT → LLM → TTS)

The pipeline turns microphone audio into speech the caller hears. In `src/agent/pipeline.ts`:

```typescript
import { voice } from '@livekit/agents';
import * as google from '@livekit/agents-plugin-google';
import * as sarvam from '@livekit/agents-plugin-sarvam';

export function buildSession(liveConfig) {
  return new voice.AgentSession({
    stt: new sarvam.STT({
      languageCode: liveConfig.stt_language,
      model: 'saaras:v3',
    }),
    llm: new google.LLM({
      model: liveConfig.llm_model || 'gemini-2.0-flash',
      apiKey: process.env.GEMINI_API_KEY,
      maxOutputTokens: 150,
    }),
    tts: new sarvam.TTS({
      targetLanguageCode: liveConfig.tts_language,
      speaker: liveConfig.tts_voice,
      model: 'bulbul:v3',
    }),
    turnHandling: {
      turnDetection: 'stt',
      endpointing: { minDelay: 200 },
    },
  });
}
```

**Concepts:**

- **STT** listens and produces text when the user stops speaking.
- **LLM** reads the conversation + system prompt and decides what to say (and which tools to call).
- **TTS** converts the LLM’s reply into audio.
- **Turn handling** controls when the agent considers the user “done talking.”

Tune behavior in `config.json` (model names, voice, delays) — not in code.

---

## Step 5 — Create the assistant (system prompt + greeting)

`src/agent/assistant.ts` subclasses `voice.Agent`:

```typescript
export class VoiceAssistant extends voice.Agent {
  constructor({ tools, liveConfig, deferGreeting }) {
    super({
      instructions: liveConfig.agent_instructions + extraRules,
      tools,
    });
    this.deferGreeting = deferGreeting;
  }

  async onEnter() {
    if (!this.deferGreeting) await this.speakGreeting();
  }

  async speakGreeting() {
    await this.session.say(liveConfig.first_line, {
      allowInterruptions: false,
      addToChatCtx: true,
    });
  }
}
```

Put your personality and flow in `config.json`:

```json
{
  "agent_instructions": "You are a friendly receptionist. Keep replies to 2 short sentences. Collect name and email, then call save_lead.",
  "first_line": "Hi! Thanks for calling. How can I help you today?",
  "first_line_outbound": "Hi, this is Alex from Acme Corp. Do you have 30 seconds?",
  "llm_model": "gemini-2.0-flash",
  "llm_provider": "gemini",
  "tts_voice": "kavya",
  "tts_language": "hi-IN"
}
```

**Outbound trick:** set `deferGreeting: true` so the agent waits until the callee answers before speaking (`entrypoint.ts` calls `speakGreeting()` after the SIP dial succeeds).

---

## Step 6 — Connect the database (Prisma + Postgres)

### 6.1 Define models

`prisma/schema.prisma` maps tables the agent uses:

| Model | Purpose |
|-------|---------|
| `CallLog` | Finished calls — transcript, duration, sentiment |
| `CallTranscript` | Live per-turn stream during a call |
| `ActiveCall` | Currently ringing / active calls |
| `Lead` | Prospects captured via `save_lead` tool |

Example — leads table:

```prisma
model Lead {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  createdAt     DateTime @default(now()) @map("created_at")
  name          String?
  email         String?
  phone         String?
  requirements  String?  @db.Text
  status        String?  @default("new")
  callRoomId    String?  @map("call_room_id")

  @@map("leads")
}
```

### 6.2 Apply migrations

```bash
npx prisma migrate deploy
npx prisma generate
```

### 6.3 Write a thin DB layer

Never sprinkle `prisma.lead.create()` everywhere. Centralize in `src/lib/db.ts`:

```typescript
import { prisma } from './prisma.js';

export async function saveLead(input: {
  name: string;
  email: string;
  phone: string;
  requirements?: string;
  callRoomId?: string;
}) {
  if (!process.env.DATABASE_URL) {
    return { success: false, message: 'DATABASE_URL not configured' };
  }
  const row = await prisma.lead.create({ data: input });
  return { success: true, data: row };
}

export async function insertTranscript(data: {
  callRoomId: string;
  phone: string;
  role: string;
  content: string;
}) {
  await prisma.callTranscript.create({ data });
}
```

**Pattern:** tools and post-call hooks call `db.ts` functions; the API server uses the same functions for reads.

---

## Step 7 — Add tool calling (LLM actions)

Tools let the LLM **do things**, not just talk. LiveKit uses `llm.tool()` with Zod schemas.

### 7.1 Minimal example — end call

In `src/agent/tools.ts`:

```typescript
import { llm } from '@livekit/agents';
import { z } from 'zod';
import { saveLead } from '../lib/db.js';

export function createAgentTools(state) {
  const save_lead = llm.tool({
    description:
      'Save lead after collecting name, email, phone, and requirements.',
    parameters: z.object({
      name: z.string(),
      email: z.string(),
      phone: z.string(),
      requirements: z.string().optional(),
    }),
    execute: async ({ name, email, phone, requirements }) => {
      const result = await saveLead({
        name, email, phone,
        requirements: requirements ?? '',
        callRoomId: state.roomName,
      });
      if (result.success) {
        state.leadSaved = { name, email, phone, requirements };
        return `Lead saved for ${name}.`;
      }
      return 'Could not save lead.';
    },
  });

  const end_call = llm.tool({
    description: 'End the call after goodbye.',
    execute: async () => {
      // SIP hangup via transfer to invalid number, or room disconnect
      return 'Call ended.';
    },
  });

  return { save_lead, end_call };
}
```

### 7.2 Wire tools into the agent

In `entrypoint.ts`:

```typescript
const toolsState = {
  callerPhone,
  roomName: ctx.room.name,
  sipIdentity: null,
  leadSaved: null,
};

const tools = createAgentTools(toolsState);
const agent = new VoiceAssistant({ tools, liveConfig });
```

### 7.3 Teach the LLM when to use tools

Add explicit instructions in `config.json`:

```json
{
  "agent_instructions": "...\n4. When you have name, email, phone → call save_lead ONCE.\n5. Say goodbye → call end_call."
}
```

**Rules of thumb:**

- One tool = one clear job.
- Descriptions are prompts — be specific.
- Return short strings the LLM can read aloud or reason about.
- Use `state` to pass data to post-call logic (e.g. `leadSaved`).

### 7.4 Tools in this repo

| Tool | What it does |
|------|----------------|
| `save_lead` | Inserts row in `leads` |
| `save_booking_intent` | Stores intent; Cal.com booking runs after hangup |
| `check_availability` | Calls Cal.com API |
| `transfer_call` | SIP REFER to human |
| `end_call` | Hangs up |
| `get_business_hours` | Static schedule lookup |

---

## Step 8 — Inbound calls (someone calls you)

### 8.1 LiveKit setup

1. Create an **inbound SIP trunk** in LiveKit (your provider’s SIP URI).
2. Create a **dispatch rule** that routes inbound calls to agent name `outbound-caller`.
3. Point your phone number’s SIP destination at LiveKit.

### 8.2 What the worker does

When a PSTN caller connects, they appear as a **SIP participant** in a LiveKit room. LiveKit dispatches your worker. In `entrypoint.ts`:

```typescript
await ctx.connect();                    // join the room
const callType = detectCallType(ctx, metadata);  // → INBOUND

// SIP participant already present — no dial step
const participant = resolveSipParticipant(ctx);
toolsState.sipIdentity = participant?.identity ?? 'inbound_caller';

const session = buildSession(liveConfig);
await session.start({ agent, room: ctx.room });

// Greeting plays immediately (deferGreeting = false)
```

```mermaid
sequenceDiagram
  participant Caller
  participant SIP as SIP trunk
  participant LK as LiveKit
  participant Agent as Worker

  Caller->>SIP: Dials your number
  SIP->>LK: Inbound SIP
  LK->>Agent: Dispatch job
  Agent->>LK: connect + session.start
  Agent->>Caller: Greeting + conversation
```

---

## Step 9 — Outbound calls (you call someone)

Outbound is a **two-step** process: dispatch the agent, then dial the phone.

### 9.1 Dispatch (create room + wake worker)

`src/lib/dispatch.ts`:

```typescript
import { AgentDispatchClient } from 'livekit-server-sdk';

export async function dispatchCall(phone: string) {
  const client = new AgentDispatchClient(url, apiKey, apiSecret);
  const room = `call-${phone.replace('+', '')}-${randomId()}`;
  const metadata = JSON.stringify({
    phone_number: phone,
    call_type: 'outbound',
  });

  const dispatch = await client.createDispatch(room, 'outbound-caller', {
    metadata,
  });
  return { room, dispatchId: dispatch.id };
}
```

Trigger from CLI:

```bash
npm run call -- +91XXXXXXXXXX
```

Or from the API: `POST /api/call/single` with `{ "phone": "+91..." }`.

### 9.2 Dial (worker places the SIP call)

After the worker connects, `entrypoint.ts` calls `dialOutbound`:

```typescript
if (callType === CallType.OUTBOUND) {
  const sipIdentity = await dialOutbound(ctx, phoneNumber, liveConfig);
  if (!sipIdentity) return;  // no answer / trunk error

  toolsState.sipIdentity = sipIdentity;
  await agent.speakGreeting();  // only after answer
}
```

`dialOutbound` uses LiveKit’s `SipClient.createSipParticipant` with `waitUntilAnswered: true`.

```mermaid
sequenceDiagram
  participant API as API / CLI
  participant LK as LiveKit
  participant Agent as Worker
  participant Callee

  API->>LK: createDispatch(outbound-caller)
  LK->>Agent: Job with phone metadata
  Agent->>LK: connect to room
  Agent->>Callee: SIP outbound dial
  Callee-->>Agent: answers
  Agent->>Callee: deferred greeting
```

### 9.3 Outbound checklist

| Check | Env / config |
|-------|----------------|
| Outbound trunk exists | `OUTBOUND_TRUNK_ID` |
| Trunk credentials correct | `npm run setup:trunk` |
| Worker name matches dispatch | `outbound-caller` |
| Phone in E.164 format | `+91XXXXXXXXXX` |

---

## Step 10 — Post-call: save transcript and analytics

When the room closes, run cleanup once via `ctx.addShutdownCallback` (`src/agent/post-call.ts`):

1. Finalize booking (if `save_booking_intent` was used).
2. Build full transcript from chat history.
3. Optional: sentiment via Gemini.
4. Stop recording egress → S3 URL.
5. `saveCallLog()` → `call_logs` table.
6. Update `active_calls` status to `completed`.

Hook registration in `entrypoint.ts`:

```typescript
ctx.addShutdownCallback(makeShutdownHook({
  ctx, agent, toolsState, callerPhone,
  callStartTime, egressId, callType,
}));
```

**Live transcripts** during the call go to `call_transcripts` via `insertTranscript` in session events (`src/agent/events.ts`).

---

## Step 11 — API server (dashboard + triggers)

`src/server/index.ts` is a small Express app:

| Route | Purpose |
|-------|---------|
| `GET /api/logs` | List call history |
| `GET /api/leads` | List captured leads |
| `POST /api/call/single` | Trigger outbound call |
| `GET /api/demo-token` | Browser demo JWT |
| `GET /health` | Health check |

Run it:

```bash
npm run server:dev   # port 8000
```

The Next.js dashboard (`npm run dashboard`, port 3000) calls these APIs.

---

## Step 12 — Run everything locally

**Terminal 1 — API:**

```bash
npm run server:dev
```

**Terminal 2 — Agent worker:**

```bash
npm run agent:dev
```

**Terminal 3 — Dashboard (optional):**

```bash
npm run dashboard
```

**Test outbound:**

```bash
npm run call -- +91XXXXXXXXXX
```

**Test browser demo:** open `http://localhost:8000/demo` (needs both API + agent running).

---

## Step 13 — Customize your agent

| Goal | Where to change |
|------|-----------------|
| Personality / script | `config.json` → `agent_instructions`, `first_line` |
| Model / voice | `config.json` → `llm_model`, `tts_voice`, `stt_language` |
| New tool | Add to `src/agent/tools.ts` + mention in prompt |
| New DB table | `prisma/schema.prisma` → migrate → `src/lib/db.ts` |
| Per-phone config | `configs/{phone}.json` (optional overrides) |
| Transfer target | `DEFAULT_TRANSFER_NUMBER` in `.env` |

---

## Common mistakes

| Symptom | Likely cause |
|---------|----------------|
| Inbound rings but agent silent | Dispatch rule agent name ≠ worker `agentName` |
| Outbound never rings | Wrong `OUTBOUND_TRUNK_ID` or trunk not in same LiveKit project |
| `tenant/user not found` (Prisma) | Invalid Supabase project ref or deleted project |
| Tools never called | Prompt does not instruct when to use them |
| Agent talks before callee answers | `deferGreeting` not set for outbound |
| No rows in database | `DATABASE_URL` missing or migrate not applied |

---

## Mental model (summary)

1. **LiveKit** = audio highway + phone bridge.
2. **Worker** = your code that joins a room per call.
3. **AgentSession** = STT / LLM / TTS loop.
4. **Tools** = functions the LLM can invoke mid-conversation.
5. **Prisma** = persistence for leads, logs, live transcripts.
6. **Dispatch** = how outbound/demo calls start.
7. **SIP participant** = how inbound/outbound phone audio enters the room.

---

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — full system design for this repo
- [PRISMA_SETUP.md](PRISMA_SETUP.md) — database connection strings
- [QUICKSTART.md](QUICKSTART.md) — fast local setup
- [transfer_call.md](transfer_call.md) — SIP transfer to a human
- [LiveKit Agents docs](https://docs.livekit.io/agents/)

---

## Exercise: build a minimal agent in one afternoon

If you want hands-on practice, try this sequence:

1. Get `npm run agent:dev` connected to LiveKit (no DB yet).
2. Change `first_line` in `config.json` and hear it on a demo call.
3. Add Prisma + `save_lead` tool; verify row in `npm run db:studio`.
4. Configure inbound SIP + dispatch rule; call your number.
5. Set `OUTBOUND_TRUNK_ID`; run `npm run call -- +yourphone`.
6. Add `GET /api/leads` and view results in the dashboard.

Each step builds on the last. That is exactly how this repository was structured.
