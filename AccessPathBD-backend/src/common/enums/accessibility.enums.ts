export enum FeatureType {
  STEP_FREE_ENTRANCE = "STEP_FREE_ENTRANCE",
  RAMP = "RAMP",
  LIFT = "LIFT",
  ACCESSIBLE_TOILET = "ACCESSIBLE_TOILET",
  ACCESSIBLE_PARKING = "ACCESSIBLE_PARKING",
  WIDE_DOORS = "WIDE_DOORS",
  UNOBSTRUCTED_ROUTE = "UNOBSTRUCTED_ROUTE",
  TACTILE_PAVING = "TACTILE_PAVING",
  OTHER = "OTHER",
}

/** What was observed about a feature. UNKNOWN only exists before any approved report. */
export enum FeatureStatus {
  AVAILABLE = "AVAILABLE",
  PARTIAL = "PARTIAL",
  UNAVAILABLE = "UNAVAILABLE",
  UNKNOWN = "UNKNOWN",
}

/** Statuses a contributor may report (UNKNOWN is not an observation). */
export const REPORTABLE_STATUSES = [
  FeatureStatus.AVAILABLE,
  FeatureStatus.PARTIAL,
  FeatureStatus.UNAVAILABLE,
] as const;

/**
 * How much the information can be trusted.
 * STALE is never stored: it is derived at read time from the observation date.
 */
export enum VerificationStatus {
  UNVERIFIED = "UNVERIFIED",
  VERIFIED = "VERIFIED",
  STALE = "STALE",
  DISPUTED = "DISPUTED",
}

export enum ModerationStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION",
  WITHDRAWN = "WITHDRAWN",
  SUPERSEDED = "SUPERSEDED",
}

export enum ModerationDecision {
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  NEEDS_CLARIFICATION = "NEEDS_CLARIFICATION",
  SUPERSEDED = "SUPERSEDED",
}

export enum BuildingCategory {
  ACADEMIC = "ACADEMIC",
  LIBRARY = "LIBRARY",
  ADMINISTRATION = "ADMINISTRATION",
  HEALTH = "HEALTH",
  FOOD = "FOOD",
  RELIGIOUS = "RELIGIOUS",
  SPORTS = "SPORTS",
  RESIDENTIAL = "RESIDENTIAL",
  TRANSPORT = "TRANSPORT",
  OTHER = "OTHER",
}

export enum ReviewStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}
