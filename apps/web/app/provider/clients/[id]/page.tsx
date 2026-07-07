"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { MessageSquare, ArrowLeft, Share2 } from "lucide-react";

interface ClientDetail {
  id: string;
  name: string;
  email: string;
  phone?: string;
  therapyGoals: string[];
  preferences: { modality: string; frequency: string };
}

interface Assessment {
  type: string;
  score: number;
  maxScore: number;
  interpretation: string;
  date: string;
}

interface SessionRecord {
  id: string;
  date: string;
  duration: string;
  notes: string;
}

const mockClient: ClientDetail = {
  id: "1",
  name: "Sarah Johnson",
  email: "sarah@example.com",
  phone: "(555) 123-4567",
  therapyGoals: ["Reduce anxiety in social situations", "Improve sleep quality", "Build healthy coping strategies"],
  preferences: { modality: "Virtual", frequency: "Weekly" },
};

const mockAssessments: Assessment[] = [
  { type: "PHQ-9", score: 8, maxScore: 27, interpretation: "Mild Depression", date: "2026-02-28" },
  { type: "GAD-7", score: 11, maxScore: 21, interpretation: "Moderate Anxiety", date: "2026-02-28" },
];

const mockSessions: SessionRecord[] = [
  { id: "s1", date: "2026-03-07", duration: "50 min", notes: "Discussed CBT techniques for managing anxiety at work." },
  { id: "s2", date: "2026-02-28", duration: "50 min", notes: "Reviewed progress on sleep hygiene plan." },
  { id: "s3", date: "2026-02-14", duration: "50 min", notes: "Explored root causes of social anxiety triggers." },
  { id: "s4", date: "2026-02-07", duration: "50 min", notes: "Introduced breathing exercises and grounding techniques." },
];

function scoreColor(score: number, max: number) {
  const pct = score / max;
  if (pct < 0.3) return "bg-green-100 text-green-800";
  if (pct < 0.6) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

interface ExternalProvider {
  id: string;
  name: string;
  specialty: string | null;
}

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetail | null>(null);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);

  // Refer-out (R3) modal state.
  const [referOpen, setReferOpen] = useState(false);
  const [providers, setProviders] = useState<ExternalProvider[]>([]);
  const [reason, setReason] = useState("");
  const [urgency, setUrgency] = useState("routine");
  const [providerId, setProviderId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [referResult, setReferResult] = useState<string | null>(null);

  function openRefer() {
    setReferResult(null);
    setReason("");
    setUrgency("routine");
    setProviderId("");
    setReferOpen(true);
    fetch("/api/external-providers")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((j) => setProviders(j.data ?? []))
      .catch(() => setProviders([]));
  }

  async function submitRefer() {
    if (!reason.trim()) {
      setReferResult("Please provide a reason for the referral.");
      return;
    }
    setSubmitting(true);
    setReferResult(null);
    try {
      const res = await fetch("/api/referrals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "outbound",
          patientId: id,
          reason: reason.trim(),
          urgency,
          externalProviderId: providerId || undefined,
          idempotencyKey:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `${id}-${Date.now()}`,
        }),
      });
      if (res.ok) {
        setReferResult("Referral submitted — it's now in the care team queue.");
        setReason("");
      } else {
        const j = await res.json().catch(() => ({}));
        setReferResult(j.error || "Failed to submit referral.");
      }
    } catch {
      setReferResult("Failed to submit referral.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    const load = async () => {
      try {
        const [clientRes, assessRes] = await Promise.all([
          fetch(`/api/users/${id}`),
          fetch(`/api/assessments?patientId=${id}`),
        ]);
        if (clientRes.ok) {
          const data = await clientRes.json();
          if (data?.id) { setClient(data); } else { setClient(mockClient); }
        } else { setClient(mockClient); }
        if (assessRes.ok) {
          const data = await assessRes.json();
          if (Array.isArray(data) && data.length > 0) { setAssessments(data); } else { setAssessments(mockAssessments); }
        } else { setAssessments(mockAssessments); }
        setSessions(mockSessions);
      } catch {
        setClient(mockClient);
        setAssessments(mockAssessments);
        setSessions(mockSessions);
      }
    };
    load();
  }, [id]);

  if (!client) return <div className="p-6 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link href="/provider/clients">
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground mb-2">
          <ArrowLeft className="size-4" /> Back to Clients
        </Button>
      </Link>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarFallback className="bg-secondary text-primary text-lg font-bold">
              {client.name.split(" ").map((n) => n[0]).join("").slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <h1 className="text-2xl font-bold text-foreground">{client.name}</h1>
            <p className="text-muted-foreground text-sm">{client.email} {client.phone && `· ${client.phone}`}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={openRefer}>
            <Share2 className="size-4" /> Refer Out
          </Button>
          <Link href="/provider/messages">
            <Button className="gap-2"><MessageSquare className="size-4" /> Send Message</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Intake Summary */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Intake Summary</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Therapy Goals</p>
              <ul className="space-y-1">
                {client.therapyGoals.map((goal, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                    <span className="mt-1 size-1.5 rounded-full bg-primary flex-shrink-0" />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-border">
              <div>
                <p className="text-xs text-muted-foreground">Preferred Modality</p>
                <p className="text-sm font-medium text-foreground">{client.preferences.modality}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Frequency</p>
                <p className="text-sm font-medium text-foreground">{client.preferences.frequency}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assessment Scores */}
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Latest Assessment Scores</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {assessments.map((a) => (
              <div key={a.type} className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{a.type}</p>
                  <Badge className={scoreColor(a.score, a.maxScore)}>{a.score}/{a.maxScore}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.interpretation}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{new Date(a.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Session History */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Session History</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Date</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Duration</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Session Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td className="py-3 text-foreground">{s.duration}</td>
                    <td className="py-3 text-foreground">{s.notes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Refer Out modal (R3 — outbound referral) */}
      {referOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setReferOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-card border border-border shadow-lg p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <h2 className="text-lg font-semibold text-foreground">Refer {client.name} Out</h2>
              <p className="text-sm text-muted-foreground">
                Create an outbound referral (e.g. psychiatry, higher level of care). The care
                team will manage it from the referral queue.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">
                Reason
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                placeholder="e.g. Needs medication evaluation for persistent symptoms"
                className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Urgency
                </label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
                >
                  <option value="routine">Routine</option>
                  <option value="urgent">Urgent</option>
                  <option value="crisis">Crisis</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Provider (optional)
                </label>
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="w-full rounded-md border border-border bg-background p-2 text-sm text-foreground"
                >
                  <option value="">Care team to assign</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                      {p.specialty ? ` — ${p.specialty}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {referResult && (
              <p className="text-sm text-foreground bg-muted rounded-md p-2">{referResult}</p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={() => setReferOpen(false)}>
                Close
              </Button>
              <Button onClick={submitRefer} disabled={submitting}>
                {submitting ? "Submitting…" : "Submit Referral"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
