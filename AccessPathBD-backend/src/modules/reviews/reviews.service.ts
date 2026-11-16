import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ReviewStatus } from "@/common/enums/accessibility.enums";
import { paginated, skipOf } from "@/common/dto/pagination-query.dto";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import { AuditService } from "@/modules/audit/audit.service";
import { Building } from "@/modules/buildings/entities/building.entity";
import {
  CreateReviewDto,
  ListReviewsQueryDto,
  MyReviewsQueryDto,
  ReviewDecisionDto,
  ReviewQueueQueryDto,
  UpdateReviewDto,
} from "@/modules/reviews/dto/review.dto";
import { Review } from "@/modules/reviews/entities/review.entity";

/** "Nusrat Jahan" -> "Nusrat J." (public reviews never show full names or emails) */
export const displayName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1
    ? `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
    : parts[0];
};

const OPEN_FOR_EDIT = [ReviewStatus.PENDING, ReviewStatus.REJECTED];

const toView = (r: Review) => ({
  id: r.id,
  buildingId: r.buildingId,
  rating: r.rating,
  title: r.title,
  body: r.body,
  visitDate: r.visitDate,
  featuresUsed: r.featuresUsed,
  status: r.status,
  moderatorNote: r.moderatorNote,
  createdAt: r.createdAt,
  decidedAt: r.decidedAt,
});

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review) private readonly reviews: Repository<Review>,
    @InjectRepository(Building)
    private readonly buildings: Repository<Building>,
    private readonly audit: AuditService,
  ) {}

  private assertNotFuture(visitDate?: string) {
    if (visitDate && new Date(visitDate).getTime() > Date.now() + 86_400_000)
      throw new BadRequestException("visitDate cannot be in the future");
  }

  async create(user: AuthUser, buildingId: string, dto: CreateReviewDto) {
    this.assertNotFuture(dto.visitDate);
    const b = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });
    if (!b) throw new NotFoundException("Building not found");
    const pending = await this.reviews.count({
      where: { userId: user.id, buildingId, status: ReviewStatus.PENDING },
    });
    if (pending >= 1)
      throw new ConflictException(
        "You already have a review for this building waiting for moderation",
      );
    const r = await this.reviews.save(
      this.reviews.create({
        buildingId,
        userId: user.id,
        rating: dto.rating,
        title: dto.title || null,
        body: dto.body,
        visitDate: dto.visitDate.slice(0, 10),
        featuresUsed: dto.featuresUsed ?? [],
      }),
    );
    await this.audit.log({
      actorUserId: user.id,
      action: "REVIEW_SUBMITTED",
      entityType: "review",
      entityId: r.id,
    });
    return toView(r);
  }


  async listPublic(buildingId: string, q: ListReviewsQueryDto) {
    const b = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });
    if (!b) throw new NotFoundException("Building not found");

    const qb = this.reviews
      .createQueryBuilder("r")
      .innerJoin("r.user", "u")
      .addSelect(["u.id", "u.fullName"])
      .where("r.buildingId = :buildingId AND r.status = :s", {
        buildingId,
        s: ReviewStatus.APPROVED,
      });
    if (q.sort === "high")
      qb.orderBy("r.rating", "DESC").addOrderBy("r.createdAt", "DESC");
    else if (q.sort === "low")
      qb.orderBy("r.rating", "ASC").addOrderBy("r.createdAt", "DESC");
    else qb.orderBy("r.createdAt", "DESC");
    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();

    const dist: { rating: number; count: number }[] = await this.reviews
      .createQueryBuilder("r")
      .select("r.rating", "rating")
      .addSelect("COUNT(*)::int", "count")
      .where("r.buildingId = :buildingId AND r.status = :s", {
        buildingId,
        s: ReviewStatus.APPROVED,
      })
      .groupBy("r.rating")
      .getRawMany();
    const breakdown: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;
    let count = 0;
    for (const d of dist) {
      breakdown[d.rating] = Number(d.count);
      sum += d.rating * Number(d.count);
      count += Number(d.count);
    }

    return {
      ...paginated(
        rows.map((r) => ({
          ...toView(r),
          moderatorNote: undefined,
          status: undefined,
          author: displayName(r.user!.fullName),
        })),
        total,
        q,
      ),
      summary: {
        average: count ? Math.round((sum / count) * 10) / 10 : null,
        count,
        breakdown,
      },
    };
  }


  async summaries(buildingIds: string[]) {
    const map = new Map<string, { average: number | null; count: number }>();
    if (!buildingIds.length) return map;
    const rows: { id: string; avg: string; cnt: string }[] = await this.reviews
      .createQueryBuilder("r")
      .select("r.buildingId", "id")
      .addSelect("AVG(r.rating)", "avg")
      .addSelect("COUNT(*)", "cnt")
      .where("r.buildingId IN (:...ids) AND r.status = :s", {
        ids: buildingIds,
        s: ReviewStatus.APPROVED,
      })
      .groupBy("r.buildingId")
      .getRawMany();
    for (const r of rows)
      map.set(r.id, {
        average: Math.round(Number(r.avg) * 10) / 10,
        count: Number(r.cnt),
      });
    return map;
  }

  async listMine(user: AuthUser, q: MyReviewsQueryDto) {
    const qb = this.reviews
      .createQueryBuilder("r")
      .innerJoin("r.building", "b")
      .addSelect(["b.id", "b.name"])
      .where("r.userId = :uid", { uid: user.id })
      .orderBy("r.createdAt", "DESC");
    if (q.status) qb.andWhere("r.status = :s", { s: q.status });
    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();
    return paginated(
      rows.map((r) => ({
        ...toView(r),
        building: { id: r.building!.id, name: r.building!.name },
      })),
      total,
      q,
    );
  }

  async update(user: AuthUser, id: string, dto: UpdateReviewDto) {
    this.assertNotFuture(dto.visitDate);
    const r = await this.reviews.findOne({ where: { id, userId: user.id } });
    if (!r) throw new NotFoundException("Review not found");
    if (!OPEN_FOR_EDIT.includes(r.status))
      throw new ConflictException(
        "Published reviews cannot be edited. Remove it and write a new one instead.",
      );
    if (dto.rating !== undefined) r.rating = dto.rating;
    if (dto.title !== undefined) r.title = dto.title || null;
    if (dto.body !== undefined) r.body = dto.body;
    if (dto.visitDate !== undefined) r.visitDate = dto.visitDate.slice(0, 10);
    if (dto.featuresUsed !== undefined) r.featuresUsed = dto.featuresUsed;
    r.status = ReviewStatus.PENDING; 
    r.moderatorNote = null;
    await this.reviews.save(r);
    return toView(r);
  }

  async remove(user: AuthUser, id: string) {
    const res = await this.reviews.delete({ id, userId: user.id });
    if (!res.affected) throw new NotFoundException("Review not found");
    await this.audit.log({
      actorUserId: user.id,
      action: "REVIEW_REMOVED",
      entityType: "review",
      entityId: id,
    });
    return { message: "Review removed" };
  }

  async queue(q: ReviewQueueQueryDto) {
    const status = q.status ?? ReviewStatus.PENDING;
    const qb = this.reviews
      .createQueryBuilder("r")
      .innerJoin("r.building", "b")
      .addSelect(["b.id", "b.name"])
      .innerJoin("r.user", "u")
      .addSelect(["u.id", "u.fullName"])
      .orderBy("r.createdAt", status === ReviewStatus.PENDING ? "ASC" : "DESC");
    if (status !== "ALL") qb.where("r.status = :s", { s: status });
    if (q.buildingId) qb.andWhere("r.buildingId = :bid", { bid: q.buildingId });
    const [rows, total] = await qb
      .skip(skipOf(q))
      .take(q.limit)
      .getManyAndCount();
    return paginated(
      rows.map((r) => ({
        ...toView(r),
        building: { id: r.building!.id, name: r.building!.name },
        author: { id: r.user!.id, fullName: r.user!.fullName },
      })),
      total,
      q,
    );
  }

  async decide(moderator: AuthUser, id: string, dto: ReviewDecisionDto) {
    const r = await this.reviews.findOne({ where: { id } });
    if (!r) throw new NotFoundException("Review not found");
    if (r.userId === moderator.id)
      throw new ForbiddenException("You cannot moderate your own review");
    if (r.status !== ReviewStatus.PENDING)
      throw new ConflictException(
        `Only PENDING reviews can be decided (this one is ${r.status})`,
      );
    r.status = dto.decision;
    r.moderatorNote =
      dto.decision === ReviewStatus.REJECTED ? (dto.note ?? null) : null;
    r.decidedAt = new Date();
    await this.reviews.save(r);
    await this.audit.log({
      actorUserId: moderator.id,
      action: `REVIEW_${dto.decision}`,
      entityType: "review",
      entityId: id,
    });
    return toView(r);
  }

  async countsByStatus() {
    const rows: { s: string; c: number }[] = await this.reviews
      .createQueryBuilder("r")
      .select("r.status", "s")
      .addSelect("COUNT(*)::int", "c")
      .groupBy("r.status")
      .getRawMany();
    return Object.fromEntries(rows.map((x) => [x.s, x.c]));
  }
}
