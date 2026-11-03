import { appConfig } from "@/config/app.config";
import {
  FeatureStatus,
  FeatureType,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { effectiveVerificationStatus } from "@/modules/features/feature-status.util";

export interface FeatureView {
  id: string;
  buildingId: string;
  featureType: FeatureType;
  status: FeatureStatus;
  verificationStatus: VerificationStatus;
  lastObservedAt: Date | null;
  lastVerifiedAt: Date | null;
  daysSinceObserved: number | null;
  needsRecheck: boolean;
  details: string | null;
}

export function toFeatureView(
  f: AccessibilityFeature,
  now: Date = new Date(),
  freshnessDays: number = appConfig.env.FRESHNESS_DAYS,
): FeatureView {
  const verificationStatus = effectiveVerificationStatus(
    f.verificationStatus,
    f.lastObservedAt,
    now,
    freshnessDays,
  );
  return {
    id: f.id,
    buildingId: f.buildingId,
    featureType: f.featureType,
    status: f.status,
    verificationStatus,
    lastObservedAt: f.lastObservedAt,
    lastVerifiedAt: f.lastVerifiedAt,
    daysSinceObserved: f.lastObservedAt
      ? Math.floor((now.getTime() - f.lastObservedAt.getTime()) / 86_400_000)
      : null,
    needsRecheck: verificationStatus !== VerificationStatus.VERIFIED,
    details: f.details,
  };
}
