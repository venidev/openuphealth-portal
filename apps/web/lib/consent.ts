// Consent & privacy constants (PRODUCT_SCOPE Privacy Rule).

// Bump when the corresponding document changes materially; a new version
// triggers re-consent. Consent rows are never overwritten — a new grant is a
// new row, a revocation sets revokedAt.
export const NPP_VERSION = "2026-07-01";

export const CONSENT_TYPES = [
  "notice-of-privacy-practices",
  "telehealth",
  "communications",
  "treatment",
  "employer-program",
] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_CHANNELS = ["email", "sms", "push", "none"] as const;
export type ConsentChannel = (typeof CONSENT_CHANNELS)[number];
