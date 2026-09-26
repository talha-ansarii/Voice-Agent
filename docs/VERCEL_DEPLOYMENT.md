# Vercel Deployment Guide & Feasibility

[← Documentation index](README.md)

Production for this repo is **Hetzner CX22 + Coolify**: [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md). Do not put the LiveKit worker on Vercel.

Vercel is popular for Next.js, but **it is not the right host for this voice agent.**

Here is a breakdown of how Vercel works and why a platform like **Coolify**, **Render**, or **DigitalOcean** is required for your specific architecture.

---

## 🏗️ How Vercel Works (Serverless)

Vercel operates on a "Serverless" architecture. 
This means that there isn't actually a computer running 24/7 waiting for your code. Instead, when a user visits a Vercel URL, Vercel "spins up" a tiny function, runs your code for a fraction of a second to generate the webpage or API response, and then immediately "kills" the function to save money and resources.

By default, Vercel Serverless Functions have a **maximum execution timeout of 10 seconds** (on the free tier) to 60 seconds (on paid tiers).

## ⚠️ Why the Voice Agent Fails on Vercel

Your LiveKit Voice Agent (`src/agent`) has two fundamental requirements that directly clash with Vercel's architecture:

### 1. It Needs to Run Continuously (Background Worker)
A LiveKit worker operates by opening a continuous, persistent connection to the LiveKit Cloud. It sits there, 24/7, waiting for the LiveKit Cloud to say "Hey, I have a phone call for you to answer." 
Vercel cannot run persistent background workers. If you try to run `npm run agent:start` on Vercel, it will run for 10 seconds, and then Vercel will terminate the process. Your agent would go completely offline.

### 2. It Uses WebSockets (Persistent Streaming)
Voice calls require bi-directional, real-time audio streaming. You can't chunk audio into standard HTTP web requests. LiveKit uses WebSockets to stream your voice to the AI, and the AI's voice back to you in real-time. Vercel Serverless Functions do not natively support holding open raw, long-lived WebSocket connections for minutes at a time (like the duration of a phone call).

---

## 🟢 The Solution: Long-Lived Servers

To host an AI Voice Agent, you need a "Daemon" or a "Docker Container" that runs 24/7. 

This is exactly what **Coolify on a Hetzner CX22** does. See [COOLIFY_DEPLOYMENT.md](COOLIFY_DEPLOYMENT.md). 

### Other Alternatives to Coolify:
If you want the "Vercel Experience" (auto-deploying from GitHub) but for backend services that need to run 24/7, you should look at:
1. **Render.com** (Use their "Background Worker" service type)
2. **Railway.app** 
3. **Fly.io**
4. **DigitalOcean App Platform**

All of these platforms allow you to push your code to GitHub and they will automatically build and reboot your 24/7 Voice Agent container.

---

## 🎨 What *Can* You Put on Vercel?
While you can't put the voice worker on Vercel, you *can* use Vercel for the front-end!

If you build a beautiful React/Next.js dashboard to manage your Med Spa (viewing analytics, seeing call logs), you would host that dashboard on Vercel. 
- **Vercel** hosts the pretty UI.
- **Coolify** hosts the heavy Python Voice Agent.
- They talk to each other over the internet.
