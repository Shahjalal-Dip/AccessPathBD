import { Injectable } from "@nestjs/common";
import { EntityManager } from "typeorm";
import { appConfig } from "@/config/app.config";
import {
  FeatureType,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import {
  ComputedFeatureState,
  computeFeatureState,
} from "@/modules/features/feature-status.util";
import { Report } from "@/modules/reports/entities/report.entity";

@Injectable()
export class FeatureStatusService {
  async getOrCreate(
    em: EntityManager,
    buildingId: string,
    featureType: FeatureType,
  ): Promise<AccessibilityFeature> {
    const repo = em.getRepository(AccessibilityFeature);
    const existing = await repo.findOne({ where: { buildingId, featureType } });
    if (existing) return existing;
    await repo
      .createQueryBuilder()
      .insert()
      .values({ buildingId, featureType })
      .orIgnore()
      .execute();
    return repo.findOneOrFail({ where: { buildingId, featureType } });
  }

  async recompute(
    em: EntityManager,
    featureId: string,
  ): Promise<{ feature: AccessibilityFeature; state: ComputedFeatureState }> {
    const feature = await em.findOneOrFail(AccessibilityFeature, {
      where: { id: featureId },
      lock: { mode: "pessimistic_write" },
    });
    const approved = await em.find(Report, {
      where: { featureId, moderationStatus: ModerationStatus.APPROVED },
      select: {
        id: true,
        observationStatus: true,
        observedAt: true,
        decidedAt: true,
      },
    });
    const state = computeFeatureState(
      approved,
      appConfig.env.CONFLICT_WINDOW_DAYS,
    );

    feature.status = state.status;
    feature.verificationStatus = state.verificationStatus;
    feature.lastObservedAt = state.lastObservedAt;
    feature.lastVerifiedAt = state.lastVerifiedAt;
    await em.save(feature);
    return { feature, state };
  }
}
