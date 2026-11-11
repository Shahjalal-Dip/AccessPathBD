import { Injectable, NotFoundException } from "@nestjs/common";
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
        average: result?.average ? Number(Number(result.average).toFixed(1)) : null,
        count: Number(result?.count ?? 0),
      },
    };
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
