"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Phone,
  PhoneOutgoing,
  Plus,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  api,
  getSelectedAgentId,
  setSelectedAgentId,
  type StudioAgent,
} from "@/lib/api";

const nav = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calls", label: "Call Logs", icon: Phone },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/outbound", label: "Outbound", icon: PhoneOutgoing },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [agents, setAgents] = useState<StudioAgent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const current = agents.find((a) => a.id === agentId) ?? agents[0];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.getAgents();
        if (cancelled) return;
        setAgents(list);
        const stored = getSelectedAgentId();
        const next =
          list.find((a) => a.id === stored)?.id ??
          session?.user.defaultAgentId ??
          list[0]?.id ??
          "";
        if (next) {
          setSelectedAgentId(next);
          setAgentId(next);
        }
      } catch {
        /* session may still be loading */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user.defaultAgentId]);

  async function onSelectAgent(id: string) {
    setSelectedAgentId(id);
    setAgentId(id);
    setOpen(false);
    window.location.reload();
  }

  async function onNewAgent() {
    const name = window.prompt("Agent name", "New agent");
    if (!name) return;
    setCreating(true);
    try {
      const created = await api.createAgent(name);
      setAgents((prev) => [...prev, created]);
      await onSelectAgent(created.id);
    } catch (e) {
      window.alert(e instanceof Error ? e.message : "Could not create agent");
      setCreating(false);
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0B132B] text-white">
      <div className="mx-auto flex h-16 w-full max-w-[90rem] items-center gap-3 px-4 sm:gap-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7209B7] text-sm font-bold">
            A
          </div>
          <p className="hidden text-sm font-semibold sm:block">Agent Studio</p>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-left hover:bg-white/10"
            aria-expanded={open}
            aria-haspopup="listbox"
          >
            <span className="text-xs text-white/60">Agents</span>
            <span className="max-w-[140px] truncate text-sm font-medium">
              {current?.name ?? "Select agent"}
            </span>
            <ChevronDown
              className={cn("h-4 w-4 text-white/70 transition", open && "rotate-180")}
            />
          </button>
          {open && (
            <div
              role="listbox"
              className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-white py-1 text-navy shadow-card"
            >
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted">
                Your agents
              </p>
              {agents.map((agent) => (
                <button
                  key={agent.id}
                  type="button"
                  role="option"
                  aria-selected={agent.id === current?.id}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-surface",
                    agent.id === current?.id && "bg-[#4CC9F0]/10"
                  )}
                  onClick={() => void onSelectAgent(agent.id)}
                >
                  <span className="block font-medium">{agent.name}</span>
                  {agent.id === current?.id && (
                    <span className="h-2 w-2 rounded-full bg-[#4CC9F0] shadow-[0_0_8px_#4CC9F0]" />
                  )}
                </button>
              ))}
              <button
                type="button"
                disabled={creating}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2.5 text-left text-sm font-medium text-[#7209B7] hover:bg-surface"
                onClick={() => void onNewAgent()}
              >
                <Plus className="h-4 w-4" />
                New agent
              </button>
            </div>
          )}
        </div>

        <nav className="ml-2 hidden min-w-0 flex-1 items-center gap-1 md:flex">
          {nav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-white/10 text-[#4CC9F0]"
                    : "text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-xs text-white/70">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#4CC9F0]/40 bg-[#4CC9F0]/10 px-3 py-1 text-[#4CC9F0]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#4CC9F0] shadow-[0_0_8px_#4CC9F0]" />
            Agent online
          </span>
          {session?.user && (
            <div className="flex items-center gap-2">
              {session.user.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={session.user.image}
                  alt=""
                  className="h-8 w-8 rounded-full"
                />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-xs">
                  {(session.user.name ?? session.user.email ?? "?").slice(0, 1)}
                </div>
              )}
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg px-2 py-1 hover:bg-white/10"
                onClick={() => void signOut({ callbackUrl: "/login" })}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <nav className="border-t border-white/10 md:hidden">
        <div className="mx-auto flex w-full max-w-[90rem] gap-1 overflow-x-auto px-4 py-2 sm:px-6 lg:px-8">
        {nav.map(({ href, label }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                active ? "bg-white/10 text-[#4CC9F0]" : "text-white/70"
              )}
            >
              {label}
            </Link>
          );
        })}
        </div>
      </nav>
    </header>
  );
}
