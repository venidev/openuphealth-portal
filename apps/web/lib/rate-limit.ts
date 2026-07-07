import { NextRequest, NextResponse } from "next/server";

// Sliding-window rate limiter (PRODUCT_SCOPE T14).
//
// NOTE: this in-memory store is per-instance and resets on redeploy. It is the
// correct shape for the API but MUST be backed by Redis/Upstash before
// production so limits hold across serverless instances. Tracked as a Phase 1
// follow-up.
type Bucket = { count: number; resetAt: number };
const store = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number; // max requests per window
  windowMs: number; // window size in ms
  key: string; // logical bucket name (e.g. "auth", "assessments")
}

export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

// Returns a 429 NextResponse when the caller is over the limit, else null.
export function checkRateLimit(
  request: NextRequest,
  opts: RateLimitOptions
): NextResponse | null {
  const id = `${opts.key}:${clientIp(request)}`;
  const now = Date.now();
  const bucket = store.get(id);

  if (!bucket || now > bucket.resetAt) {
    store.set(id, { count: 1, resetAt: now + opts.windowMs });
    return null;
  }

  if (bucket.count >= opts.limit) {
    const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  bucket.count += 1;
  return null;
}
