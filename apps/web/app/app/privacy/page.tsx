"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, ShieldCheck } from "lucide-react";

interface Consent {
  id: string;
  type: string;
  documentVersion: string;
  channel: string | null;
  grantedAt: string;
  revokedAt: string | null;
}
interface Disclosure {
  id: string;
  disclosedTo: string;
  purpose: string;
  description: string;
  disclosedAt: string;
}

const CONSENT_LABELS: Record<string, string> = {
  "notice-of-privacy-practices": "Notice of Privacy Practices",
  telehealth: "Telehealth Consent",
  communications: "Communications",
  treatment: "Treatment Consent",
  "employer-program": "Employer Program",
};

function label(type: string) {
  return CONSENT_LABELS[type] ?? type;
}

export default function PrivacyPage() {
  const [consents, setConsents] = useState<Consent[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [nppVersion, setNppVersion] = useState<string>("");
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [c, d] = await Promise.all([
      fetch("/api/consents").then((r) => (r.ok ? r.json() : { data: [], active: [] })),
      fetch("/api/patient/disclosures").then((r) => (r.ok ? r.json() : { data: [] })),
    ]);
    setConsents(c.data ?? []);
    setActive(c.active ?? []);
    setNppVersion(c.currentNppVersion ?? "");
    setDisclosures(d.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setConsent(type: string, revoke: boolean) {
    setBusy(type);
    try {
      await fetch("/api/consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, revoke }),
      });
      await load();
    } finally {
      setBusy(null);
    }
  }

  const nppActive = active.includes("notice-of-privacy-practices");

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Privacy & Your Data</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your consents, export your health record, and review disclosures of your information.
        </p>
      </div>

      {/* Notice of Privacy Practices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="size-4" /> Notice of Privacy Practices
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Version {nppVersion || "—"}.{" "}
            {nppActive ? "You have acknowledged the current notice." : "Acknowledgment required."}
          </p>
          {nppActive ? (
            <Badge className="bg-green-100 text-green-800">Acknowledged</Badge>
          ) : (
            <Button
              size="sm"
              disabled={busy === "notice-of-privacy-practices"}
              onClick={() => setConsent("notice-of-privacy-practices", false)}
            >
              Acknowledge Notice
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Consents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Consents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {["telehealth", "communications", "treatment"].map((type) => {
            const on = active.includes(type);
            return (
              <div key={type} className="flex items-center justify-between">
                <span className="text-sm text-foreground">{label(type)}</span>
                <Button
                  size="sm"
                  variant={on ? "outline" : "default"}
                  disabled={busy === type}
                  onClick={() => setConsent(type, on)}
                >
                  {on ? "Revoke" : "Grant"}
                </Button>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Right of access — export */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Export Your Record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Download your full health record (appointments, assessments, check-ins, messages,
            billing, and consents) as a JSON file.
          </p>
          <a href="/api/patient/export" download>
            <Button size="sm" className="gap-2">
              <Download className="size-4" /> Download Record
            </Button>
          </a>
        </CardContent>
      </Card>

      {/* Accounting of disclosures */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Accounting of Disclosures</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-16 w-full" />
          ) : disclosures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No disclosures of your information outside treatment, payment, or operations have been recorded.
            </p>
          ) : (
            <ul className="space-y-3">
              {disclosures.map((d) => (
                <li key={d.id} className="text-sm border-b border-border pb-2 last:border-0">
                  <p className="text-foreground">
                    Disclosed to <span className="font-medium">{d.disclosedTo}</span> — {d.purpose}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {d.description} · {new Date(d.disclosedAt).toLocaleDateString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
