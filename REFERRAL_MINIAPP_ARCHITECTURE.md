# Agentic Build Architecture — OpenUp Contextual Referral App

**Companion to:** `PRODUCT_SCOPE.md` (this is the concrete implementation of workflow **R1 — Inbound Clinical Referrals**).
**Status:** Architecture baseline for parallel agent execution.
**Supersedes:** the original PRD's Clipboard Parser Mode and "stealth/bypass-IT" framing (removed — see [Inherited Decisions](#1-inherited-decisions-non-negotiable)).

---

## 0. How to Use These Notes

You will spawn multiple agents to build this. Agents parallelize safely **only when the interfaces between them are frozen before anyone writes implementation code.** This document is structured to make that possible:

1. **[Inherited Decisions](#1-inherited-decisions-non-negotiable)** — design constraints every agent must honor. Paste these into every agent brief so no agent re-introduces a cut feature.
2. **[Frozen Contracts](#4-frozen-contracts-build-these-first)** — the seams. One foundation agent builds these first; nothing else starts until they exist.
3. **[Workstreams & Agent Briefs](#6-workstreams--agent-briefs)** — one brief per agent, each with owns/consumes/produces/done-when.
4. **[Spawn Waves](#7-dependency-graph--spawn-waves)** — the order to launch agents so dependencies resolve.

**Spawning model:** run each brief as an isolated agent in its own git worktree (`isolation: "worktree"`). Wave 1 runs synchronously (it blocks everyone). Wave 2 agents run in parallel. Give every agent the [Cross-Cutting Guardrails](#8-cross-cutting-guardrails-every-agent) verbatim.

---

## 1. Inherited Decisions (Non-Negotiable)

These resolve gaps found in PRD review. Agents may not reverse them without an explicit human decision.

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | **SMART on FHIR is the only capture mode.** Clipboard/global-hotkey scraping is removed entirely. | Global clipboard scraping is unsanctioned PHI exfiltration, violates "zero persistent PHI" (OS clipboard history + cloud clipboard persist it), and fails at the CISO gate. |
| D2 | **Default form factor is a web app launched inside the EMR's embedded browser** (EHR launch). A desktop shell is an *optional* Wave-3 add-on, built only if a named requirement demands it. | Eliminates system-tray residency, custom URI handler, EV-cert-to-"bypass-antimalware" surface, and per-machine install. Drastically easier CISO approval. |
| D3 | **No "stealth."** The app is a registered, IT-visible SMART client with a full server-side audit trail. Positioning is "faster than a full EMR module," never "no IT / bypass IT." | SMART launch *requires* EMR-side client registration; the no-IT premise is false and burns buyer trust. |
| D4 | **Tokens live in runtime memory only; never persisted.** Re-auth per launch (SMART EHR launch + PKCE). | Removes the local token-encryption problem entirely. |
| D5 | **PHI is minimized on ingest** — pull only the FHIR fields the referral needs, not whole resources into storage. | Minimum-necessary (HIPAA). |
| D6 | **Human verification is mandatory and blocking** — provider must actively confirm patient identity (name + DOB) before transmit. No auto-send. | Wrong-patient referral is a safety event; never trust extracted data silently. |
| D7 | **Referral submission is idempotent.** | Retries/double-clicks/network replays must not create duplicate referrals. |
| D8 | **Multi-tenant from day one.** Each hospital/clinic is a tenant with its own EMR endpoints, SMART client registration, and BAA/authorization-to-disclose status. | You will onboard many orgs; per-tenant config is not retrofittable cheaply. |

---

## 2. System Context

```
  ┌─────────────────────────────────────────────────────────────┐
  │  EMR (Epic / Cerner / Athena)  — Tenant-hosted               │
  │   • EHR launch → SMART auth (OAuth2 + PKCE)                   │
  │   • FHIR R4 API: /Patient /Coverage /Condition               │
  └───────────────┬─────────────────────────────────────────────┘
                  │ (1) launch context + token   (2) FHIR reads
                  ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  Referral SMART App  (web; embedded EMR browser)             │
  │   WS1 launch/auth → WS2 FHIR ingest+normalize → WS4 verify   │
  │   PHI in memory only. Renders canonical referral for review. │
  └───────────────┬─────────────────────────────────────────────┘
                  │ (3) POST canonical referral (mTLS/signed JWT, Idempotency-Key)
                  ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  OpenUp Referral Intake Service  (extends apps/web)          │
  │   WS3 intake API → WS5 consent/disclosure → persist Referral │
  │   WS6 audit+observability → WS8 close-the-loop + coord queue │
  └───────────────┬─────────────────────────────────────────────┘
                  ▼
  ┌─────────────────────────────────────────────────────────────┐
  │  OpenUp Platform (existing): Care Coordinator referral queue,│
  │  Consent, DisclosureRecord, AuditLog, Patient matching       │
  └─────────────────────────────────────────────────────────────┘
```

**Stack alignment:** stays inside the existing Turborepo/pnpm/Prisma/Postgres monorepo. New app `apps/referral-smart` (SMART client). Intake API as versioned routes in `apps/web` (`/api/referral/v1/*`) or a dedicated `apps/referral-api` service if isolation is preferred. Shared canonical types in `packages/types`; FHIR mapping in a new `packages/fhir`.

---

## 3. Resolved Gaps (Design / Architecture / System Design)

| Gap (from PRD) | Resolution | Owning WS |
|----------------|------------|-----------|
| No server-side audit trail (CISO requires "full audit logs") | Every FHIR read and every intake write emits an `AuditLog` entry (actor, tenant, patient subject, purpose, success). | WS3, WS6 |
| Disclosure without consent/authorization | Intake gated by tenant's authorization-to-disclose; each accepted referral writes a `DisclosureRecord`; unconverted referrals purged on schedule. | WS5 |
| "TLS 1.3 = end-to-end" mislabel; weak API auth | Intake API requires **mutual TLS or signed per-tenant JWT** on top of TLS; not transport-only. | WS3, WS9 |
| Wrong-patient / stale context | Blocking identity-confirmation gate (D6) + context-integrity check (token's `patient_id` must equal the resource IDs fetched). | WS4, WS2 |
| Duplicate referrals on retry | `Idempotency-Key` header + unique constraint; server returns the original result on replay. | WS3 |
| Single-tenant assumptions | Tenant config store: EMR base URLs, FHIR version, SMART client IDs, BAA/authorization status, purge policy. | WS0, WS3 |
| Epic vs Cerner vs Athena differences | Per-EMR adapter behind one canonical mapping interface (FHIR quirks, STU3/R4, extensions isolated in adapters). | WS2 |
| PHI over-collection | Field-level allowlist per FHIR resource; only mapped fields leave memory. | WS2 |
| No patient dedup on OpenUp side | Deterministic + probabilistic match to existing `User`/patient; ambiguous matches queue for coordinator, never auto-merge. | WS8 |
| Transient failure / provider offline mid-submit | Client-side bounded retry with idempotency; server-side dead-letter for failed downstream steps. | WS3, WS4 |
| No API versioning | `/api/referral/v1/...`; contract changes are additive or a new version. | WS0 |
| Local "non-PHI" log overclaim | Local log stores only confirmation ID + timestamp + tenant; treated as sensitive; no names/DOB/policy IDs. | WS4 |

---

## 4. Frozen Contracts (Build These First)

**These are the parallelization seams. WS0 builds them in Wave 1; every other agent imports them and treats them as read-only.** Changing a contract after Wave 2 starts requires re-syncing all dependents — avoid.

### 4.1 Canonical Referral Payload (`packages/types`)
The single shape crossing the app→server boundary. EMR-agnostic.
```ts
type CanonicalReferral = {
  schemaVersion: "1.0";
  tenantId: string;
  idempotencyKey: string;              // client-generated UUID v4
  source: { emr: "epic" | "cerner" | "athena"; fhirVersion: "R4" | "STU3"; };
  referringProvider: { name: string; npi: string; organization: string; };
  patient: {
    firstName: string; lastName: string; dob: string;   // ISO date
    phone?: string; email?: string;
    contextPatientId: string;          // FHIR Patient.id — used for integrity check
  };
  coverage?: { payerName?: string; memberId?: string; groupNumber?: string; };
  clinical: { reason: string; urgency: "routine" | "urgent" | "crisis"; conditions?: string[]; };
  verification: { confirmedBy: string; confirmedAt: string; };  // D6 attestation
};
```

### 4.2 Intake API (OpenAPI, `/api/referral/v1`)
- `POST /referrals` — headers: `Authorization` (per-tenant signed JWT / mTLS), `Idempotency-Key`. Body: `CanonicalReferral`. Returns `202 { referralId, status: "received", confirmationId }`. Replay of same key returns the original `202`.
- `GET /referrals/{referralId}/status` — close-the-loop polling. Returns lifecycle status.
- Error contract: structured `{ code, message, field? }`; **never echoes PHI in errors** (guardrail G3).

### 4.3 Status Lifecycle (shared enum)
`received → triaged → patient_contacted → converted → scheduled → completed | declined | unreachable | expired`

### 4.4 FHIR Mapping Interface (`packages/fhir`)
```ts
interface EmrAdapter {
  fetchContext(launch: LaunchContext): Promise<RawFhirBundle>;   // Patient, Coverage, Condition
  toCanonical(bundle: RawFhirBundle): Omit<CanonicalReferral, "verification" | "idempotencyKey">;
  requiredScopes: string[];   // minimum-necessary SMART scopes
}
```

### 4.5 Audit & Disclosure event contracts
`AuditEvent` and `DisclosureEvent` shapes (align to the extended `AuditLog` and new `DisclosureRecord` in `PRODUCT_SCOPE.md`), emitted by intake and ingest.

### 4.6 Tenant Config schema
`{ tenantId, emr, fhirBaseUrl, authEndpoint, smartClientId, fhirVersion, authorizationToDiscloseStatus, purgeDays }`.

---

## 5. Data Model Additions

Reuses `Referral`, `ExternalProvider`, `DisclosureRecord`, extended `AuditLog` already planned in `PRODUCT_SCOPE.md`. New for this app:

| Model | Purpose |
|-------|---------|
| `Tenant` | EMR/org config, SMART client registration, authorization-to-disclose + BAA status, purge policy. |
| `ReferralIdempotencyKey` | `(tenantId, idempotencyKey)` unique → stored result for replay (D7). |
| `IntakeDeadLetter` | Failed downstream processing for retry/inspection. |

---

## 6. Workstreams & Agent Briefs

Each brief is a self-contained agent prompt. Format: **Mission / Owns / Consumes / Produces / Done-when / Watch-outs.** All inherit [Guardrails](#8-cross-cutting-guardrails-every-agent).

### WS0 — Foundations & Contracts  *(Wave 1, blocking, run synchronously)*
- **Mission:** Establish the frozen contracts and scaffolding so all other agents can work in parallel without collision.
- **Owns:** `packages/types` canonical types, OpenAPI spec, status enum, `EmrAdapter` interface, audit/disclosure event shapes, `Tenant`/idempotency Prisma models, app/service scaffolding, CI (typecheck/test/secret-scan/dep-audit).
- **Consumes:** this document; `PRODUCT_SCOPE.md`.
- **Produces:** compiling, empty-but-typed contracts + a contract test suite that later agents code against.
- **Done-when:** every contract in §4 exists, is exported, and has a stub contract test; `pnpm build` green.
- **Watch-outs:** resist implementing behavior — this WS ships interfaces only.

### WS1 — SMART on FHIR Launch & Auth  *(Wave 2)*
- **Mission:** EHR launch handshake, OAuth2 + PKCE, launch-context extraction, in-memory token lifecycle.
- **Owns:** SMART launch sequence, scope requests (minimum-necessary), token refresh within session, session teardown wipes PHI/tokens.
- **Consumes:** `LaunchContext` type, Tenant config, `requiredScopes`.
- **Produces:** authenticated session yielding `{ patientId, fhirBaseUrl, accessToken(in-memory) }`.
- **Done-when:** launches against Epic + Cerner sandboxes; tokens never touch disk; session end verified to clear memory.
- **Watch-outs:** D4 — no token persistence; no refresh-token storage.

### WS2 — FHIR Ingestion & Normalization  *(Wave 2)*
- **Mission:** Per-EMR adapters that fetch Patient/Coverage/Condition and map to `CanonicalReferral` with field allowlisting.
- **Owns:** `EpicAdapter`, `CernerAdapter`, `AthenaAdapter`; STU3/R4 handling; context-integrity check (`patient.contextPatientId` must match token `patient_id`); PHI minimization allowlist.
- **Consumes:** `EmrAdapter` interface, canonical type, authenticated session from WS1.
- **Produces:** canonical payload (minus verification/idempotency) from a live FHIR context.
- **Done-when:** all three adapters pass mapping tests against vendor sandbox fixtures; only allowlisted fields present.
- **Watch-outs:** vendor extension quirks stay inside adapters; never leak raw bundles upstream.

### WS3 — Referral Intake Service  *(Wave 2)*
- **Mission:** Server-side `/api/referral/v1` — authn/authz, validation, idempotency, persistence, dead-letter.
- **Owns:** endpoints in §4.2, per-tenant JWT/mTLS verification, `Idempotency-Key` handling + unique constraint, `Referral` persistence, rate limiting, dead-letter on downstream failure.
- **Consumes:** OpenAPI + canonical type; Tenant config; audit/disclosure/patient-match services (WS5/WS8 — code against their interfaces, integrate in Wave 3).
- **Produces:** working intake accepting canonical referrals idempotently.
- **Done-when:** replayed key returns original result; unauthenticated/oversized/malformed rejected with PHI-free errors; authz test per endpoint.
- **Watch-outs:** G3 (no PHI in logs/errors); every write emits an audit event.

### WS4 — Provider Verification UI  *(Wave 2)*
- **Mission:** The review card + blocking identity-confirmation gate + one-click transmit with inline confirmation.
- **Owns:** pre-populated summary card, mandatory name+DOB confirm (D6), submit with idempotency key + bounded retry, ≤800ms inline success/error, local log (confirmation ID + timestamp + tenant only).
- **Consumes:** canonical payload from WS2; intake API from WS3.
- **Done-when:** cannot submit without explicit confirmation; retries reuse one idempotency key; local log provably PHI-free.
- **Watch-outs:** no auto-send; local log must not accumulate names/DOB/policy IDs.

### WS5 — Consent & Disclosure Service  *(Wave 2)*
- **Mission:** Enforce authorization-to-disclose and record disclosures; drive unconverted-referral purge.
- **Owns:** tenant authorization check at intake, `DisclosureRecord` writes, purge job for expired unconverted referrals, consent checkpoint hook for patient conversion.
- **Consumes:** Tenant config, disclosure event contract, `Referral`.
- **Done-when:** referral from an unauthorized tenant is rejected; every accepted referral has a `DisclosureRecord`; purge removes expired records on schedule.
- **Watch-outs:** align to `PRODUCT_SCOPE.md` Privacy Rule section; do not let PHI outlive the purge window.

### WS6 — Audit, Logging & Observability  *(Wave 2)*
- **Mission:** PHI-scrubbed structured logging, server-side audit trail, metrics/alerts.
- **Owns:** scrubbing serializer, `AuditLog` writes for FHIR reads + intake writes, metrics (time-to-referral, error rate, auth anomalies), alerting.
- **Consumes:** audit event contract.
- **Done-when:** no PHI in any log sink (tested); audit entries present for every access path; success metrics from §7 of PRD measurable.
- **Watch-outs:** audit store append-only.

### WS8 — Close-the-Loop & Patient Matching  *(Wave 3)*
- **Mission:** Feed referrals into the care-coordinator queue; match to existing patients; expose status for the referrer.
- **Owns:** deterministic+probabilistic patient matching (ambiguous → coordinator queue, never auto-merge), coordinator queue integration, `GET status`, authorized status reporting back to referrer (writes `DisclosureRecord`).
- **Consumes:** `Referral`, status lifecycle, existing OpenUp coordinator surfaces.
- **Done-when:** referrals appear in the queue with SLA timers; status reflects lifecycle; no wrong-patient auto-merge.

### WS9 — Security Hardening & Compliance Test Harness  *(Wave 3)*
- **Mission:** Threat model + automated security/authorization test coverage.
- **Owns:** per-endpoint authz tests, secret-management review, mTLS/JWT verification, dependency/secret scanning gates, threat model doc, tenant-isolation tests (tenant A cannot read tenant B).
- **Done-when:** cross-tenant access blocked in tests; no secrets in repo; critical dep CVEs fail CI.

### WS7 — Desktop Shell  *(Wave 3, optional — build only if a named requirement demands it)*
- **Mission:** Thin **Tauri** wrapper hosting the web app, *only* if EHR-embedded browser proves insufficient.
- **Owns:** Tauri shell, EV code signing, auto-update; **no** clipboard hooking, **no** custom URI scraping, **no** background residency beyond hosting the app.
- **Watch-outs:** if built, it must not reintroduce any D1/D2/D3-cut behavior. Prefer not building it.

---

## 7. Dependency Graph & Spawn Waves

```
WAVE 1 (synchronous, blocking):
   WS0 Foundations & Contracts
        │  (freezes all seams in §4)
        ▼
WAVE 2 (parallel — spawn together, each in its own worktree):
   WS1 Launch/Auth ─┐
   WS2 FHIR Ingest ─┤ (WS2 depends on WS1 session shape — code to interface, integrate late)
   WS3 Intake API  ─┤
   WS4 Verify UI   ─┤ (consumes WS2 output + WS3 API — mock until Wave 3)
   WS5 Consent     ─┤
   WS6 Audit/Obs   ─┘
        │
        ▼
WAVE 3 (integration + optional):
   WS8 Close-the-loop & matching  (wires WS3→coordinator queue)
   WS9 Security hardening & tenant-isolation tests
   WS7 Desktop shell (only if justified)
        │
        ▼
   Integration gate → end-to-end sandbox test (Epic + Cerner) → CISO review pack
```

**Parallelism note:** Wave-2 agents integrate against the *contracts*, not each other's code. WS4 mocks the WS3 endpoint; WS2 mocks the WS1 session. Real wiring happens at the Wave-3 integration gate. This is what keeps six agents from blocking each other.

---

## 8. Cross-Cutting Guardrails (Every Agent)

Paste verbatim into each agent brief:

- **G1 — No cut features.** Never implement clipboard/hotkey capture, global input hooks, stealth/silent/background scraping, or "bypass anti-malware/firewall." SMART on FHIR only (D1–D3).
- **G2 — PHI in memory only.** No PHI or tokens written to disk, local storage, or logs. Wipe on session end (D4, D5).
- **G3 — No PHI in logs, URLs, errors, or analytics.** Patient IDs at most; never names/DOB/policy/clinical text. Structured, scrubbed logging.
- **G4 — Minimum necessary.** Fetch and transmit only allowlisted fields.
- **G5 — Audit everything.** Every PHI read/write emits an audit event.
- **G6 — Multi-tenant isolation.** No code path lets one tenant see another's data or config. Assume tests will try.
- **G7 — Idempotent writes.** All referral submissions carry and honor an idempotency key.
- **G8 — Human-in-the-loop.** No auto-transmit; provider confirmation is blocking.
- **G9 — Contracts are read-only** post-Wave-1. Need a change? Flag it for human reconciliation; don't fork the schema.

---

## 9. Definition of Done (Integration Gate)

- End-to-end referral completes against Epic **and** Cerner sandboxes: launch → FHIR ingest → verify → idempotent intake → coordinator queue → status back to referrer.
- Replay, malformed, unauthenticated, cross-tenant, and unauthorized-disclosure attempts all correctly rejected — with PHI-free responses.
- Audit trail present for every access; no PHI in any log sink (verified).
- Unconverted-referral purge job runs on schedule.
- Security harness (WS9) green; secrets clean; critical CVEs block CI.
- CISO review pack assembled: architecture + data-flow diagram, audit sample, tenant-isolation evidence, SMART registration record, BAA/authorization-to-disclose status per tenant.

---

## 10. Open Items for Human Decision (Do Not Let Agents Guess)

1. **Intake placement:** routes inside `apps/web` vs. a dedicated `apps/referral-api` service (isolation vs. simplicity).
2. **API auth:** mutual TLS vs. signed per-tenant JWT (or both) — depends on what tenant EMRs/proxies support.
3. **Whether WS7 (desktop shell) is built at all** — requires a concrete requirement the EHR-embedded browser cannot meet.
4. **Legal:** covered-entity vs. business-associate posture per tenant, and the authorization-to-disclose basis for inbound PHI (ties to `PRODUCT_SCOPE.md` Regulatory Posture).
