# Product Scope - OpenUpHealth

## Vision

OpenUpHealth is a comprehensive mental health platform that makes quality mental healthcare more accessible by connecting patients with licensed therapists, providing self-guided wellness tools, enabling employer-sponsored mental healthcare programs, and giving care coordinators the operational tools they need to manage intake, insurance, and client care workflows efficiently.

The platform is designed with five distinct user personas, each with a tailored experience, and a shared infrastructure that allows the business to scale across individuals, employers, and provider networks.

**Compliance positioning:** OpenUpHealth is built to operate as a HIPAA-regulated system from day one of handling real patient data. Every feature that creates, stores, or transmits Protected Health Information (PHI) must satisfy the requirements in the [HIPAA Compliance Requirements](#hipaa-compliance-requirements) section before it is enabled in production. Enterprise buyers (employers, provider groups) additionally expect the controls in the [Enterprise-Grade Requirements](#enterprise-grade-requirements) section.

---

## Regulatory Posture

| Question | Position |
|----------|----------|
| Covered Entity or Business Associate? | **Both, depending on the relationship.** When OpenUpHealth provides the technology platform on behalf of therapist practices or employer health plans, it acts as a **Business Associate** and must sign BAAs with them. If OpenUpHealth directly employs/contracts therapists and bills for care, it is a **Covered Entity** (healthcare provider). The legal entity structure must be settled with counsel before launch; the platform must satisfy the Security Rule in either case. |
| What data is PHI? | Nearly everything tied to a patient account: intake responses, appointments, messages, mood check-ins, journals, PHQ-9/GAD-7 scores, insurance details, invoices for therapy services, and identifiers (name, email, IP address, device IDs). See [PHI Data Inventory](#phi-data-inventory). |
| Psychotherapy notes | If therapist session notes are ever added, they receive **heightened protection** under 45 CFR 164.508: stored segregated from the rest of the record, excluded from standard access/disclosure flows, and released only with separate patient authorization. The current schema has no session-notes model — do not add one without this segregation. |
| 42 CFR Part 2 | If the platform ever serves substance-use-disorder programs, Part 2 confidentiality rules (stricter than HIPAA) apply. Out of scope for now; revisit before onboarding SUD providers. |
| State law | Tele-mental-health rules, therapist licensure, minor consent ages, and mandatory reporting (duty to warn/protect) vary by state. Licensure enforcement is in-scope (see roadmap); minor patients are **out of scope** until state-by-state consent handling is built. |
| Payment processing | Stripe will not sign a BAA, but payment processing is exempt from HIPAA under §1179. Constraint: **no clinical information may be sent to Stripe** — invoice line items, metadata, and product names must be generic (e.g., "Session" not "PHQ-9 follow-up for depression"). |

---

## MVP Scope (This Build)

### User Personas

| Persona | Role Value | Primary Entry Point |
|---------|-----------|---------------------|
| Patient / Member | `patient` | `/app/*` |
| Therapist / Provider | `therapist` | `/provider/*` |
| Care Coordinator | `care_coordinator` | `/care/*` |
| Employer / Org Admin | `org_admin` | `/org/*` |
| Platform Super Admin | `super_admin` | `/admin/*` |

---

### Core Features Built

#### Patient Experience

- [x] Registration and authentication (email + password, role assignment at signup)
- [x] Multi-step intake questionnaire (therapy goals, language, specialties, availability, care format, payment preference, consent)
- [x] Therapist matching algorithm (specialty overlap, language match, care format compatibility — weighted scoring via `rankTherapists()`)
- [x] Provider directory with search and filter (specialty, language, modality, availability)
- [x] Therapist profile pages (bio, credentials, specialties, modalities, languages, rates)
- [x] Appointment booking (select therapist, date/time slot, modality: video or in-person)
- [x] Appointment management (view upcoming/past, cancel, reschedule)
- [x] Secure messaging (message threads between patient and therapist)
- [x] Mood check-ins (1–10 score + optional journal text, stored over time)
- [x] Journaling (freeform entries attached to mood check-ins)
- [x] PHQ-9 depression assessment (Patient Health Questionnaire — 9 items)
- [x] GAD-7 anxiety assessment (Generalized Anxiety Disorder — 7 items)
- [x] Assessment history and trend visualization
- [x] Self-guided wellness content library (articles, exercises, guided meditations)
- [x] Insurance information management (carrier, member ID, group number, card upload placeholder)
- [x] Insurance eligibility verification (mocked response)
- [x] Invoices and billing history
- [x] Stripe checkout session for payments
- [x] Payment method management
- [x] Crisis support resources (988 Suicide & Crisis Lifeline, emergency information)
- [x] Profile and account settings

#### Therapist Experience

- [x] Professional profile management (bio, specialties, modalities, languages, education, certifications)
- [x] Appointment schedule management (view upcoming sessions by day/week)
- [x] Availability configuration (set available time slots by day of week)
- [x] Client roster (list of active patients with summary info)
- [x] Client detail view (patient profile, appointment history, assessment scores)
- [x] Secure messaging (respond to patient messages)
- [x] Billing and payout overview (earnings summary, invoice list)
- [x] Compliance document tracking (license info, credential expiry)

#### Care Coordinator Experience

- [x] Intake review queue (incoming intake submissions awaiting assignment)
- [x] Therapist matching review (view algorithm results, override or confirm match)
- [x] Insurance verification queue (review submitted insurance and trigger eligibility check)
- [x] Support case management (create and manage care support cases)
- [x] Messaging access (view and respond to escalated patient messages)

#### Employer / Org Admin Experience

- [x] Member roster management (add, remove, and update employee members)
- [x] Eligibility configuration (define plan eligibility rules for the organization)
- [x] Anonymized utilization reporting (session counts, assessment completion rates — no individual PHI exposed)
- [x] Organization billing management (view invoices, manage payment methods)

#### Platform Super Admin Experience

- [x] User management (search, view, update, deactivate any user account)
- [x] Provider verification queue (review therapist credentials before activating profiles)
- [x] Content management (create, update, publish wellness content articles)
- [x] Audit log viewer (filterable log of all system actions with user, timestamp, resource)
- [x] Feature flag management (enable/disable platform features without deployment)
- [x] Platform statistics dashboard (total users, appointments, assessments, revenue)
- [x] Organization management (create and manage employer organizations)

---

### Out of Scope for MVP

- [ ] **Live video sessions** — placeholder UI exists; no video SDK is integrated
- [ ] **Real insurance eligibility API integration** — eligibility checks return mocked responses
- [ ] **Email notifications** — no transactional emails are sent
- [ ] **SMS notifications** — no SMS via Twilio or similar
- [ ] **Mobile push notifications** — `DeviceRegistration` model exists, Expo Push not wired
- [ ] **Therapist payout via Stripe Connect** — billing scaffold exists, no Connect onboarding/payouts
- [ ] **EHR / EMR integration** — no Epic, Athenahealth, or FHIR integration
- [ ] **Multi-language support** — the UI is English-only
- [ ] **Group therapy sessions** — the appointment model supports only 1:1 sessions
- [ ] **Prescription management** — the platform does not involve medication or prescribing
- [ ] **Peer support or community features** — no forums, support groups, or community boards
- [ ] **Supervisor / clinical oversight workflows** — no supervision assignments for trainee therapists
- [ ] **Minor patients** — adults (18+) only until state-by-state consent handling is built

---

## Planned Feature Expansion — Patient Referral Workflows

"Referrals" covers four distinct workflows with different owners and different compliance profiles. They share one `Referral` data model but must not be conflated in design.

### R1 — Inbound Clinical Referrals (external provider → OpenUpHealth)

A PCP, hospital discharge planner, or EAP counselor refers a patient into the platform. This is the highest-value acquisition channel for enterprise deals and the most compliance-sensitive flow, because **PHI arrives before the patient has an account or has consented to anything**.

- [ ] Referral submission — secure web form (and later fax-to-digital/Direct message intake) capturing: referring provider identity + NPI, patient contact info, reason for referral, urgency, insurance if known
- [ ] Referral queue for care coordinators — triage by urgency, assign, track SLA (e.g., first patient contact within 2 business days; same-day for urgent)
- [ ] Patient outreach + invitation — coordinator contacts the patient; invite link creates the account and routes into intake with referral context pre-attached
- [ ] Consent checkpoint — patient must consent before their referral data is used beyond outreach; unconverted referrals are purged on a defined schedule (e.g., 90 days)
- [ ] **Close-the-loop reporting to the referring provider** (scheduled / first-session-attended status) — requires patient authorization, and every report back is written to `DisclosureRecord`. Without authorization, the referrer gets nothing beyond "received."
- [ ] Status lifecycle: `received → triaged → patient_contacted → converted → scheduled → completed | declined | unreachable | expired`

### R2 — Internal Referrals & Transfers (therapist → therapist)

Rematch when fit is poor, specialty needs change, or a therapist departs the network.

- [ ] Therapist-initiated transfer request with reason; care coordinator reviews and runs matching for the new therapist
- [ ] Patient-initiated rematch ("request a different therapist") without requiring an awkward conversation — important retention lever in mental health
- [ ] Warm-handoff window — outgoing therapist retains read access for a defined overlap period (e.g., 30 days), then access automatically ends (minimum-necessary enforcement, audit-logged)
- [ ] Continuity packet — assessment history and treatment summary transfer to the new therapist; journal entries transfer only with patient consent

### R3 — Outbound Referrals (needs the platform cannot serve)

Psychiatry/medication management, IOP/PHP/inpatient, substance-use programs, crisis stabilization. Since prescribing is permanently out of scope, **every therapist will eventually need this workflow** — it is a clinical-safety feature, not a growth feature.

- [ ] Curated external referral directory (psychiatry, higher levels of care, community resources) maintained by the care team, filterable by state and insurance
- [ ] Therapist/coordinator creates an outbound referral tied to a `SupportCase`; documented reason and follow-up task to confirm the patient connected
- [ ] Crisis-tier handoffs link into the PHQ-9 item 9 escalation path (see Clinical Safety)
- [ ] Any records sent to the external provider require patient authorization + `DisclosureRecord` entry

### R4 — Member Referral Program (patient refers a friend) — deferred, design-constrained

A standard growth loop, but hazardous here: **sending or accepting an invite can disclose that the sender is using a mental-health service.** If ever built:

- Strictly opt-in for the sender; invite content is generic ("Your friend thinks you'd like OpenUpHealth") with no plan, therapist, or usage details; sender's usage never shown to the invitee
- Incentives reviewed by counsel first — beneficiary-inducement and state anti-kickback exposure if any government-program billing ever enters the picture
- Explicitly **out of scope** until R1–R3 ship and counsel signs off

### Persona impact

| Persona | New capability |
|---------|----------------|
| Care Coordinator | Referral queue becomes a primary surface alongside intake review; SLA dashboard |
| Therapist | "Refer out" and "request transfer" actions from the client detail view |
| Patient | "Request a new therapist" self-service; referral-context-aware intake |
| Org Admin | EAP referral submission on behalf of employees (R1 variant); referral conversion in utilization reports (small-cell suppression applies) |
| Super Admin | External referral directory management |

---

## HIPAA Compliance Requirements

> **Go-live gate:** No real patient data enters the system until every item marked **[GATE]** below is implemented and verified. This section is the compliance contract for the platform; the [roadmap](#roadmap) sequences the work.

### PHI Data Inventory

Classification of the 26 Prisma models. "PHI" means the record, combined with account identity, identifies an individual and relates to their health, care, or payment for care.

| Classification | Models | Handling |
|----------------|--------|----------|
| **PHI — clinical (highest sensitivity)** | `IntakeSubmission`, `Assessment`, `AssessmentResponse`, `MoodCheckin` (incl. journal text), `Message`, `MessageThread`, `SupportCase`, `Appointment`, `Referral` (planned — contains PHI for individuals who may never become users; purge schedule required) | Encrypted at rest; access strictly role- and relationship-scoped; every access audit-logged; never in application logs, error messages, URLs, analytics events, or third-party tools without a BAA |
| **PHI — administrative/financial** | `Insurance`, `Invoice`, `User` (patient accounts), `OrganizationMember` | Same storage controls; payment flows must keep clinical detail out of Stripe |
| **PHI-adjacent identifiers** | `Session`, `Account`, `VerificationToken`, `DeviceRegistration`, `AuditLog` (contains user IDs + IPs) | Protected as PHI because they link identity to platform use (using a mental-health service is itself sensitive) |
| **Not PHI** | `TherapistProfile`, `Availability`, `Organization`, `ContentResource`, `FeatureFlag`, `PaymentMethod` (tokenized refs only) | Standard security controls |

**Data-flow rule:** every external service that PHI touches requires a signed BAA *before* integration (see [BAA Register](#business-associate-agreement-baa-register)). Any feature spec that adds a new external data flow must name the vendor and BAA status.

### Technical Safeguards

| # | Requirement | Concrete implementation for this stack | Status |
|---|-------------|----------------------------------------|--------|
| T1 | **[GATE]** Encryption in transit | TLS 1.2+ everywhere (Vercel-terminated); HSTS; DB connections over TLS (`sslmode=require`) | Partial (verify DB TLS) |
| T2 | **[GATE]** Encryption at rest | Managed PostgreSQL with AES-256 at-rest encryption on a HIPAA-eligible plan; encrypted backups | Depends on DB host choice |
| T3 | Field-level encryption for highest-sensitivity content | Application-layer encryption for journal text, message bodies, and intake free-text (envelope encryption via KMS) so a DB-level leak does not expose clinical narrative | Not built |
| T4 | **[GATE]** Session management | Reduce NextAuth JWT `maxAge` from the 30-day default to ≤ 15 minutes idle / 12 hours absolute for PHI-accessing roles; server-side revocation on logout/deactivation | Not built — currently default 30-day JWT |
| T5 | **[GATE]** MFA | TOTP required for `therapist`, `care_coordinator`, `org_admin`, `super_admin`; strongly encouraged (later required) for patients | Not built |
| T6 | **[GATE]** Access control — RBAC + relationship scoping | Middleware-enforced role gates per route group (exists) **plus** object-level checks on every API route: therapists see only their own clients, patients only their own records, org admins never see individual clinical data. Add automated authorization tests per route. | Partial — role gates exist, object-level coverage unverified |
| T7 | Minimum necessary | Response shaping per role/purpose: coordinator views exclude journal text and item-level assessment responses unless escalated; therapist roster shows summaries, full record only for assigned clients | Not built |
| T8 | **[GATE]** Audit controls | Extend `AuditLog` (see [Data Model Changes](#data-model-changes-required)); log every PHI read/create/update/delete/export with actor, actor role, patient subject, purpose, IP, user agent, success/failure; append-only (no update/delete path); 6-year retention with cold-storage archive | Partial — model exists but lacks patient subject, role, purpose, success flag; mutability and coverage unverified |
| T9 | Integrity controls | Soft-delete + row versioning for clinical records (no hard deletes of clinical data); DB constraints preventing orphaned PHI | Not built |
| T10 | **[GATE]** Auto-logoff | Idle timeout with warning modal on web and mobile; mobile requires re-auth (biometric/PIN) on foregrounding after timeout | Not built |
| T11 | **[GATE]** No PHI in logs, URLs, or errors | Structured logging with a PHI-scrubbing serializer; patient IDs only (never names/content) in logs; no PHI in query strings; generic error pages; source maps and stack traces never exposed to clients | Unverified — needs audit |
| T12 | **[GATE]** Secrets management | All secrets in Vercel encrypted env vars (or a secrets manager); no secrets in repo; rotation procedure documented; separate secrets per environment | Partial |
| T13 | Backup & recovery | Automated encrypted backups, point-in-time recovery, quarterly restore tests; backups covered by the DB host's BAA | Depends on DB host |
| T14 | **[GATE]** Rate limiting & abuse controls | Sliding-window rate limits on auth endpoints (brute force) and all API routes; account lockout with notification; bot protection on signup | Not built |
| T15 | Unique user identification | One account per human; shared/service accounts prohibited; admin actions attributable to a named individual | Built (verify no shared admin practice) |

### Administrative Safeguards

These are organizational obligations, tracked here because product/engineering owns several deliverables:

| # | Requirement | Deliverable |
|---|-------------|-------------|
| A1 | **[GATE]** Security Officer & Privacy Officer designated | Named individuals; documented responsibilities |
| A2 | **[GATE]** Security Risk Analysis (SRA) | Formal risk assessment (NIST SP 800-66 methodology) covering all systems touching ePHI; risk register with owners and target dates; repeated annually and on major architecture change |
| A3 | **[GATE]** Policies & procedures | Written: access control, sanctions, incident response, contingency/DR, device & media, retention & disposal, workforce clearance/termination (access revoked same day) |
| A4 | Workforce training | HIPAA training before PHI access, annually thereafter; tracked completion |
| A5 | **[GATE]** Incident response & breach notification plan | Documented workflow: contain → risk-assess (4-factor test) → notify individuals within 60 days, HHS (immediately if 500+, else annual report), media if 500+ in a state; `BreachIncident` tracking in-product for the compliance team |
| A6 | Contingency plan | DR runbook with defined RPO/RTO (see enterprise section); emergency-mode operation procedure; annual DR test |
| A7 | **[GATE]** BAA management | Signed BAAs tracked with effective/expiry dates and scope (see register below) |
| A8 | Third-party security review | Vendor security assessment before each new PHI-touching integration |

### Business Associate Agreement (BAA) Register

Every vendor in the PHI path, with known constraints:

| Vendor / Category | PHI exposure | BAA position | Action |
|-------------------|--------------|--------------|--------|
| **Vercel** (hosting, functions, logs) | All request/response traffic; function logs | BAA available on **Enterprise plan only** | Upgrade to Enterprise + sign BAA before PHI go-live, or move PHI-serving workloads to a HIPAA-eligible host |
| **PostgreSQL host** (Neon/RDS/etc.) | All stored PHI | Must select a provider with a signed BAA (e.g., AWS RDS under AWS BAA; verify marketplace providers individually) | Choose host on BAA availability, not convenience |
| **Stripe** (payments) | Names, amounts, payment metadata | Will not sign a BAA; §1179 payment exemption applies | Enforce "no clinical data to Stripe" rule (generic line items, no diagnoses/assessment names in metadata) |
| **Transactional email** | Appointment/message notifications | Most (SendGrid, Postmark) won't sign BAAs for email content | Either use a HIPAA-eligible sender (AWS SES under BAA, Paubox) **or** send content-free notifications ("You have a new message — log in to view") — the latter is the default design |
| **SMS (Twilio)** | Reminders, codes | Twilio signs BAAs for eligible products | Sign BAA; still keep message content generic |
| **Video SDK** (Daily.co / Twilio Video / Zoom) | Live session audio/video | All offer BAAs on healthcare/enterprise tiers | Select on BAA + no-recording-by-default |
| **File storage (S3)** | Insurance card images | AWS signs BAA | Private buckets, pre-signed URLs, SSE-KMS |
| **Expo Push / FCM / APNs** | Notification payloads | No BAA path for payload content | Content-free pushes only ("You have an update"); PHI fetched in-app after auth |
| **Error tracking / analytics** (Sentry, PostHog, etc.) | Risk of PHI in events | Sentry offers BAA on eligible plans; most analytics do not | PHI-scrubbing before send; no session-replay on PHI pages; analytics restricted to marketing pages unless vendor is under BAA |
| **Clearinghouse** (Availity / Change Healthcare) | Insurance + demographics | Standard BAAs available | Sign at integration time |

### Privacy Rule — Patient Rights Features

HIPAA grants individuals rights the **product must implement** (not just policy documents):

- [ ] **[GATE] Notice of Privacy Practices** — presented and acknowledged at signup; acknowledgment timestamped and versioned
- [ ] **[GATE] Consent management** — granular, versioned consents (treatment, telehealth, communications channel preferences, employer-program participation); re-consent on material change; `Consent` model (see data model changes)
- [ ] **Right of access** — patient can request and receive an export of their designated record set within 30 days; self-service export (PDF/JSON) of appointments, assessments, mood/journal data, messages, invoices
- [ ] **Right to amend** — patient can request corrections; workflow for provider review with accept/deny + documented rationale
- [ ] **Accounting of disclosures** — track disclosures outside treatment/payment/operations for 6 years; `DisclosureRecord` model; self-service report
- [ ] **Right to request restrictions & confidential communications** — channel preferences honored everywhere (e.g., no voicemail, email-only)
- [ ] **Deceased/estate and personal-representative handling** — documented procedure (policy-level for now)

### Employer Reporting Anonymization Standard

Org admin utilization reports must never allow re-identification of employees:

- **Small-cell suppression:** no metric displayed for cohorts smaller than **10** members; filters/date-range combinations that would produce smaller cohorts return a suppressed state, not zero-padded data
- No drill-down from aggregates to individuals under any org role
- Report definitions reviewed against the de-identification standard (Safe Harbor) before release; treat employer reports as a formal data product with a review gate

---

## Enterprise-Grade Requirements

What employer and provider-network buyers require beyond HIPAA:

### Identity & Access

- [ ] **SSO (SAML 2.0 / OIDC)** for org admins and enterprise member auto-provisioning — buyers will require IdP integration (Okta, Entra ID, Google Workspace)
- [ ] **SCIM provisioning/deprovisioning** — employee offboarding must revoke platform access automatically
- [ ] **Admin session hardening** — step-up auth for destructive admin actions; IP allowlisting option for `super_admin`
- [ ] **Quarterly access reviews** — report of who holds which role and which patients each therapist/coordinator can access

### Reliability & Operations

- [ ] **SLOs / SLA** — target 99.9% availability for the app, published status page, incident communication process
- [ ] **DR objectives** — RPO ≤ 1 hour (point-in-time recovery), RTO ≤ 4 hours; tested annually
- [ ] **Observability** — structured logs (PHI-scrubbed), metrics, tracing, alerting on error rates/latency/auth anomalies; on-call rotation once real users are live
- [ ] **Environment separation** — dev/staging/production with distinct databases, secrets, and third-party accounts; **production PHI never copied to lower environments** — staging/dev use synthetic seed data only
- [ ] **CI/CD gates** — typecheck, tests, dependency audit (fail on known-critical CVEs), and secret-scanning on every PR; protected main branch; reviewed deploys to production

### Security Assurance

- [ ] **Annual penetration test** by a qualified firm; findings remediated before renewal conversations
- [ ] **SOC 2 Type II** — the de facto enterprise procurement requirement; begin control mapping early (most HIPAA Security Rule work double-counts), target report within 12 months of launch
- [ ] **HITRUST e1/i1** — evaluate when a payer or health-system buyer demands it; do not pre-invest
- [ ] **Vulnerability management** — automated dependency and container scanning; SLA-driven patching (critical ≤ 7 days)
- [ ] **Security questionnaire pack** — completed CAIQ/SIG-lite, architecture diagram, and data-flow diagram maintained for sales cycles

### Clinical Safety (Mental-Health-Specific)

These are enterprise *and* ethical requirements unique to this domain:

- [ ] **[GATE] PHQ-9 item 9 crisis escalation** — a positive response to the suicidality item must immediately: surface crisis resources in-flow (988, crisis text line), flag the assigned therapist and care-coordinator queue, and create a `SupportCase` with elevated priority. An unmonitored suicidality signal is the platform's single largest clinical liability.
- [ ] **Crisis pathway audit** — crisis resources reachable from every authenticated patient page in ≤ 1 tap/click
- [ ] **Multi-state licensure enforcement** — therapist profiles capture licensed states; matching and booking hard-block patient/therapist pairs across state lines where not permitted; license expiry blocks new bookings
- [ ] **Provider identity verification** — license verification against state boards (manual at first) before profile activation; re-verification on renewal
- [ ] **Clinical escalation SLA** — escalated messages/cases acknowledged by care team within a defined window during business hours; after-hours auto-response with crisis resources

### Data Governance

- [ ] **Retention & disposal schedule** — clinical records ≥ 7 years post-last-encounter (state medical-record laws often exceed HIPAA's 6-year documentation rule); audit logs 6 years; documented secure disposal
- [ ] **Account deletion vs. record retention** — patient-initiated deletion deactivates the account and removes marketing data, but clinical records are retained per schedule (communicated clearly in the deletion flow)
- [ ] **Data residency** — all PHI stored and processed in US regions

---

## Data Model Changes Required

Schema work implied by the sections above:

| Change | Detail |
|--------|--------|
| Extend `AuditLog` | Add `userRole`, `patientId` (subject of the access), `purpose` (treatment / payment / operations / patient-request), `userAgent`, `success`; make append-only (no update/delete in application code; DB-level protection); index on `patientId` + `createdAt` for accounting-of-disclosures queries |
| New `Consent` | `userId`, `type`, `documentVersion`, `grantedAt`, `revokedAt`, `channel` — versioned, never overwritten |
| New `DisclosureRecord` | `patientId`, `disclosedTo`, `purpose`, `description`, `disclosedAt` — 6-year accounting of disclosures |
| New `BreachIncident` | Incident tracking: discovery date, affected count, 4-factor risk assessment, notification status/dates |
| New `TherapistLicense` | `therapistId`, `state`, `licenseNumber`, `licenseType`, `expiresAt`, `verifiedAt`, `verifiedBy` — replaces free-form license info; drives licensure enforcement |
| New `Referral` | `type` (inbound / internal_transfer / outbound), `status` lifecycle, `patientId` (nullable until inbound referral converts), referring/receiving party details (provider name, NPI, organization), `reason`, `urgency`, `consentAt`, `expiresAt` — with a purge job for unconverted inbound referrals |
| New `ExternalProvider` | Curated refer-out directory: name, NPI, specialty, states served, insurance accepted, contact — maintained by care team |
| Clinical soft-delete | `deletedAt` on clinical models; hard delete prohibited in application code |
| MFA fields | TOTP secret (encrypted), recovery codes (hashed), MFA-enrolled flag on `User` |

---

## Roadmap

Rephased so that compliance gates come before exposure to real users. **Phase 1 + Phase 2 [GATE] items = the PHI go-live bar.**

### Phase 1 — Security Foundation (before any real users)

1. **Session hardening** — JWT maxAge ≤ 15 min idle / 12 h absolute, revocation on logout/deactivation, auto-logoff UI (T4, T10)
2. **MFA** for all staff/provider roles (T5)
3. **Email verification on signup** + **password reset flow** (with rate limiting and generic responses)
4. **Rate limiting** on auth and API endpoints; account lockout (T14)
5. **Object-level authorization audit** — verify and test every one of the 26 API routes for relationship scoping (T6)
6. **Audit logging v2** — extended model, full PHI-access coverage, append-only (T8)
7. **PHI-safe logging** — scrubbing serializer, no PHI in URLs/errors (T11)
8. **PostgreSQL on a BAA-covered host** — encryption at rest, TLS, PITR backups (T1, T2, T13) *(migration already underway)*
9. **Environment separation** — synthetic-data-only staging/dev
10. **PHQ-9 item 9 crisis escalation** (clinical safety gate)

### Phase 2 — Compliance Program (parallel with Phase 1; before PHI go-live)

11. **Vercel Enterprise BAA** (or re-platform decision) + DB host BAA signed (A7)
12. **Security Risk Analysis** + risk register (A2)
13. **Policies, incident response & breach notification plan** (A3, A5)
14. **Notice of Privacy Practices + consent management** in signup flow (Privacy Rule gates)
15. **Privacy Policy / Terms of Service** — legal review
16. **Security & Privacy Officers designated; workforce training** (A1, A4)

### Phase 3 — Business Operations

17. **Transactional email** — content-free notifications via BAA-covered or content-safe sender
18. **Live video sessions** — Daily.co or Twilio Video under BAA; server-side room tokens; no recording by default
19. **Therapist Stripe Connect onboarding** — Express onboarding for payouts; clinical-data firewall maintained
20. **Push notifications** — content-free payloads via Expo Push
21. **SMS reminders** — Twilio under BAA, generic content
22. **File storage** — S3 under AWS BAA, pre-signed URLs, SSE-KMS (insurance cards)
23. **Real insurance eligibility** — Availity or Change Healthcare under BAA
24. **Multi-state licensure enforcement** + provider license verification
25. **Calendar sync** — busy/free only by default (event titles leak PHI to Google)
26. **Referral workflows R2 + R3** — internal transfers/rematch and outbound referral directory (clinical-safety priority: therapists need a refer-out path since prescribing is out of scope)
27. **Referral workflow R1** — inbound clinical referrals with coordinator queue, patient invitation, consent checkpoint, and close-the-loop reporting under patient authorization

### Phase 4 — Enterprise Readiness

28. **SSO (SAML/OIDC) + SCIM** for employer orgs
29. **Patient rights self-service** — record export, amendment requests, accounting of disclosures
30. **Small-cell suppression** in employer reporting
31. **Penetration test** + remediation
32. **SOC 2 Type II** audit window begins
33. **Observability + SLOs + status page**; DR test
34. **Accessibility audit** — WCAG 2.2 AA
35. **Field-level encryption** for journals, messages, intake free-text (T3)
36. **Data retention automation** — archival and disposal jobs per schedule
37. **Org Admin EAP referral submission** — R1 variant for employer EAP counselors, with referral conversion added to utilization reports (small-cell suppression applies)

---

## Data Model Summary

The Prisma schema defines 26 models covering:

| Domain | Models |
|--------|--------|
| Identity | `User`, `Account`, `Session`, `VerificationToken` |
| Clinical | `IntakeSubmission`, `Appointment`, `MoodCheckin`, `Assessment`, `AssessmentResponse` |
| Messaging | `MessageThread`, `Message` |
| Provider | `TherapistProfile`, `Availability` |
| Insurance | `Insurance` |
| Billing | `Invoice`, `PaymentMethod` |
| Organization | `Organization`, `OrganizationMember` |
| Content | `ContentResource` |
| Care | `SupportCase` |
| Device | `DeviceRegistration` |
| Platform | `AuditLog`, `FeatureFlag` |

Planned additions (see [Data Model Changes Required](#data-model-changes-required)): `Consent`, `DisclosureRecord`, `BreachIncident`, `TherapistLicense`, `Referral`, `ExternalProvider`.
