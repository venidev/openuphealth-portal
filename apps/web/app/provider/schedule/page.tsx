"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Monitor, MapPin, CalendarPlus, Download, Repeat } from "lucide-react";

// ---- availability model: hour checkboxes <-> AvailabilitySlot rows ----
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// dayOfWeek in the API: 0=Sunday … 6=Saturday
const DAY_TO_DOW: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function hourLabel(h: number) {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display}:00 ${period}`;
}
function hh(h: number) {
  return `${String(h).padStart(2, "0")}:00`;
}

interface Slot { dayOfWeek: number; startTime: string; endTime: string }
interface Appt {
  id: string;
  startsAt: string;
  endsAt: string;
  modality: string;
  status: string;
  followUpOfId?: string | null;
  patient?: { id: string; name: string | null; email: string };
}

// ---- range quick links ----
const RANGES = [
  { key: "today", label: "Today", days: 1 },
  { key: "7d", label: "7 Days", days: 7 },
  { key: "30d", label: "30 Days", days: 30 },
  { key: "month", label: "This Month", days: 0 },
  { key: "year", label: "Year", days: 365 },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function rangeEnd(key: RangeKey): Date {
  const now = new Date();
  if (key === "month") return new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
  const days = RANGES.find((r) => r.key === key)?.days ?? 7;
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  return end;
}

// Local datetime-local input value from a Date.
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SchedulePage() {
  const { data: session } = useSession();
  const [selectedDay, setSelectedDay] = useState("Mon");
  const [range, setRange] = useState<RangeKey>("7d");
  const [appointments, setAppointments] = useState<Appt[]>([]);
  const [availability, setAvailability] = useState<Record<string, number[]>>(
    Object.fromEntries(DAYS.map((d) => [d, []]))
  );
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  // Follow-up modal state
  const [followUpFor, setFollowUpFor] = useState<Appt | null>(null);
  const [followUpAt, setFollowUpAt] = useState("");
  const [followUpBusy, setFollowUpBusy] = useState(false);
  const [followUpMsg, setFollowUpMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const userId = session?.user?.id;
    const [apptRes, availRes] = await Promise.all([
      fetch("/api/appointments?limit=100"),
      userId ? fetch(`/api/availability?therapistId=${userId}`) : Promise.resolve(null),
    ]);
    if (apptRes.ok) {
      const json = await apptRes.json();
      setAppointments(Array.isArray(json.data) ? json.data : []);
    }
    if (availRes?.ok) {
      const json = await availRes.json();
      const slots: Slot[] = json.data ?? [];
      const byDay: Record<string, number[]> = Object.fromEntries(DAYS.map((d) => [d, []]));
      for (const s of slots) {
        const day = DAYS.find((d) => DAY_TO_DOW[d] === s.dayOfWeek);
        const hour = parseInt(s.startTime.split(":")[0], 10);
        if (day && !Number.isNaN(hour)) byDay[day].push(hour);
      }
      setAvailability(byDay);
    }
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (session !== undefined) load();
  }, [load, session]);

  const toggleHour = (hour: number) => {
    setAvailability((prev) => {
      const current = prev[selectedDay] ?? [];
      const next = current.includes(hour)
        ? current.filter((h) => h !== hour)
        : [...current, hour].sort((a, b) => a - b);
      return { ...prev, [selectedDay]: next };
    });
    setSaved(false);
  };

  // Persist ALL days as hour slots (the API replaces the full set).
  const handleSave = async () => {
    setSaving(true);
    const slots: Slot[] = [];
    for (const day of DAYS) {
      for (const hour of availability[day] ?? []) {
        slots.push({ dayOfWeek: DAY_TO_DOW[day], startTime: hh(hour), endTime: hh(hour + 1) });
      }
    }
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slots }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  };

  // Appointments within the selected range, grouped by calendar day.
  const grouped = useMemo(() => {
    const now = new Date();
    const end = rangeEnd(range);
    const inRange = appointments
      .filter((a) => {
        const t = new Date(a.startsAt);
        return t >= new Date(now.getFullYear(), now.getMonth(), now.getDate()) && t <= end &&
          (a.status === "scheduled" || a.status === "confirmed");
      })
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    const byDate = new Map<string, Appt[]>();
    for (const a of inRange) {
      const key = new Date(a.startsAt).toLocaleDateString("en-US", {
        weekday: "short", month: "short", day: "numeric",
      });
      byDate.set(key, [...(byDate.get(key) ?? []), a]);
    }
    return byDate;
  }, [appointments, range]);

  function openFollowUp(appt: Appt) {
    // Default: one week after the original, same time & duration.
    const start = new Date(appt.startsAt);
    start.setDate(start.getDate() + 7);
    setFollowUpAt(toLocalInput(start));
    setFollowUpMsg(null);
    setFollowUpFor(appt);
  }

  async function submitFollowUp() {
    if (!followUpFor || !followUpAt) return;
    setFollowUpBusy(true);
    setFollowUpMsg(null);
    const durationMs =
      +new Date(followUpFor.endsAt) - +new Date(followUpFor.startsAt) || 50 * 60 * 1000;
    const start = new Date(followUpAt);
    const end = new Date(+start + durationMs);
    try {
      const res = await fetch(`/api/appointments/${followUpFor.id}/follow-up`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startsAt: start.toISOString(), endsAt: end.toISOString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setFollowUpMsg("Follow-up scheduled.");
        await load();
      } else {
        setFollowUpMsg(json.error || "Failed to schedule follow-up.");
      }
    } finally {
      setFollowUpBusy(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your appointments, availability, and calendar
          </p>
        </div>
        <a href="/api/provider/schedule/export" download>
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-4" /> Export Calendar (.ics)
          </Button>
        </a>
      </div>

      {/* Upcoming appointments with range quick links */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <CardTitle className="text-base">Upcoming Appointments</CardTitle>
            <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
              {RANGES.map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRange(r.key)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    range === r.key
                      ? "bg-card text-primary shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : grouped.size === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No appointments in this window.
            </p>
          ) : (
            <div className="space-y-4">
              {Array.from(grouped.entries()).map(([date, appts]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">{date}</p>
                  <div className="space-y-2">
                    {appts.map((appt) => (
                      <div
                        key={appt.id}
                        className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground flex items-center gap-2">
                            {appt.patient?.name ?? "Client"}
                            {appt.followUpOfId && (
                              <Badge variant="outline" className="gap-1 text-xs">
                                <Repeat className="size-3" /> Follow-up
                              </Badge>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(appt.startsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            {" – "}
                            {new Date(appt.endsAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1 text-xs">
                            {appt.modality === "video" ? <Monitor className="size-3" /> : <MapPin className="size-3" />}
                            {appt.modality === "video" ? "Video" : "In person"}
                          </Badge>
                          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => openFollowUp(appt)}>
                            <CalendarPlus className="size-3.5" /> Follow-up
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly availability editor */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">My Weekly Availability</CardTitle>
            <Button size="sm" onClick={handleSave} disabled={saving} className={saved ? "bg-green-600 hover:bg-green-600" : ""}>
              {saved ? "Saved!" : saving ? "Saving…" : "Update Availability"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
            {DAYS.map((day) => (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedDay === day
                    ? "bg-card text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {day}
                {(availability[day]?.length ?? 0) > 0 && (
                  <span className="ml-1.5 bg-primary text-primary-foreground text-xs rounded-full px-1.5 py-0.5">
                    {availability[day].length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {HOURS.map((hour) => {
              const on = (availability[selectedDay] ?? []).includes(hour);
              return (
                <label
                  key={hour}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleHour(hour)}
                    className="rounded border-border accent-primary"
                  />
                  <span className="text-sm text-foreground">{hourLabel(hour)}</span>
                </label>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground">
            Each checked hour is a bookable 1-hour slot, repeating weekly. Changes apply after you press Update Availability.
          </p>
        </CardContent>
      </Card>

      {/* Follow-up modal */}
      {followUpFor && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setFollowUpFor(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl bg-card border border-border shadow-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold text-foreground">Schedule Follow-up</h2>
              <p className="text-sm text-muted-foreground">
                With {followUpFor.patient?.name ?? "this client"} — same duration as the original session.
              </p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Date & time</label>
              <input
                type="datetime-local"
                value={followUpAt}
                onChange={(e) => setFollowUpAt(e.target.value)}
                className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
              />
            </div>
            {followUpMsg && (
              <p className="text-sm text-foreground bg-muted rounded-md p-2">{followUpMsg}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setFollowUpFor(null)}>Close</Button>
              <Button onClick={submitFollowUp} disabled={followUpBusy}>
                {followUpBusy ? "Scheduling…" : "Schedule"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
