"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface Referral {
  id: string;
  type: string;
  status: string;
  urgency: string;
  reason: string | null;
  patientId: string | null;
  referringOrg: string | null;
  createdAt: string;
}

const STATUS_FLOW: Record<string, string[]> = {
  received: ["triaged", "declined", "expired"],
  triaged: ["patient_contacted", "declined", "unreachable", "expired"],
  patient_contacted: ["converted", "unreachable", "declined", "expired"],
  converted: ["scheduled", "declined"],
  scheduled: ["completed", "declined"],
  unreachable: ["patient_contacted", "expired"],
  completed: [],
  declined: [],
  expired: [],
};

const URGENCY_CLASS: Record<string, string> = {
  crisis: "bg-red-100 text-red-800",
  urgent: "bg-orange-100 text-orange-800",
  routine: "bg-slate-100 text-slate-700",
};

const TYPE_LABEL: Record<string, string> = {
  inbound: "Inbound",
  internal_transfer: "Transfer / Rematch",
  outbound: "Refer Out",
};

function statusLabel(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function ReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/referrals");
      if (res.ok) {
        const json = await res.json();
        setReferrals(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function advance(id: string, status: string) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const json = await res.json();
        setReferrals((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: json.data.status } : r))
        );
      }
    } finally {
      setUpdating(null);
    }
  }

  const visible =
    filter === "all"
      ? referrals
      : referrals.filter((r) => r.status === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Referral Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Triage inbound, transfer, and refer-out referrals through their lifecycle.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {["all", "received", "triaged", "patient_contacted", "converted", "scheduled"].map(
          (f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                filter === f
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              {f === "all" ? "All" : statusLabel(f)}
            </button>
          )
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No referrals in this view.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((r) => (
            <Card key={r.id}>
              <CardContent className="py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge className={URGENCY_CLASS[r.urgency] ?? URGENCY_CLASS.routine}>
                      {statusLabel(r.urgency)}
                    </Badge>
                    <span className="text-sm font-medium text-foreground">
                      {TYPE_LABEL[r.type] ?? r.type}
                    </span>
                    <Badge className="bg-indigo-100 text-indigo-800">
                      {statusLabel(r.status)}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {r.reason || "No reason provided"}
                    {r.referringOrg ? ` — from ${r.referringOrg}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Received {new Date(r.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(STATUS_FLOW[r.status] ?? []).map((next) => (
                    <button
                      key={next}
                      disabled={updating === r.id}
                      onClick={() => advance(r.id, next)}
                      className="px-3 py-1.5 rounded-md text-xs border border-border bg-card text-foreground hover:bg-muted disabled:opacity-50"
                    >
                      → {statusLabel(next)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
