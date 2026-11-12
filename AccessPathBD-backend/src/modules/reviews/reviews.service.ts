
import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewDecisionDto,
} from "@/modules/reviews/dto/review.dto";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  Paginated,
  paginated,
  PaginationQueryDto,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { ReviewStatus } from "@/common/enums/accessibility.enums";
import { Building } from "@/modules/buildings/entities/building.entity";
import { Review } from "@/modules/reviews/entities/review.entity";

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviews: Repository<Review>,
    @InjectRepository(Building)
    private readonly buildings: Repository<Building>,
  ) {}

  async create(
    buildingId: string,
    dto: CreateReviewDto,
    user: AuthUser,
  ): Promise<Review> {
    const building = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });

    if (!building) throw new NotFoundException("Building not found");

    const review = this.reviews.create({
      buildingId,
      userId: user.id,
      rating: dto.rating,
      title: dto.title ?? null,
      body: dto.body,
      visitDate: dto.visitDate,
      featuresUsed: dto.featuresUsed ?? [],
      status: ReviewStatus.PENDING,
    });

    return this.reviews.save(review);
  }

  async findPublicByBuilding(
    buildingId: string,
    query: PaginationQueryDto,
    sort: "recent" | "high" | "low" = "recent",
  ): Promise<{
    reviews: Paginated<Review>;
    summary: { average: number | null; count: number };
  }> {
    const building = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });

    if (!building) throw new NotFoundException("Building not found");

    const order =
      sort === "high"
        ? { rating: "DESC" as const, createdAt: "DESC" as const }
        : sort === "low"
          ? { rating: "ASC" as const, createdAt: "DESC" as const }
          : { createdAt: "DESC" as const };

    const [rows, total] = await this.reviews.findAndCount({
      where: { buildingId, status: ReviewStatus.APPROVED },
      order,
      skip: skipOf(query),
      take: query.limit,
    });

    const result = await this.reviews
      .createQueryBuilder("review")
      .select("AVG(review.rating)", "average")
      .addSelect("COUNT(review.id)", "count")
      .where("review.buildingId = :buildingId", { buildingId })
      .andWhere("review.status = :status", {
        status: ReviewStatus.APPROVED,
      })
      .getRawOne<{ average: string | null; count: string }>();

    return {
      reviews: paginated(rows, total, query),
      summary: {
        average: result?.average
          ? Number(Number(result.average).toFixed(1))
          : null,
        count: Number(result?.count ?? 0),
      },
    };
  }

  async findMine(user: AuthUser): Promise<Review[]> {
    return this.reviews.find({
      where: { userId: user.id },
      order: { createdAt: "DESC" },
    });
  }

  async updateMine(
    reviewId: string,
    dto: UpdateReviewDto,
    user: AuthUser,
  ): Promise<Review> {
    const review = await this.reviews.findOne({
      where: { id: reviewId, userId: user.id },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (
      review.status !== ReviewStatus.PENDING &&
      review.status !== ReviewStatus.REJECTED
    ) {
      throw new ConflictException(
        "Only pending or rejected reviews can be updated",
      );
    }

    Object.assign(review, dto);
    review.status = ReviewStatus.PENDING;
    review.moderatorNote = null;
    review.decidedAt = null;

    return this.reviews.save(review);
  }

  async deleteMine(
    reviewId: string,
    user: AuthUser,
  ): Promise<void> {
    const review = await this.reviews.findOne({
      where: { id: reviewId, userId: user.id },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    await this.reviews.remove(review);
  }

  async findAdminReviews(
    query: PaginationQueryDto,
    status?: ReviewStatus,
  ): Promise<Paginated<Review>> {
    const [rows, total] = await this.reviews.findAndCount({
      where: status ? { status } : {},
      order: { createdAt: "DESC" },
      skip: skipOf(query),
      take: query.limit,
    });

    return paginated(rows, total, query);
  }

  async decide(
    reviewId: string,
    dto: ReviewDecisionDto,
  ): Promise<Review> {
    const review = await this.reviews.findOne({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundException("Review not found");
    }

    if (
      dto.status === ReviewStatus.REJECTED &&
      !dto.moderatorNote?.trim()
    ) {
      throw new ConflictException(
        "Moderator note is required when rejecting a review",
      );
    }

    review.status = dto.status;
    review.moderatorNote = dto.moderatorNote?.trim() ?? null;
    review.decidedAt = new Date();

    return this.reviews.save(review);
  }

  async summaries(
    buildingIds: string[],
  ): Promise<Map<string, { average: number | null; count: number }>> {
    if (!buildingIds.length) return new Map();

    const rows = await this.reviews
      .createQueryBuilder("review")
      .select("review.buildingId", "buildingId")
      .addSelect("AVG(review.rating)", "average")
      .addSelect("COUNT(review.id)", "count")
      .where("review.buildingId IN (:...buildingIds)", { buildingIds })
      .andWhere("review.status = :status", {
        status: ReviewStatus.APPROVED,
      })
      .groupBy("review.buildingId")
      .getRawMany<{
        buildingId: string;
        average: string | null;
        count: string;
      }>();

    return new Map(
      rows.map((row) => [
        row.buildingId,
        {
          average: row.average
            ? Number(Number(row.average).toFixed(1))
            : null,
          count: Number(row.count),
        },
      ]),
    );
  }
}


