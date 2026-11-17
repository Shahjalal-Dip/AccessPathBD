import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createReadStream } from "fs";
import { access, rm } from "fs/promises";
import { basename, resolve, sep } from "path";
import { DataSource, In, Repository } from "typeorm";
import { appConfig } from "@/config/app.config";
import {
  FeatureType,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";
import { Role } from "@/common/enums/role.enum";
import {
  Paginated,
  paginated,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { detectImageTypeFromFile } from "@/common/utilities/file-signature.util";
import { AuditService } from "@/modules/audit/audit.service";
import { Building } from "@/modules/buildings/entities/building.entity";
import { FeatureStatusService } from "@/modules/features/feature-status.service";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import {
  CreateReportDto,
  HistoryQueryDto,
  ListMyReportsQueryDto,
  UpdateReportDto,
} from "@/modules/reports/dto/report.dto";
import { ReportEvidence } from "@/modules/reports/entities/report-evidence.entity";
import { Report } from "@/modules/reports/entities/report.entity";
import { toEvidenceView, toReportView } from "@/modules/reports/reports.views";

const OPEN = [ModerationStatus.PENDING, ModerationStatus.NEEDS_CLARIFICATION];
const PUBLIC = [ModerationStatus.APPROVED, ModerationStatus.SUPERSEDED];
const isStaff = (u: AuthUser) =>
  u.roles.includes(Role.MODERATOR) || u.roles.includes(Role.ADMIN);

export const uploadDir = () => resolve(process.cwd(), appConfig.env.UPLOAD_DIR);

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(Report) private readonly reports: Repository<Report>,
    @InjectRepository(ReportEvidence)
    private readonly evidence: Repository<ReportEvidence>,
    @InjectRepository(Building)
    private readonly buildings: Repository<Building>,
    @InjectRepository(Verification)
    private readonly verifications: Repository<Verification>,
    private readonly dataSource: DataSource,
    private readonly featureStatus: FeatureStatusService,
    private readonly audit: AuditService,
  ) {}

  // ---------------------------------------------------------------- create
  async create(user: AuthUser, dto: CreateReportDto) {
    const observedAt = new Date(dto.observedAt);
    if (observedAt.getTime() > Date.now() + 5 * 60_000)
      throw new BadRequestException("observedAt cannot be in the future");

    const building = await this.buildings.findOne({
      where: { id: dto.buildingId },
      select: { id: true },
    });
    if (!building) throw new NotFoundException("Building not found");

    return this.dataSource.transaction(async (em) => {
      const feature = await this.featureStatus.getOrCreate(
        em,
        dto.buildingId,
        dto.featureType,
      );

      const open = await em.count(Report, {
        where: {
          submittedById: user.id,
          featureId: feature.id,
          moderationStatus: In(OPEN),
        },
      });
      if (open > 0)
        throw new ConflictException(
          "You already have an open report for this feature. Edit or withdraw it first.",
        );

      const report = await em.save(
        em.create(Report, {
          buildingId: dto.buildingId,
          featureId: feature.id,
          submittedById: user.id,
          observationStatus: dto.observationStatus,
          description: dto.description,
          observedAt,
          moderationStatus: ModerationStatus.PENDING,
        }),
      );
      await this.audit.log(
        {
          actorUserId: user.id,
          action: "REPORT_SUBMITTED",
          entityType: "report",
          entityId: report.id,
          metadata: {
            buildingId: dto.buildingId,
            featureType: dto.featureType,
          },
        },
        em,
      );
      return toReportView(report);
    });
  }

  // ------------------------------------------------------------- read
  async listMine(user: AuthUser, q: ListMyReportsQueryDto) {
    const [rows, total] = await this.reports.findAndCount({
      where: {
        submittedById: user.id,
        ...(q.status ? { moderationStatus: q.status } : {}),
      },
      order: { createdAt: "DESC" },
      skip: skipOf(q),
      take: q.limit,
    });
    const evidence = await this.evidenceFor(rows.map((r) => r.id));
    const latest = await this.latestDecisions(rows.map((r) => r.id));
    return paginated(
      rows.map((r) => ({
        ...toReportView(r, evidence.get(r.id)),
        latestDecision: latest.get(r.id) ?? null,
      })),
      total,
      q,
    );
  }

  async getOne(user: AuthUser, id: string) {
    const report = await this.mustFind(id);
    const staff = isStaff(user);
    // Hide existence of other people's reports instead of returning 403
    if (!staff && report.submittedById !== user.id)
      throw new NotFoundException("Report not found");

    const evidence = await this.evidence.find({
      where: { reportId: id },
      order: { uploadedAt: "ASC" },
    });
    const history = await this.verifications
      .createQueryBuilder("v")
      .innerJoin("v.reviewedBy", "u")
      .addSelect(["u.id", "u.fullName"])
      .where("v.reportId = :id", { id })
      .orderBy("v.reviewedAt", "ASC")
      .getMany();

    return {
      ...toReportView(report, evidence),
      // submitter identity is for staff only; contributors never see other people's details
      ...(staff && report.submittedBy
        ? {
            submittedBy: {
              id: report.submittedBy.id,
              fullName: report.submittedBy.fullName,
            },
          }
        : {}),
      verificationHistory: history.map((v) => ({
        id: v.id,
        decision: v.decision,
        reason: v.decisionReason,
        reviewedAt: v.reviewedAt,
        // moderator identity is visible to staff only
        ...(staff
          ? {
              reviewedBy: {
                id: v.reviewedBy!.id,
                fullName: v.reviewedBy!.fullName,
              },
            }
          : {}),
      })),
    };
  }

  // ------------------------------------------------------------ update
  async update(user: AuthUser, id: string, dto: UpdateReportDto) {
    if (
      dto.observedAt &&
      new Date(dto.observedAt).getTime() > Date.now() + 5 * 60_000
    )
      throw new BadRequestException("observedAt cannot be in the future");

    return this.dataSource.transaction(async (em) => {
      const report = await em.findOne(Report, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!report || report.submittedById !== user.id)
        throw new NotFoundException("Report not found");
      if (!OPEN.includes(report.moderationStatus))
        throw new ConflictException(
          "Only pending reports or reports needing clarification can be edited. Approved reports are history and cannot be changed.",
        );

      if (dto.observationStatus)
        report.observationStatus = dto.observationStatus;
      if (dto.description) report.description = dto.description;
      if (dto.observedAt) report.observedAt = new Date(dto.observedAt);
      // After a clarification request, an edit puts the report back in the queue
      report.moderationStatus = ModerationStatus.PENDING;
      await em.save(report);
      await this.audit.log(
        {
          actorUserId: user.id,
          action: "REPORT_EDITED",
          entityType: "report",
          entityId: id,
        },
        em,
      );
      const evidence = await em.find(ReportEvidence, {
        where: { reportId: id },
      });
      return toReportView(report, evidence);
    });
  }

  async withdraw(user: AuthUser, id: string) {
    return this.dataSource.transaction(async (em) => {
      const report = await em.findOne(Report, {
        where: { id },
        lock: { mode: "pessimistic_write" },
      });
      if (!report || report.submittedById !== user.id)
        throw new NotFoundException("Report not found");
      if (!OPEN.includes(report.moderationStatus))
        throw new ConflictException("Only open reports can be withdrawn");
      report.moderationStatus = ModerationStatus.WITHDRAWN;
      await em.save(report);
      await this.audit.log(
        {
          actorUserId: user.id,
          action: "REPORT_WITHDRAWN",
          entityType: "report",
          entityId: id,
        },
        em,
      );
      return toReportView(report);
    });
  }

  // ---------------------------------------------------------- evidence
  async addEvidence(
    user: AuthUser,
    reportId: string,
    files: Express.Multer.File[] = [],
  ) {
    try {
      if (!files.length)
        throw new BadRequestException(
          "Attach at least one image (form field name: files)",
        );
      const report = await this.reports.findOne({ where: { id: reportId } });
      if (!report || report.submittedById !== user.id)
        throw new NotFoundException("Report not found");
      if (!OPEN.includes(report.moderationStatus))
        throw new ConflictException(
          "Evidence can only be added to open reports",
        );

      const existing = await this.evidence.count({ where: { reportId } });
      if (existing + files.length > appConfig.env.UPLOAD_MAX_FILES_PER_REPORT)
        throw new BadRequestException(
          `A report can have at most ${appConfig.env.UPLOAD_MAX_FILES_PER_REPORT} images`,
        );

      // The client-declared Content-Type is not trustworthy: verify the real bytes.
      for (const f of files) {
        const real = await detectImageTypeFromFile(f.path);
        if (!real || real.mime !== f.mimetype)
          throw new BadRequestException(
            `"${basename(f.originalname)}" is not a valid JPEG, PNG or WebP image`,
          );
      }

      const saved = await this.evidence.save(
        files.map((f) =>
          this.evidence.create({
            reportId,
            fileName: f.filename,
            originalName: basename(f.originalname).slice(0, 120),
            mimeType: f.mimetype,
            sizeBytes: f.size,
          }),
        ),
      );
      await this.audit.log({
        actorUserId: user.id,
        action: "EVIDENCE_UPLOADED",
        entityType: "report",
        entityId: reportId,
        metadata: { count: saved.length },
      });
      return saved.map(toEvidenceView);
    } catch (e) {
      // Never leave rejected uploads on disk
      await Promise.all(files.map((f) => rm(f.path, { force: true })));
      throw e;
    }
  }

  /** Approved/superseded evidence is public; otherwise only owner + staff. */
  async openEvidence(
    user: AuthUser | null,
    reportId: string,
    evidenceId: string,
  ) {
    const ev = await this.evidence.findOne({
      where: { id: evidenceId, reportId },
    });
    const report =
      ev && (await this.reports.findOne({ where: { id: reportId } }));
    if (!ev || !report) throw new NotFoundException("Evidence not found");

    if (!PUBLIC.includes(report.moderationStatus)) {
      if (!user)
        throw new UnauthorizedException("Log in to view this evidence");
      if (!isStaff(user) && report.submittedById !== user.id)
        throw new NotFoundException("Evidence not found");
    }

    const root = uploadDir();
    const abs = resolve(root, ev.fileName);
    if (!abs.startsWith(root + sep))
      throw new NotFoundException("Evidence not found");
    try {
      await access(abs);
    } catch {
      throw new NotFoundException("Evidence file is missing");
    }
    return {
      stream: createReadStream(abs),
      mimeType: ev.mimeType,
      isPublic: PUBLIC.includes(report.moderationStatus),
    };
  }

  // ------------------------------------------------- public history
  /** Approved + superseded reports for a building. Contains NO personal data. */
  async publicHistory(buildingId: string, q: HistoryQueryDto) {
    const building = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });
    if (!building) throw new NotFoundException("Building not found");

    const qb = this.reports
      .createQueryBuilder("r")
      .innerJoinAndSelect("r.feature", "f")
      .where("r.buildingId = :buildingId", { buildingId })
      .andWhere("r.moderationStatus IN (:...pub)", { pub: PUBLIC })
      .orderBy("r.observedAt", "DESC")
      .addOrderBy("r.id", "ASC");
    if (q.featureType)
      qb.andWhere("f.featureType = :ft", { ft: q.featureType as FeatureType });

    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();
    const evidence = await this.evidenceFor(rows.map((r) => r.id));
    const data: Paginated<unknown>["data"] = rows.map((r) => ({
      reportId: r.id,
      featureType: r.feature!.featureType,
      observationStatus: r.observationStatus,
      description: r.description,
      observedAt: r.observedAt,
      moderationStatus: r.moderationStatus,
      verifiedAt: r.decidedAt,
      evidence: (evidence.get(r.id) ?? []).map(toEvidenceView),
    }));
    return paginated(data, total, q);
  }

  // ------------------------------------------------------------ helpers
  async evidenceFor(reportIds: string[]) {
    const map = new Map<string, ReportEvidence[]>();
    if (!reportIds.length) return map;
    const rows = await this.evidence.find({
      where: { reportId: In(reportIds) },
      order: { uploadedAt: "ASC" },
    });
    for (const e of rows)
      map.set(e.reportId, [...(map.get(e.reportId) ?? []), e]);
    return map;
  }

  private async latestDecisions(reportIds: string[]) {
    const map = new Map<
      string,
      { decision: string; reason: string | null; reviewedAt: Date }
    >();
    if (!reportIds.length) return map;
    const rows = await this.verifications.find({
      where: { reportId: In(reportIds) },
      order: { reviewedAt: "ASC" },
    });
    for (const v of rows)
      map.set(v.reportId, {
        decision: v.decision,
        reason: v.decisionReason,
        reviewedAt: v.reviewedAt,
      });
    return map;
  }

  private async mustFind(id: string) {
    const r = await this.reports.findOne({
      where: { id },
      relations: { feature: true, building: true, submittedBy: true },
    });
    if (!r) throw new NotFoundException("Report not found");
    return r;
  }
}
