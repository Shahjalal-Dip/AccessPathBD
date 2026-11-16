
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { DataSource, Repository } from "typeorm";

import {
  ModerationDecision,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";

import {
  Paginated,
  paginated,
  skipOf,
} from "@/common/dto/pagination-query.dto";

import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuditService } from "@/modules/audit/audit.service";

import { Report } from "@/modules/reports/entities/report.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { Verification } from "@/modules/moderation/entities/verification.entity";

import {
  DecisionDto,
  ResolveDisputeDto,
  ReviewQueueQueryDto,
} from "@/modules/moderation/dto/moderation.dto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepo: Repository<Report>,

    @InjectRepository(AccessibilityFeature)
    private readonly featureRepo: Repository<AccessibilityFeature>,

    @InjectRepository(Verification)
    private readonly verificationRepo: Repository<Verification>,

    private readonly dataSource: DataSource,
    private readonly auditService: AuditService,
  ) {}

  private reportsConflict(
    first: Report,
    second: Report,
  ): boolean {
    if (first.observationStatus === second.observationStatus) {
      return false;
    }

    const difference = Math.abs(
      new Date(first.observedAt).getTime() -
        new Date(second.observedAt).getTime(),
    );

    return difference <= THIRTY_DAYS_MS;
  }

  private hasConflict(reports: Report[]): boolean {
    for (let i = 0; i < reports.length; i++) {
      for (let j = i + 1; j < reports.length; j++) {
        if (this.reportsConflict(reports[i], reports[j])) {
          return true;
        }
      }
    }

    return false;
  }

  async getQueue(
    query: ReviewQueueQueryDto,
  ): Promise<Paginated<Report>> {
    const status = query.status ?? ModerationStatus.PENDING;

    const where: any = {
      ...(status === "ALL" ? {} : { moderationStatus: status }),
      ...(query.buildingId
        ? { buildingId: query.buildingId }
        : {}),
    };

    const [reports, total] = await this.reportRepo.findAndCount({
      where,
      relations: {
        building: true,
        feature: true,
        submittedBy: true,
      },
      order: {
        createdAt: "ASC",
      },
      skip: skipOf(query),
      take: query.limit,
    });

    return paginated(reports, total, query);
  }

  async decide(
    reportId: string,
    dto: DecisionDto,
    moderator: AuthUser,
  ): Promise<Report> {
    return this.dataSource.transaction(async (manager) => {
      const reportRepository = manager.getRepository(Report);
      const featureRepository =
        manager.getRepository(AccessibilityFeature);
      const verificationRepository =
        manager.getRepository(Verification);

      const report = await reportRepository.findOne({
        where: { id: reportId },
        lock: { mode: "pessimistic_write" },
      });

      if (!report) {
        throw new NotFoundException("Report not found");
      }

      if (report.submittedById === moderator.id) {
        throw new ForbiddenException(
          "A moderator cannot review their own report",
        );
      }

      if (
        ![
          ModerationStatus.PENDING,
          ModerationStatus.NEEDS_CLARIFICATION,
        ].includes(report.moderationStatus)
      ) {
        throw new BadRequestException(
          "This report can no longer be reviewed",
        );
      }

      if (
        dto.decision !== ModerationDecision.APPROVED &&
        !dto.reason?.trim()
      ) {
        throw new BadRequestException(
          "A reason is required for this decision",
        );
      }

      // Lock the related feature to serialize moderation operations.
      // Feature status and trust labels are calculated by FeaturesModule.
      if (dto.decision === ModerationDecision.APPROVED) {
        const feature = await featureRepository.findOne({
          where: { id: report.featureId },
          lock: { mode: "pessimistic_write" },
        });

        if (!feature) {
          throw new NotFoundException(
            "Accessibility feature not found",
          );
        }
      }

      const nextStatus: Record<string, ModerationStatus> = {
        [ModerationDecision.APPROVED]:
          ModerationStatus.APPROVED,
        [ModerationDecision.REJECTED]:
          ModerationStatus.REJECTED,
        [ModerationDecision.NEEDS_CLARIFICATION]:
          ModerationStatus.NEEDS_CLARIFICATION,
      };

      report.moderationStatus = nextStatus[dto.decision];
      report.decidedAt = new Date();

      await reportRepository.save(report);

      await verificationRepository.insert({
        reportId: report.id,
        reviewedById: moderator.id,
        decision: dto.decision,
        decisionReason: dto.reason?.trim() || null,
      });

      await this.auditService.log(
        {
          actorUserId: moderator.id,
          action: "REPORT_DECISION",
          entityType: "REPORT",
          entityId: report.id,
          metadata: {
            decision: dto.decision,
            reason: dto.reason?.trim() || null,
          },
        },
        manager,
      );

      return reportRepository.findOneOrFail({
        where: { id: report.id },
        relations: {
          building: true,
          feature: true,
        },
      });
    });
  }

  async getDisputes(query: ReviewQueueQueryDto) {
    const where: any = {
      moderationStatus: ModerationStatus.APPROVED,
      ...(query.buildingId
        ? { buildingId: query.buildingId }
        : {}),
    };

    const approvedReports = await this.reportRepo.find({
      where,
      relations: {
        building: true,
        feature: true,
        submittedBy: true,
      },
      order: {
        observedAt: "ASC",
      },
    });

    const grouped = new Map<string, Report[]>();

    for (const report of approvedReports) {
      const existing = grouped.get(report.featureId) ?? [];
      existing.push(report);
      grouped.set(report.featureId, existing);
    }

    const disputedGroups = Array.from(grouped.entries())
      .filter(([, reports]) => this.hasConflict(reports))
      .map(([featureId, reports]) => ({
        featureId,
        reportCount: reports.length,
        reports,
      }));

    const total = disputedGroups.length;

    const data = disputedGroups.slice(
      skipOf(query),
      skipOf(query) + query.limit,
    );

    return paginated(data, total, query);
  }

  async resolveDispute(
    featureId: string,
    dto: ResolveDisputeDto,
    moderator: AuthUser,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const featureRepository =
        manager.getRepository(AccessibilityFeature);
      const reportRepository = manager.getRepository(Report);
      const verificationRepository =
        manager.getRepository(Verification);

      const feature = await featureRepository.findOne({
        where: { id: featureId },
        lock: { mode: "pessimistic_write" },
      });

      if (!feature) {
        throw new NotFoundException(
          "Accessibility feature not found",
        );
      }

      const approvedReports = await reportRepository.find({
        where: {
          featureId,
          moderationStatus: ModerationStatus.APPROVED,
        },
        lock: { mode: "pessimistic_write" },
      });

      const winningReport = approvedReports.find(
        (report) => report.id === dto.winningReportId,
      );

      if (!winningReport) {
        throw new BadRequestException(
          "Winning report must be an approved report for this feature",
        );
      }

      const losingReports = approvedReports.filter(
        (report) =>
          report.id !== winningReport.id &&
          this.reportsConflict(report, winningReport),
      );

      if (losingReports.length === 0) {
        throw new BadRequestException(
          "No conflicting approved reports were found for the winning report",
        );
      }

      if (
        approvedReports.some(
          (report) =>
            (report.id === winningReport.id ||
              losingReports.some(
                (loser) => loser.id === report.id,
              )) &&
            report.submittedById === moderator.id,
        )
      ) {
        throw new ForbiddenException(
          "A moderator cannot resolve a dispute involving their own report",
        );
      }

      for (const losingReport of losingReports) {
        losingReport.moderationStatus =
          ModerationStatus.SUPERSEDED;

        await reportRepository.save(losingReport);

        await verificationRepository.insert({
          reportId: losingReport.id,
          reviewedById: moderator.id,
          decision: ModerationDecision.SUPERSEDED,
          decisionReason: dto.reason.trim(),
        });
      }

      await this.auditService.log(
        {
          actorUserId: moderator.id,
          action: "DISPUTE_RESOLVED",
          entityType: "ACCESSIBILITY_FEATURE",
          entityId: feature.id,
          metadata: {
            winningReportId: winningReport.id,
            supersededReportIds: losingReports.map(
              (report) => report.id,
            ),
            reason: dto.reason.trim(),
          },
        },
        manager,
      );

      return {
        message: "Dispute resolved successfully",
        featureId: feature.id,
        winningReportId: winningReport.id,
        supersededReportIds: losingReports.map(
          (report) => report.id,
        ),
      };
    });
  }
}
