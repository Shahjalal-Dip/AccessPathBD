import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { ReviewsService } from "@/modules/reviews/reviews.service";

@ApiTags("Reviews")
@Controller("buildings/:buildingId/reviews")
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  findPublicByBuilding(
    @Param("buildingId", ParseUUIDPipe) buildingId: string,
    @Query() query: PaginationQueryDto,
    @Query("sort") sort: "recent" | "high" | "low" = "recent",
  ) {
    return this.reviews.findPublicByBuilding(buildingId, query, sort);
  }
}