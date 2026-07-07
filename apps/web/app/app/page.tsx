"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Sparkles,
  Video,
  Wind,
  ArrowRight,
  Phone,
  Send,
  Waves,
} from "lucide-react";

// ---------------------------------------------------------------------------
// OpenUp — patient dashboard. Two primary flows on one surface: match with a
// provider, and launch a session. OLED-dark glassmorphic bento grid.
// Signature: a calm ~6s guided-breath cadence runs through the accents.
// ---------------------------------------------------------------------------

const spring = { type: "spring", stiffness: 300, damping: 30 } as const;

interface Match {
  therapist: {
    user: { id: string; name: string | null; image: string | null };
    specialties: string[];
    modalities: string[];
  };
  matchScore: number;
}
interface Appt {
  id: string;
  startsAt: string;
  endsAt: string;
  modality: string;
  status: string;
  therapist?: { id: string; name: string | null };
}
interface Mood {
  moodScore: number;
  createdAt: string;
}

function initials(name: string | null): string {
  if (!name) return "Dr";
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function safeArr(v: unknown): string[] {
  if (Array.isArray(v)) return v as string[];
  if (typeof v === "string") {
    try {
      const p = JSON.parse(v);
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Bento shell — glass panel with spring-in on load.
function Bento({
  children,
  className = "",
  delay = 0,
  label,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  label: string;
}) {
  return (
    <motion.section
      aria-label={label}
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ ...spring, delay }}
      className={`relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/50 backdrop-blur-md shadow-[0_8px_40px_-12px_rgba(0,0,0,0.7)] ${className}`}
    >
      {children}
    </motion.section>
  );
}

export default function PatientDashboard() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Pull the patient's intake prefs, then rank providers against them.
        const intake = await fetch("/api/intake").then((r) => (r.ok ? r.json() : null)).catch(() => null);
        const prefs = intake?.data ?? {};
        const [matchRes, apptRes, moodRes] = await Promise.all([
          fetch("/api/therapists/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              specialtyPreferences: safeArr(prefs.specialtyPreferences),
              preferredLanguage: prefs.preferredLanguage,
              careFormat: prefs.careFormat,
              paymentPreference: prefs.paymentPreference,
            }),
          }).then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
          fetch("/api/appointments?limit=50").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
          fetch("/api/mood?limit=14").then((r) => (r.ok ? r.json() : { data: [] })).catch(() => ({ data: [] })),
        ]);
        setMatches(matchRes.data ?? []);
        setAppointments(apptRes.data ?? []);
        setMoods((moodRes.data ?? []).slice().reverse());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Normalize the raw overlap score into an explainable 62–99% "AI match".
  const scored = useMemo(() => {
    const max = Math.max(1, ...matches.map((m) => m.matchScore));
    return matches.map((m) => ({
      ...m,
      pct: Math.round(62 + (m.matchScore / max) * 37),
    }));
  }, [matches]);

  const nextAppt = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((a) => (a.status === "scheduled" || a.status === "confirmed") && +new Date(a.startsAt) > now - 15 * 60000)
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt))[0];
  }, [appointments]);

  return (
    <main
      aria-label="Patient dashboard"
      className="min-h-full bg-neutral-950 text-slate-100 font-sans"
    >
      {/* Ambient wash */}
      <div className="pointer-events-none fixed inset-0 opacity-60">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute top-1/3 right-0 h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <motion.header
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={spring}
          className="mb-8"
        >
          <p className="text-sm text-slate-400">Welcome back</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Let&apos;s find your calm today.
          </h1>
        </motion.header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <ProviderMatcher matches={scored} loading={loading} className="lg:col-span-2 lg:row-span-2" />
          <VirtualRoom next={nextAppt} className="lg:col-span-1 lg:row-span-2" />
          <MindTelemetry moods={moods} className="lg:col-span-1" />
          <TriageChat className="lg:col-span-1" />
          <CrisisTile className="lg:col-span-1" />
        </div>
      </div>
    </main>
  );
}

// ---- Module 1: AI Provider Matcher (large) --------------------------------
function ProviderMatcher({
  matches,
  loading,
  className = "",
}: {
  matches: (Match & { pct: number })[];
  loading: boolean;
  className?: string;
}) {
  return (
    <Bento label="AI provider matcher" delay={0.05} className={className}>
      <div className="flex h-full flex-col p-6">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles className="size-4 text-emerald-400" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-white">Matched for you</h2>
          <span className="ml-auto text-xs text-slate-400">AI-ranked by fit</span>
        </div>

        {loading ? (
          <div className="flex gap-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-56 w-64 shrink-0 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : matches.length === 0 ? (
          <EmptyInvite
            title="No matches yet"
            body="Finish your intake and we'll rank therapists by how well they fit you."
            href="/app/onboarding"
            cta="Complete intake"
          />
        ) : (
          <div
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
            role="list"
            aria-label="Recommended providers"
          >
            {matches.map((m, i) => (
              <ProviderCard key={m.therapist.user.id} match={m} index={i} />
            ))}
          </div>
        )}
      </div>
    </Bento>
  );
}

function ProviderCard({ match, index }: { match: Match & { pct: number }; index: number }) {
  const { user, specialties } = match.therapist;
  const tags = (specialties ?? []).slice(0, 2);
  return (
    <motion.div
      role="listitem"
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={spring}
      className="flex w-64 shrink-0 snap-start flex-col rounded-2xl border border-white/10 bg-slate-800/40 p-5"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500/30 to-emerald-500/30 text-sm font-semibold text-white ring-1 ring-white/10">
          {initials(user.name)}
        </div>
        {/* Animated, glowing AI match pill */}
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300 animate-glowpulse"
          aria-label={`${match.pct} percent AI match`}
          style={{ animationDelay: `${index * 0.4}s` }}
        >
          <span className="size-1.5 rounded-full bg-emerald-400 animate-breathe" />
          <span className="tnum">{match.pct}%</span> match
        </span>
      </div>
      <p className="font-display text-base font-semibold text-white">{user.name ?? "Licensed therapist"}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.length > 0 ? (
          tags.map((t) => (
            <span key={t} className="rounded-md bg-indigo-400/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
              {t}
            </span>
          ))
        ) : (
          <span className="rounded-md bg-indigo-400/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
            General practice
          </span>
        )}
      </div>
      <Link href={`/app/providers/${user.id}`} className="mt-auto pt-4">
        <motion.span
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition-all duration-300 hover:bg-emerald-400"
        >
          Book consultation <ArrowRight className="size-4" aria-hidden />
        </motion.span>
      </Link>
    </motion.div>
  );
}

// ---- Module 2: Virtual Therapy Room (medium) ------------------------------
function VirtualRoom({ next, className = "" }: { next?: Appt; className?: string }) {
  const [now, setNow] = useState(Date.now());
  const [inRoom, setInRoom] = useState(false);
  const [notes, setNotes] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const startsAt = next ? +new Date(next.startsAt) : 0;
  const diff = startsAt - now;
  const soon = !!next && diff < 15 * 60000; // within 15 min or started
  const d = Math.max(0, diff);
  const days = Math.floor(d / 86400000);
  const hours = Math.floor((d % 86400000) / 3600000);
  const mins = Math.floor((d % 3600000) / 60000);
  const secs = Math.floor((d % 60000) / 1000);

  return (
    <Bento label="Virtual therapy room" delay={0.1} className={className}>
      <div className="flex h-full flex-col p-6">
        <div className="mb-5 flex items-center gap-2">
          <Video className="size-4 text-indigo-400" aria-hidden />
          <h2 className="font-display text-lg font-semibold text-white">Your session</h2>
        </div>

        {!next ? (
          <EmptyInvite
            title="No sessions scheduled"
            body="Book a consultation to start your first session."
            href="/app/appointments"
            cta="Book a session"
          />
        ) : (
          <>
            <p className="text-sm text-slate-400">
              with {next.therapist?.name ?? "your therapist"}
            </p>
            <p className="mb-4 text-xs text-slate-500">
              {new Date(next.startsAt).toLocaleString("en-US", {
                weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
              })}
            </p>

            {/* Countdown — crisp tabular numbers */}
            <div className="mb-6 grid grid-cols-4 gap-2 tnum" aria-label="Time until session">
              {[
                { v: days, l: "days" },
                { v: hours, l: "hrs" },
                { v: mins, l: "min" },
                { v: secs, l: "sec" },
              ].map((seg) => (
                <div key={seg.l} className="rounded-xl border border-white/10 bg-slate-800/40 py-3 text-center">
                  <div className="text-2xl font-semibold text-white">{String(seg.v).padStart(2, "0")}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500">{seg.l}</div>
                </div>
              ))}
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={spring}
              onClick={() => setInRoom((v) => !v)}
              aria-pressed={inRoom}
              aria-label="Launch ambient virtual room"
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all duration-300 ${
                inRoom
                  ? "bg-emerald-500 text-emerald-950 shadow-lg shadow-emerald-500/30"
                  : soon
                  ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/30 animate-glowpulse"
                  : "border border-white/10 bg-slate-800/50 text-slate-300"
              }`}
            >
              <Waves className="size-4" aria-hidden />
              {inRoom ? "In the room — tap to leave" : "Launch ambient virtual room"}
            </motion.button>

            {/* Ambient AI note-taking toggle */}
            <button
              onClick={() => setNotes((v) => !v)}
              role="switch"
              aria-checked={notes}
              aria-label="Ambient AI note-taking"
              className="mt-4 flex w-full items-center justify-between rounded-xl border border-white/10 bg-slate-800/30 px-4 py-3 text-left transition-all duration-300"
            >
              <span className="text-sm text-slate-300">Ambient AI note-taking</span>
              <span
                className={`relative h-6 w-11 rounded-full transition-all duration-300 ${
                  notes ? "bg-emerald-500 shadow-[0_0_16px_2px_rgba(52,211,153,0.5)]" : "bg-slate-700"
                }`}
              >
                <span
                  className={`absolute top-0.5 size-5 rounded-full bg-white transition-all duration-300 ${
                    notes ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </span>
            </button>
          </>
        )}
      </div>
    </Bento>
  );
}

// ---- Module 3: Mind State Telemetry (small) -------------------------------
function MindTelemetry({ moods, className = "" }: { moods: Mood[]; className?: string }) {
  // Build a smooth spline area path from mood scores (1–10).
  const series = moods.length >= 2 ? moods.map((m) => m.moodScore) : [5, 6, 5, 7, 6, 8, 7];
  const W = 300;
  const H = 90;
  const pts = series.map((v, i) => {
    const x = (i / (series.length - 1)) * W;
    const y = H - ((v - 1) / 9) * (H - 12) - 6;
    return [x, y] as const;
  });
  // Smooth line via midpoint quadratic curves.
  let line = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    line += ` Q ${px},${py} ${mx},${(py + cy) / 2} T ${cx},${cy}`;
  }
  const area = `${line} L ${W},${H} L 0,${H} Z`;
  const latest = series[series.length - 1];

  return (
    <Bento label="Mind state telemetry" delay={0.15} className={className}>
      <div className="p-6">
        <div className="mb-1 flex items-center gap-2">
          <Wind className="size-4 text-indigo-400" aria-hidden />
          <h2 className="font-display text-base font-semibold text-white">Mind state</h2>
          <span className="ml-auto text-xs text-slate-400">
            latest <span className="tnum font-semibold text-indigo-300">{latest}/10</span>
          </span>
        </div>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`Mood trend, most recent ${latest} out of 10`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="moodfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill="url(#moodfill)" />
          <path d={line} fill="none" stroke="#a5b4fc" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#c7d2fe" />
        </svg>
        <Link href="/app/checkins" className="mt-3 inline-flex items-center gap-1 text-xs text-slate-400 transition-colors hover:text-indigo-300">
          Log a check-in <ArrowRight className="size-3" aria-hidden />
        </Link>
      </div>
    </Bento>
  );
}

// ---- Module 4: Quick-Triage AI Chatbot (small) ----------------------------
function TriageChat({ className = "" }: { className?: string }) {
  const [msgs, setMsgs] = useState<{ role: "assistant" | "user"; text: string }[]>([
    { role: "assistant", text: "How is your breathing right now? Let's ground ourselves." },
  ]);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [
      ...m,
      { role: "user", text },
      {
        role: "assistant",
        text: "Thank you for sharing. Try a slow breath in for four, and out for six. I'm here with you.",
      },
    ]);
  }

  return (
    <Bento label="Quick triage assistant" delay={0.2} className={className}>
      <div className="flex h-full flex-col p-6">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-rose-400 animate-breathe" aria-hidden />
          <h2 className="font-display text-base font-semibold text-white">Grounding assistant</h2>
        </div>
        <div className="mb-3 flex-1 space-y-2 overflow-y-auto" aria-live="polite">
          {msgs.map((m, i) => (
            <div
              key={i}
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                m.role === "assistant"
                  ? "bg-white/5 text-slate-200"
                  : "ml-auto bg-indigo-500/20 text-indigo-100"
              }`}
            >
              {m.text}
            </div>
          ))}
          <div ref={endRef} />
        </div>
        <form onSubmit={send} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-800/40 px-2 py-1.5 backdrop-blur-md">
          <label htmlFor="triage-input" className="sr-only">Message the grounding assistant</label>
          <input
            id="triage-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type how you feel…"
            className="flex-1 bg-transparent px-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="submit"
            aria-label="Send message"
            className="flex size-8 items-center justify-center rounded-lg bg-rose-400/90 text-rose-950 transition-all duration-300 hover:bg-rose-400"
          >
            <Send className="size-4" aria-hidden />
          </motion.button>
        </form>
      </div>
    </Bento>
  );
}

// ---- Crisis access (always one tap away — clinical-safety requirement) -----
function CrisisTile({ className = "" }: { className?: string }) {
  return (
    <Bento label="Crisis support" delay={0.25} className={className}>
      <Link href="/app/help/crisis-support" className="block h-full">
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          transition={spring}
          className="flex h-full items-center gap-4 p-6"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-rose-400/15 text-rose-300 ring-1 ring-rose-400/30">
            <Phone className="size-5" aria-hidden />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-white">Need support now?</p>
            <p className="text-sm text-slate-400">
              Call or text <span className="tnum font-semibold text-rose-300">988</span> — help any time.
            </p>
          </div>
          <ArrowRight className="ml-auto size-4 text-slate-500" aria-hidden />
        </motion.div>
      </Link>
    </Bento>
  );
}

// ---- shared empty state ----------------------------------------------------
function EmptyInvite({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 py-8 text-center">
      <p className="font-display text-sm font-semibold text-white">{title}</p>
      <p className="mt-1 max-w-[220px] text-xs text-slate-400">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition-all duration-300 hover:bg-indigo-400"
      >
        {cta} <ArrowRight className="size-4" aria-hidden />
      </Link>
    </div>
  );
}
