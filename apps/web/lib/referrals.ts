// Referral workflow domain logic (PRODUCT_SCOPE R1–R3).

export const REFERRAL_TYPES = [
  "inbound",
  "internal_transfer",
  "outbound",
] as const;
export type ReferralType = (typeof REFERRAL_TYPES)[number];

export const REFERRAL_URGENCIES = ["routine", "urgent", "crisis"] as const;
export type ReferralUrgency = (typeof REFERRAL_URGENCIES)[number];

export const REFERRAL_STATUSES = [
  "received",
  "triaged",
  "patient_contacted",
  "converted",
  "scheduled",
  "completed",
  "declined",
  "unreachable",
  "expired",
] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

// Allowed forward transitions. Terminal states have no outgoing edges.
const TRANSITIONS: Record<ReferralStatus, ReferralStatus[]> = {
  received: ["triaged", "declined", "expired"],
  triaged: ["patient_contacted", "declined", "unreachable", "expired"],
  patient_contacted: ["converted", "unreachable", "declined", "expired"],
  converted: ["scheduled", "declined"],
  scheduled: ["completed", "declined"],
  completed: [],
  declined: [],
  unreachable: ["patient_contacted", "expired"],
  expired: [],
};

export function isValidTransition(
  from: ReferralStatus,
  to: ReferralStatus
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: ReferralStatus): boolean {
  return TRANSITIONS[status]?.length === 0;
}
