import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";
import { appConfig } from "@/config/app.config";
import {
  ModerationDecision,
  ModerationStatus,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";
import {
  paginated,
  PaginationQueryDto,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuditService } from "@/modules/audit/audit.service";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { FeatureStatusService } from "@/modules/features/feature-status.service";
import { computeFeatureState } from "@/modules/features/feature-status.util";
import { toFeatureView } from "@/modules/features/feature-view";
import {
  DecisionDto,
  ResolveDisputeDto,
  ReviewQueueQueryDto,
} from "@/modules/moderation/dto/moderation.dto";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import { Report } from "@/modules/reports/entities/report.entity";
import { ReportsService } from "@/modules/reports/reports.service";
import { toReportView } from "@/modules/reports/reports.views";

const DECISION_TO_STATUS: Record<string, ModerationStatus> = {
  [ModerationDecision.APPROVED]: ModerationStatus.APPROVED,
  [ModerationDecision.REJECTED]: ModerationStatus.REJECTED,
  [ModerationDecision.NEEDS_CLARIFICATION]:
    ModerationStatus.NEEDS_CLARIFICATION,
};

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(AccessibilityFeature)
    private readonly features: Repository<AccessibilityFeature>,
    private readonly dataSource: DataSource,
    private readonly featureStatus: FeatureStatusService,
    private readonly reportsService: ReportsService,
    private readonly audit: AuditService,
  ) {}

  async queue(q: ReviewQueueQueryDto) {
    const qb = this.reports
      .createQueryBuilder("r")
      .innerJoinAndSelect("r.feature", "f")
      .innerJoin("r.building", "b")
      .addSelect(["b.id", "b.name"])
      .innerJoin("r.submittedBy", "u")
      .addSelect(["u.id", "u.fullName"])
      .orderBy(
        "r.createdAt",
        (q.status ?? ModerationStatus.PENDING) === ModerationStatus.PENDING
          ? "ASC"
          : "DESC",
      );
    if (q.status !== "ALL")
      qb.where("r.moderationStatus = :s", {
        s: q.status ?? ModerationStatus.PENDING,
      });
    if (q.buildingId) qb.andWhere("r.buildingId = :bid", { bid: q.buildingId });

    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();
    const evidence = await this.reportsService.evidenceFor(
      rows.map((r) => r.id),
    );
    return paginated(
      rows.map((r) => ({
        ...toReportView(r, evidence.get(r.id)),
        featureType: r.feature!.featureType,
        currentFeatureStatus: r.feature!.status,
        building: { id: r.building!.id, name: r.building!.name },
        submittedBy: {
          id: r.submittedBy!.id,
          fullName: r.submittedBy!.fullName,
        },
      })),
      total,
      q,
    );
  }

  async decide(moderator: AuthUser, reportId: string, dto: DecisionDto) {
    return this.dataSource.transaction(async (em) => {
      const report = await em.findOne(Report, {
        where: { id: reportId },
        lock: { mode: "pessimistic_write" },
      });
      if (!report) throw new NotFoundException("Report not found");
      if (report.submittedById === moderator.id)
        throw new ForbiddenException("You cannot moderate your own report");
      if (report.moderationStatus !== ModerationStatus.PENDING)
        throw new ConflictException(
          `Only PENDING reports can be decided (this one is ${report.moderationStatus})`,
        );

      const now = new Date();
      await em.insert(Verification, {
        reportId,
        reviewedById: moderator.id,
        decision: dto.decision,
        decisionReason: dto.reason?.slice(0, 1000) ?? null,
      });
      report.moderationStatus = DECISION_TO_STATUS[dto.decision];
      report.decidedAt = now;
      await em.save(report);

      let feature: AccessibilityFeature | null = null;
      if (dto.decision === ModerationDecision.APPROVED)
        feature = (await this.featureStatus.recompute(em, report.featureId))
          .feature;

      await this.audit.log(
        {
          actorUserId: moderator.id,
          action: `REPORT_${dto.decision}`,
          entityType: "report",
          entityId: reportId,
          metadata: { featureId: report.featureId },
        },
        em,
      );

      return {
        report: toReportView(report),
        feature: feature ? toFeatureView(feature) : null,
      };
    });
  }

  async disputes(q: PaginationQueryDto) {
    const [features, total] = await this.features.findAndCount({
      where: { verificationStatus: VerificationStatus.DISPUTED },
      order: { updatedAt: "ASC" },
      skip: skipOf(q),
      take: q.limit,
    });
    const data = await Promise.all(
      features.map(async (f) => {
        const approved = await this.reports.find({
          where: {
            featureId: f.id,
            moderationStatus: ModerationStatus.APPROVED,
          },
          order: { observedAt: "DESC" },
        });
        const { conflictingReportIds } = computeFeatureState(
          approved,
          appConfig.env.CONFLICT_WINDOW_DAYS,
        );
        return {
          feature: toFeatureView(f),
          conflictingReports: approved
            .filter((r) => conflictingReportIds.includes(r.id))
            .map((r) => toReportView(r)),
        };
      }),
    );
    return paginated(data, total, q);
  }

  async resolveDispute(
    moderator: AuthUser,
    featureId: string,
    dto: ResolveDisputeDto,
  ) {
    return this.dataSource.transaction(async (em) => {
      const feature = await em.findOne(AccessibilityFeature, {
        where: { id: featureId },
        lock: { mode: "pessimistic_write" },
      });
      if (!feature) throw new NotFoundException("Feature not found");
      if (feature.verificationStatus !== VerificationStatus.DISPUTED)
        throw new ConflictException("This feature is not currently disputed");

      const approved = await em.find(Report, {
        where: { featureId, moderationStatus: ModerationStatus.APPROVED },
      });
      const { conflictingReportIds } = computeFeatureState(
        approved,
        appConfig.env.CONFLICT_WINDOW_DAYS,
      );
      const winner = approved.find((r) => r.id === dto.winningReportId);
      if (!winner || !conflictingReportIds.includes(winner.id))
        throw new BadRequestException(
          "winningReportId must be one of the conflicting approved reports",
        );

      const losers = approved.filter(
        (r) =>
          conflictingReportIds.includes(r.id) &&
          r.observationStatus !== winner.observationStatus,
      );
      const now = new Date();
      for (const loser of losers) {
        loser.moderationStatus = ModerationStatus.SUPERSEDED;
        loser.decidedAt = now;
        await em.save(loser);
        await em.insert(Verification, {
          reportId: loser.id,
          reviewedById: moderator.id,
          decision: ModerationDecision.SUPERSEDED,
          decisionReason: dto.reason,
        });
      }

      const { feature: updated } = await this.featureStatus.recompute(
        em,
        featureId,
      );
      await this.audit.log(
        {
          actorUserId: moderator.id,
          action: "DISPUTE_RESOLVED",
          entityType: "feature",
          entityId: featureId,
          metadata: {
            winningReportId: winner.id,
            superseded: losers.map((l) => l.id),
          },
        },
        em,
      );
      return {
        feature: toFeatureView(updated),
        supersededReportIds: losers.map((l) => l.id),
      };
    });
  }
}
