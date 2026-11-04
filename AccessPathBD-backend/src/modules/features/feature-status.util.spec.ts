import {
  FeatureStatus as S,
  VerificationStatus as V,
} from "@/common/enums/accessibility.enums";
import {
  ApprovedReportInput,
  computeFeatureState,
  effectiveVerificationStatus,
} from "@/modules/features/feature-status.util";

const NOW = new Date("2026-06-01T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const report = (
  id: string,
  status: S,
  obsDaysAgo: number,
): ApprovedReportInput => ({
  id,
  observationStatus: status,
  observedAt: daysAgo(obsDaysAgo),
  decidedAt: daysAgo(obsDaysAgo - 1),
});
const WINDOW = 30;

describe("computeFeatureState", () => {
  it("no approved reports -> UNKNOWN / UNVERIFIED", () => {
    const s = computeFeatureState([], WINDOW);
    expect(s.status).toBe(S.UNKNOWN);
    expect(s.verificationStatus).toBe(V.UNVERIFIED);
    expect(s.lastObservedAt).toBeNull();
  });

  it("one approved report -> VERIFIED with that status", () => {
    const s = computeFeatureState([report("a", S.AVAILABLE, 5)], WINDOW);
    expect(s.status).toBe(S.AVAILABLE);
    expect(s.verificationStatus).toBe(V.VERIFIED);
    expect(s.currentReportId).toBe("a");
  });

  it("agreeing recent reports stay VERIFIED", () => {
    const s = computeFeatureState(
      [report("a", S.AVAILABLE, 5), report("b", S.AVAILABLE, 12)],
      WINDOW,
    );
    expect(s.verificationStatus).toBe(V.VERIFIED);
    expect(s.conflictingReportIds).toEqual([]);
  });

  it("disagreeing reports inside the window -> DISPUTED, newest status shown", () => {
    const s = computeFeatureState(
      [report("old", S.UNAVAILABLE, 14), report("new", S.AVAILABLE, 4)],
      WINDOW,
    );
    expect(s.verificationStatus).toBe(V.DISPUTED);
    expect(s.status).toBe(S.AVAILABLE);
    expect(s.conflictingReportIds.sort()).toEqual(["new", "old"]);
  });

  it("an older contradicting report OUTSIDE the window is ignored (genuine change over time)", () => {
    const s = computeFeatureState(
      [
        report("fixed", S.AVAILABLE, 2),
        report("was-broken", S.UNAVAILABLE, 60),
      ],
      WINDOW,
    );
    expect(s.verificationStatus).toBe(V.VERIFIED);
    expect(s.status).toBe(S.AVAILABLE);
  });

  it("is independent of input order", () => {
    const a = report("a", S.AVAILABLE, 4);
    const b = report("b", S.UNAVAILABLE, 10);
    expect(computeFeatureState([a, b], WINDOW)).toEqual(
      computeFeatureState([b, a], WINDOW),
    );
  });

  it("lastVerifiedAt is the most recent moderation time", () => {
    const s = computeFeatureState(
      [report("a", S.AVAILABLE, 40), report("b", S.AVAILABLE, 3)],
      WINDOW,
    );
    expect(s.lastVerifiedAt).toEqual(daysAgo(2));
  });
});

describe("effectiveVerificationStatus (STALE is derived, never stored)", () => {
  it("VERIFIED and fresh stays VERIFIED", () => {
    expect(effectiveVerificationStatus(V.VERIFIED, daysAgo(89), NOW, 90)).toBe(
      V.VERIFIED,
    );
  });
  it("VERIFIED but older than freshness window becomes STALE", () => {
    expect(effectiveVerificationStatus(V.VERIFIED, daysAgo(91), NOW, 90)).toBe(
      V.STALE,
    );
  });
  it("DISPUTED and UNVERIFIED are never downgraded to STALE", () => {
    expect(effectiveVerificationStatus(V.DISPUTED, daysAgo(400), NOW, 90)).toBe(
      V.DISPUTED,
    );
    expect(effectiveVerificationStatus(V.UNVERIFIED, null, NOW, 90)).toBe(
      V.UNVERIFIED,
    );
  });
});
