"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";

interface ExternalProvider {
  id: string;
  name: string;
  npi: string | null;
  specialty: string | null;
  statesServed: string | null;
  insuranceAccepted: string | null;
  contact: string | null;
}

function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [raw];
  } catch {
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  }
}

export default function ExternalProvidersPage() {
  const [providers, setProviders] = useState<ExternalProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    npi: "",
    specialty: "",
    statesServed: "",
    insuranceAccepted: "",
    contact: "",
  });

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/external-providers");
      if (res.ok) {
        const json = await res.json();
        setProviders(json.data ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!form.name.trim()) {
      setError("Name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/external-providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          npi: form.npi.trim() || undefined,
          specialty: form.specialty.trim() || undefined,
          statesServed: form.statesServed
            ? form.statesServed.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          insuranceAccepted: form.insuranceAccepted
            ? form.insuranceAccepted.split(",").map((s) => s.trim()).filter(Boolean)
            : undefined,
          contact: form.contact.trim() || undefined,
        }),
      });
      if (res.ok) {
        setForm({ name: "", npi: "", specialty: "", statesServed: "", insuranceAccepted: "", contact: "" });
        setShowForm(false);
        load();
      } else {
        const j = await res.json().catch(() => ({}));
        setError(j.error || "Failed to save provider.");
      }
    } finally {
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
    className: "w-full rounded-md border border-border bg-background p-2 text-sm text-foreground",
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Referral Directory</h1>
          <p className="text-sm text-muted-foreground mt-1">
            External providers for refer-out referrals (psychiatry, higher levels of care, crisis).
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowForm((v) => !v)}>
          <Plus className="size-4" /> Add Provider
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Name *</label>
                <input placeholder="e.g. Bay Area Psychiatry Group" {...field("name")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Specialty</label>
                <input placeholder="e.g. Psychiatry" {...field("specialty")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">NPI</label>
                <input placeholder="10-digit NPI" {...field("npi")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Contact</label>
                <input placeholder="Phone or email" {...field("contact")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">States Served</label>
                <input placeholder="Comma-separated, e.g. CA, NY" {...field("statesServed")} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Insurance Accepted</label>
                <input placeholder="Comma-separated" {...field("insuranceAccepted")} />
              </div>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save Provider"}</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : providers.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No external providers yet. Add one to make it available for refer-out referrals.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {providers.map((p) => (
            <Card key={p.id}>
              <CardContent className="py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">{p.name}</span>
                    {p.specialty && <Badge className="bg-indigo-100 text-indigo-800">{p.specialty}</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {p.contact || "No contact on file"}
                    {parseList(p.statesServed).length > 0 && ` · ${parseList(p.statesServed).join(", ")}`}
                    {p.npi && ` · NPI ${p.npi}`}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
