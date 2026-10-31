import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { createReadStream } from "fs";
import { access, rm } from "fs/promises";
import { extname, join, resolve, sep } from "path";
import { In, Repository } from "typeorm";
import { detectImageTypeFromFile } from "@/common/utilities/file-signature.util";
import { coverDir } from "@/modules/buildings/cover-upload";
import { appConfig } from "@/config/app.config";
import {
  BuildingCategory,
  FeatureStatus,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";
import {
  Paginated,
  paginated,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuditService } from "@/modules/audit/audit.service";
import {
  CreateBuildingDto,
  ListBuildingsQueryDto,
  UpdateBuildingDto,
} from "@/modules/buildings/dto/building.dto";
import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { FeatureView, toFeatureView } from "@/modules/features/feature-view";
import { freshnessCutoff } from "@/modules/features/feature-status.util";
import { ReviewsService } from "@/modules/reviews/reviews.service";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/** Public URL; `v` changes whenever the building row changes, which busts browser caches. */
const coverUrl = (id: string, file: string | null, updatedAt: Date) =>
  file ? `/api/v1/buildings/${id}/cover?v=${updatedAt.getTime()}` : null;

export type BuildingView = Omit<Building, "coverImage"> & {
  /** Public URL of the cover photo (changes when the photo changes, so browsers refresh it). */
  coverImageUrl: string | null;
  features: FeatureView[];
  /** Approved reviews only. average is null until the first review is published. */
  rating: { average: number | null; count: number };
};

@Injectable()
export class BuildingsService {
  constructor(
    @InjectRepository(Building)
    private readonly buildings: Repository<Building>,
    @InjectRepository(AccessibilityFeature)
    private readonly features: Repository<AccessibilityFeature>,
    private readonly audit: AuditService,
    private readonly reviews: ReviewsService,
  ) {}

  async create(dto: CreateBuildingDto, actor: AuthUser): Promise<Building> {
    try {
      const b = await this.buildings.save(
        this.buildings.create({
          ...dto,
          category: dto.category ?? BuildingCategory.OTHER,
          description: dto.description ?? null,
          latitude: dto.latitude ?? null,
          longitude: dto.longitude ?? null,
          createdById: actor.id,
        }),
      );
      await this.audit.log({
        actorUserId: actor.id,
        action: "BUILDING_CREATED",
        entityType: "building",
        entityId: b.id,
        metadata: { name: b.name },
      });
      return b;
    } catch (e: any) {
      if (e?.code === "23505")
        throw new ConflictException(
          "A building with this name and address already exists",
        );
      throw e;
    }
  }

  async update(
    id: string,
    dto: UpdateBuildingDto,
    actor: AuthUser,
  ): Promise<Building> {
    const b = await this.mustFind(id);
    Object.assign(b, dto);
    try {
      await this.buildings.save(b);
    } catch (e: any) {
      if (e?.code === "23505")
        throw new ConflictException(
          "A building with this name and address already exists",
        );
      throw e;
    }
    await this.audit.log({
      actorUserId: actor.id,
      action: "BUILDING_UPDATED",
      entityType: "building",
      entityId: id,
      metadata: { fields: Object.keys(dto) },
    });
    return b;
  }

  async findOne(id: string): Promise<BuildingView> {
    const b = await this.mustFind(id);
    return (await this.toViews([b]))[0];
  }

  async getFeatures(id: string): Promise<FeatureView[]> {
    await this.mustFind(id);
    return this.featureViews(id);
  }

  async findAll(q: ListBuildingsQueryDto): Promise<Paginated<BuildingView>> {
    const qb = this.buildings.createQueryBuilder("b");

    if (q.search) {
      const s = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
      qb.andWhere("(b.name ILIKE :s OR b.address ILIKE :s)", { s });
    }
    if (q.category)
      qb.andWhere("b.category = :category", { category: q.category });

    const cutoff = freshnessCutoff(new Date(), appConfig.env.FRESHNESS_DAYS);
    const featureStatus = q.featureStatus ?? FeatureStatus.AVAILABLE;

    // One EXISTS per requested feature => building must have ALL of them.
    const conditions: string[][] = (q.features ?? []).map((ft, i) => [
      `f.feature_type = :ft${i}`,
      `f.status = :featureStatus`,
    ]);
    if (!conditions.length && q.verification) conditions.push([]); // "any feature"
    conditions.forEach((cond, i) => {
      const parts = ["f.building_id = b.id", ...cond];
      switch (q.verification) {
        case VerificationStatus.VERIFIED:
          parts.push(
            "f.verification_status = 'VERIFIED'",
            "f.last_observed_at >= :cutoff",
          );
          break;
        case VerificationStatus.STALE:
          parts.push(
            "f.verification_status = 'VERIFIED'",
            "f.last_observed_at < :cutoff",
          );
          break;
        case undefined:
          break;
        default:
          parts.push(`f.verification_status = :vs${i}`);
      }
      qb.andWhere(
        `EXISTS (SELECT 1 FROM accessibility_features f WHERE ${parts.join(" AND ")})`,
        {
          ...(q.features?.[i] ? { [`ft${i}`]: q.features[i] } : {}),
          featureStatus,
          cutoff,
          [`vs${i}`]: q.verification,
        },
      );
    });

    qb.orderBy(`b.${q.sortBy ?? "name"}`, q.order ?? "ASC").addOrderBy(
      "b.id",
      "ASC",
    );
    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();

    return paginated(await this.toViews(rows), total, q);
  }

  /**
   * Attach features and rating summary to buildings using two queries in total
   * (not one per building). Also used by the "Saved buildings" list.
   */
  async toViews(rows: Building[]): Promise<BuildingView[]> {
    const byBuilding = new Map<string, FeatureView[]>();
    if (!rows.length) return [];
    const feats = await this.features.find({
      where: { buildingId: In(rows.map((r) => r.id)) },
      order: { featureType: "ASC" },
    });
    const now = new Date();
    for (const f of feats) {
      const list = byBuilding.get(f.buildingId) ?? [];
      list.push(toFeatureView(f, now));
      byBuilding.set(f.buildingId, list);
    }
    const ratings = await this.reviews.summaries(rows.map((r) => r.id));
    return rows.map(({ coverImage, ...r }) => ({
      ...r,
      coverImageUrl: coverUrl(r.id, coverImage, r.updatedAt),
      features: byBuilding.get(r.id) ?? [],
      rating: ratings.get(r.id) ?? { average: null, count: 0 },
    }));
  }

  // ------------------------------------------------------------ cover photo
  async setCover(actor: AuthUser, id: string, file?: Express.Multer.File) {
    if (!file)
      throw new BadRequestException("Attach one image (form field name: file)");
    try {
      const b = await this.mustFind(id);
      const real = await detectImageTypeFromFile(file.path);
      if (!real || real.mime !== file.mimetype)
        throw new BadRequestException(
          "The file is not a valid JPEG, PNG or WebP image",
        );
      const previous = b.coverImage;
      b.coverImage = file.filename;
      await this.buildings.save(b);
      if (previous) await rm(join(coverDir(), previous), { force: true });
      await this.audit.log({
        actorUserId: actor.id,
        action: "BUILDING_COVER_SET",
        entityType: "building",
        entityId: id,
      });
      return { coverImageUrl: coverUrl(b.id, b.coverImage, b.updatedAt) };
    } catch (e) {
      await rm(file.path, { force: true }); // never keep a rejected upload
      throw e;
    }
  }

  async removeCover(actor: AuthUser, id: string) {
    const b = await this.mustFind(id);
    if (b.coverImage) {
      await rm(join(coverDir(), b.coverImage), { force: true });
      b.coverImage = null;
      await this.buildings.save(b);
      await this.audit.log({
        actorUserId: actor.id,
        action: "BUILDING_COVER_REMOVED",
        entityType: "building",
        entityId: id,
      });
    }
    return { coverImageUrl: null };
  }

  async openCover(id: string) {
    const b = await this.buildings.findOne({
      where: { id },
      select: { id: true, coverImage: true },
    });
    if (!b?.coverImage)
      throw new NotFoundException("This building has no cover photo");
    const abs = resolve(coverDir(), b.coverImage);
    if (!abs.startsWith(coverDir() + sep)) throw new NotFoundException();
    try {
      await access(abs);
    } catch {
      throw new NotFoundException("Cover photo file is missing");
    }
    return {
      stream: createReadStream(abs),
      mimeType: MIME[extname(b.coverImage)] ?? "application/octet-stream",
    };
  }

  private async featureViews(buildingId: string): Promise<FeatureView[]> {
    const feats = await this.features.find({
      where: { buildingId },
      order: { featureType: "ASC" },
    });
    const now = new Date();
    return feats.map((f) => toFeatureView(f, now));
  }

  private async mustFind(id: string): Promise<Building> {
    const b = await this.buildings.findOne({ where: { id } });
    if (!b) throw new NotFoundException("Building not found");
    return b;
  }
}
