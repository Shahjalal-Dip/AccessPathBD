
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  mkdir,
  readFile,
  unlink,
  writeFile,
} from "fs/promises";
import { randomUUID } from "crypto";
import { join } from "path";
import { DataSource, Repository } from "typeorm";

import { Report } from "@/modules/reports/entities/report.entity";
import { ReportEvidence } from "@/modules/reports/entities/report-evidence.entity";
import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import { AuditService } from "@/modules/audit/audit.service";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { CreateReportDto } from "@/modules/reports/dto/create-report.dto";
import { UpdateReportDto } from "@/modules/reports/dto/update-report.dto";
import { ModerationStatus } from "@/common/enums/accessibility.enums";
import { Role } from "@/common/enums/role.enum";
import { detectImageType } from "@/common/utilities/file-signature.util";

const MAX_FILES_PER_REPORT = 5;
const MAX_FILE_SIZE = 5 * 1024 * 1024;

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report)
    private readonly reportRepository: Repository<Report>,

    @InjectRepository(ReportEvidence)
    private readonly evidenceRepository: Repository<ReportEvidence>,

    @InjectRepository(Building)
    private readonly buildingRepository: Repository<Building>,

    @InjectRepository(AccessibilityFeature)
    private readonly featureRepository: Repository<AccessibilityFeature>,

    @InjectRepository(Verification)
    private readonly verificationRepository: Repository<Verification>,

    private readonly auditService: AuditService,
    private readonly dataSource: DataSource,
  ) {}

  async findMine(actor: AuthUser) {
    const reports = await this.reportRepository.find({
      where: { submittedById: actor.id },
      relations: {
        building: true,
        feature: true,
      },
      order: {
        createdAt: "DESC",
      },
    });

    if (reports.length === 0) {
      return [];
    }

    const reportIds = reports.map((report) => report.id);

    const verifications = await this.verificationRepository
      .createQueryBuilder("verification")
      .where("verification.reportId IN (:...reportIds)", {
        reportIds,
      })
      .orderBy("verification.reviewedAt", "DESC")
      .getMany();

    const latestByReport = new Map<string, Verification>();

    for (const verification of verifications) {
      if (!latestByReport.has(verification.reportId)) {
        latestByReport.set(verification.reportId, verification);
      }
    }

    return reports.map((report) => {
      const latest = latestByReport.get(report.id);

      return {
        ...report,
        latestDecision: latest
          ? {
              decision: latest.decision,
              decisionReason: latest.decisionReason,
              reviewedAt: latest.reviewedAt,
            }
          : null,
      };
    });
  }

  async findOne(id: string, actor: AuthUser) {
    const isModerator =
      actor.roles.includes(Role.MODERATOR) ||
      actor.roles.includes(Role.ADMIN);

    const query = this.reportRepository
      .createQueryBuilder("report")
      .leftJoinAndSelect("report.building", "building")
      .leftJoinAndSelect("report.feature", "feature")
      .where("report.id = :id", { id });

    if (!isModerator) {
      query.andWhere("report.submittedById = :userId", {
        userId: actor.id,
      });
    } else {
      query
        .leftJoin("report.submittedBy", "submitter")
        .addSelect([
          "submitter.id",
          "submitter.fullName",
          "submitter.email",
        ]);
    }

    const report = await query.getOne();

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const verificationHistory = await this.verificationRepository
      .createQueryBuilder("verification")
      .leftJoin("verification.reviewedBy", "reviewer")
      .addSelect(["reviewer.id", "reviewer.fullName"])
      .where("verification.reportId = :reportId", {
        reportId: report.id,
      })
      .orderBy("verification.reviewedAt", "ASC")
      .getMany();

    return {
      ...report,
      verificationHistory,
    };
  }

  async create(dto: CreateReportDto, actor: AuthUser) {
    const building = await this.buildingRepository.findOne({
      where: { id: dto.buildingId },
    });

    if (!building) {
      throw new NotFoundException("Building not found");
    }

    const feature = await this.featureRepository.findOne({
      where: { id: dto.featureId },
    });

    if (!feature) {
      throw new NotFoundException("Feature not found");
    }

    if (feature.buildingId !== dto.buildingId) {
      throw new BadRequestException(
        "The selected feature does not belong to this building",
      );
    }

    const report = this.reportRepository.create({
      buildingId: dto.buildingId,
      featureId: dto.featureId,
      submittedById: actor.id,
      observationStatus: dto.observationStatus,
      observedAt: new Date(dto.observedAt),
      description: dto.description,
      moderationStatus: ModerationStatus.PENDING,
      decidedAt: null,
    });

    const savedReport = await this.reportRepository.save(report);

    await this.auditService.log({
      actorUserId: actor.id,
      action: "REPORT_CREATED",
      entityType: "report",
      entityId: savedReport.id,
      metadata: {
        buildingId: savedReport.buildingId,
        featureId: savedReport.featureId,
      },
    });

    return savedReport;
  }

  async update(id: string, dto: UpdateReportDto, actor: AuthUser) {
    const report = await this.reportRepository.findOne({
      where: {
        id,
        submittedById: actor.id,
      },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const editableStatuses = [
      ModerationStatus.PENDING,
      ModerationStatus.NEEDS_CLARIFICATION,
    ];

    if (!editableStatuses.includes(report.moderationStatus)) {
      throw new BadRequestException(
        "This report can no longer be edited",
      );
    }

    if (
      dto.observationStatus === undefined &&
      dto.observedAt === undefined &&
      dto.description === undefined
    ) {
      throw new BadRequestException(
        "At least one field must be provided for update",
      );
    }

    if (dto.observationStatus !== undefined) {
      report.observationStatus = dto.observationStatus;
    }

    if (dto.observedAt !== undefined) {
      report.observedAt = new Date(dto.observedAt);
    }

    if (dto.description !== undefined) {
      report.description = dto.description;
    }

    const updatedReport = await this.reportRepository.save(report);

    await this.auditService.log({
      actorUserId: actor.id,
      action: "REPORT_UPDATED",
      entityType: "report",
      entityId: updatedReport.id,
      metadata: {
        updatedFields: Object.keys(dto),
      },
    });

    return updatedReport;
  }

  async withdraw(id: string, actor: AuthUser) {
    const report = await this.reportRepository.findOne({
      where: {
        id,
        submittedById: actor.id,
      },
    });

    if (!report) {
      throw new NotFoundException("Report not found");
    }

    const withdrawableStatuses = [
      ModerationStatus.PENDING,
      ModerationStatus.NEEDS_CLARIFICATION,
    ];

    if (!withdrawableStatuses.includes(report.moderationStatus)) {
      throw new BadRequestException(
        "This report can no longer be withdrawn",
      );
    }

    const previousStatus = report.moderationStatus;

    report.moderationStatus = ModerationStatus.WITHDRAWN;

    const withdrawnReport = await this.reportRepository.save(report);

    await this.auditService.log({
      actorUserId: actor.id,
      action: "REPORT_WITHDRAWN",
      entityType: "report",
      entityId: withdrawnReport.id,
      metadata: {
        previousStatus,
        newStatus: ModerationStatus.WITHDRAWN,
      },
    });

    return withdrawnReport;
  }

  async uploadEvidence(
    id: string,
    files: Express.Multer.File[],
    actor: AuthUser,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException("At least one image is required");
    }

    if (files.length > MAX_FILES_PER_REPORT) {
      throw new BadRequestException("Maximum 5 images are allowed");
    }

    const validatedFiles = files.map((file) => {
      if (!file.buffer || file.size <= 0) {
        throw new BadRequestException("Empty or invalid image file");
      }

      if (file.size > MAX_FILE_SIZE) {
        throw new BadRequestException(
          "Each image must be 5 MB or smaller",
        );
      }

      const detected = detectImageType(file.buffer.subarray(0, 12));

      if (!detected) {
        throw new BadRequestException(
          "Only JPEG, PNG and WebP images are allowed",
        );
      }

      const originalFilename =
        file.originalname
          .replace(/\\/g, "/")
          .split("/")
          .pop()
          ?.slice(0, 255) || "image";

      return {
        file,
        detected,
        originalFilename,
      };
    });

    const createdFilePaths: string[] = [];

    try {
      const savedEvidence = await this.dataSource.transaction(
        async (manager) => {
          const report = await manager
            .getRepository(Report)
            .createQueryBuilder("report")
            .setLock("pessimistic_write")
            .where("report.id = :id", { id })
            .andWhere("report.submittedById = :userId", {
              userId: actor.id,
            })
            .getOne();

          if (!report) {
            throw new NotFoundException("Report not found");
          }

          const editableStatuses = [
            ModerationStatus.PENDING,
            ModerationStatus.NEEDS_CLARIFICATION,
          ];

          if (!editableStatuses.includes(report.moderationStatus)) {
            throw new BadRequestException(
              "Evidence can only be added to open reports",
            );
          }

          const evidenceRepo = manager.getRepository(ReportEvidence);

          const existingCount = await evidenceRepo.count({
            where: { reportId: id },
          });

          if (
            existingCount + validatedFiles.length >
            MAX_FILES_PER_REPORT
          ) {
            throw new BadRequestException(
              "A report can contain a maximum of 5 images",
            );
          }

          const storageDirectory = join(
            process.cwd(),
            "storage",
            "report-evidence",
          );

          await mkdir(storageDirectory, { recursive: true });

          const evidenceRecords: ReportEvidence[] = [];

          for (const item of validatedFiles) {
            const storedFilename =
              `${randomUUID()}${item.detected.ext}`;

            const fullPath = join(
              storageDirectory,
              storedFilename,
            );

            await writeFile(fullPath, item.file.buffer, {
              flag: "wx",
            });

            createdFilePaths.push(fullPath);

            const evidence = evidenceRepo.create({
              reportId: id,
              uploadedById: actor.id,
              originalFilename: item.originalFilename,
              storedFilename,
              storagePath: `storage/report-evidence/${storedFilename}`,
              mimeType: item.detected.mime,
              sizeBytes: item.file.size,
            });

            evidenceRecords.push(evidence);
          }

          const saved = await evidenceRepo.save(evidenceRecords);

          await this.auditService.log(
            {
              actorUserId: actor.id,
              action: "REPORT_EVIDENCE_UPLOADED",
              entityType: "report",
              entityId: id,
              metadata: {
                evidenceIds: saved.map((item) => item.id),
                count: saved.length,
              },
            },
            manager,
          );

          return saved;
        },
      );

      return savedEvidence.map((item) => ({
        id: item.id,
        reportId: item.reportId,
        uploadedById: item.uploadedById,
        originalFilename: item.originalFilename,
        mimeType: item.mimeType,
        sizeBytes: item.sizeBytes,
        createdAt: item.createdAt,
      }));
    } catch (error) {
      await Promise.all(
        createdFilePaths.map(async (filePath) => {
          try {
            await unlink(filePath);
          } catch {
            // Ignore cleanup errors; preserve the original error.
          }
        }),
      );

      throw error;
    }
  }

  async getEvidenceFile(
    reportId: string,
    evidenceId: string,
    actor: AuthUser | null,
  ) {
    const evidence = await this.evidenceRepository
      .createQueryBuilder("evidence")
      .innerJoinAndSelect("evidence.report", "report")
      .where("evidence.id = :evidenceId", { evidenceId })
      .andWhere("evidence.reportId = :reportId", { reportId })
      .getOne();

    if (!evidence || !evidence.report) {
      throw new NotFoundException("Evidence not found");
    }

    const report = evidence.report;

    const isModerator =
      actor?.roles?.includes(Role.MODERATOR) ||
      actor?.roles?.includes(Role.ADMIN);

    const isOwner = actor?.id === report.submittedById;

    const isPublic =
      report.moderationStatus === ModerationStatus.APPROVED;

    if (!isPublic && !isOwner && !isModerator) {
      throw new NotFoundException("Evidence not found");
    }

    const validStoredFilename =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/i;

    if (!validStoredFilename.test(evidence.storedFilename)) {
      throw new NotFoundException("Evidence file not found");
    }

    const filePath = join(
      process.cwd(),
      "storage",
      "report-evidence",
      evidence.storedFilename,
    );

    let fileBuffer: Buffer;

    try {
      fileBuffer = await readFile(filePath);
    } catch {
      throw new NotFoundException("Evidence file not found");
    }

    return {
      buffer: fileBuffer,
      mimeType: evidence.mimeType,
      originalFilename: evidence.originalFilename,
    };
  }
}
