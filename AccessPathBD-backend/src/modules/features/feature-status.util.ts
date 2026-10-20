import {
  FeatureStatus,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";

/**
 * PURE business rules for "how much can we trust this feature?".
 * No database, no framework: easy to unit-test (see feature-status.util.spec.ts).
 *
 * Rules (documented in docs/ERD_AND_RULES.md):
 *  1. Only APPROVED reports count.
 *  2. No approved reports            -> UNVERIFIED, status UNKNOWN.
 *  3. Take the approved report with the newest observedAt ("latest").
 *  4. Look at approved reports observed within CONFLICT_WINDOW_DAYS before
 *     the latest one. If they disagree on status        -> DISPUTED.
 *  5. Otherwise                                          -> VERIFIED.
 *  6. STALE is derived at read time: VERIFIED but lastObservedAt is older
 *     than FRESHNESS_DAYS. It is never stored.
 */

const DAY_MS = 86_400_000;

export interface ApprovedReportInput {
  id: string;
  observationStatus: FeatureStatus;
  observedAt: Date;
  decidedAt: Date | null;
}

export interface ComputedFeatureState {
  status: FeatureStatus;
  /** UNVERIFIED | VERIFIED | DISPUTED (never STALE) */
  verificationStatus: VerificationStatus;
  lastObservedAt: Date | null;
  lastVerifiedAt: Date | null;
  currentReportId: string | null;
  /** Reports that disagree inside the conflict window (empty unless DISPUTED). */
  conflictingReportIds: string[];
}

export function computeFeatureState(
  approved: ApprovedReportInput[],
  conflictWindowDays: number,
): ComputedFeatureState {
  if (approved.length === 0) {
    return {
      status: FeatureStatus.UNKNOWN,
      verificationStatus: VerificationStatus.UNVERIFIED,
      lastObservedAt: null,
      lastVerifiedAt: null,
      currentReportId: null,
      conflictingReportIds: [],
    };
  }

  const sorted = [...approved].sort(
    (a, b) =>
      b.observedAt.getTime() - a.observedAt.getTime() ||
      (b.decidedAt?.getTime() ?? 0) - (a.decidedAt?.getTime() ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const latest = sorted[0];
  const windowStart = latest.observedAt.getTime() - conflictWindowDays * DAY_MS;
  const recent = sorted.filter((r) => r.observedAt.getTime() >= windowStart);
  const disputed = new Set(recent.map((r) => r.observationStatus)).size > 1;

  const lastVerifiedAt = sorted.reduce<Date | null>((max, r) => {
    if (!r.decidedAt) return max;
    return !max || r.decidedAt > max ? r.decidedAt : max;
  }, null);

  return {
    status: latest.observationStatus,
    verificationStatus: disputed
      ? VerificationStatus.DISPUTED
      : VerificationStatus.VERIFIED,
    lastObservedAt: latest.observedAt,
    lastVerifiedAt,
    currentReportId: latest.id,
    conflictingReportIds: disputed ? recent.map((r) => r.id) : [],
  };
}

export function freshnessCutoff(now: Date, freshnessDays: number): Date {
  return new Date(now.getTime() - freshnessDays * DAY_MS);
}

export function isStale(
  lastObservedAt: Date | null,
  now: Date,
  freshnessDays: number,
): boolean {
  if (!lastObservedAt) return false;
  return lastObservedAt < freshnessCutoff(now, freshnessDays);
}

/** What the public sees: stored status, with VERIFIED downgraded to STALE when old. */
export function effectiveVerificationStatus(
  stored: VerificationStatus,
  lastObservedAt: Date | null,
  now: Date,
  freshnessDays: number,
): VerificationStatus {
  if (
    stored === VerificationStatus.VERIFIED &&
    isStale(lastObservedAt, now, freshnessDays)
  )
    return VerificationStatus.STALE;
  return stored;
}
