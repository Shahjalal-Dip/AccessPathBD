
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  Patch,
  Delete,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  CreateReviewDto,
  UpdateReviewDto,
  ReviewDecisionDto,
} from "@/modules/reviews/dto/review.dto";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { ReviewStatus } from "@/common/enums/accessibility.enums";
import { ReviewsService } from "@/modules/reviews/reviews.service";

@ApiTags("Reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get("buildings/:buildingId/reviews")
  findPublicByBuilding(
    @Param("buildingId", ParseUUIDPipe) buildingId: string,
    @Query() query: PaginationQueryDto,
    @Query("sort") sort: "recent" | "high" | "low" = "recent",
  ) {
    return this.reviews.findPublicByBuilding(buildingId, query, sort);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.CONTRIBUTOR)
  @Post("buildings/:buildingId/reviews")
  create(
    @Param("buildingId", ParseUUIDPipe) buildingId: string,
    @Body() dto: CreateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.create(buildingId, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get("reviews/mine")
  findMine(@CurrentUser() user: AuthUser) {
    return this.reviews.findMine(user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Patch("reviews/:id")
  updateMine(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.updateMine(id, dto, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Delete("reviews/:id")
  deleteMine(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.deleteMine(id, user);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get("admin/reviews")
  findAdminReviews(
    @Query() query: PaginationQueryDto,
    @Query("status") status?: ReviewStatus,
  ) {
    return this.reviews.findAdminReviews(query, status);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Patch("admin/reviews/:id/decision")
  decide(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.reviews.decide(id, dto);
  }
}

