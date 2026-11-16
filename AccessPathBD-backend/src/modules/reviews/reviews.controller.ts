import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  CreateReviewDto,
  ListReviewsQueryDto,
  MyReviewsQueryDto,
  ReviewDecisionDto,
  ReviewQueueQueryDto,
  UpdateReviewDto,
} from "@/modules/reviews/dto/review.dto";
import { ReviewsService } from "@/modules/reviews/reviews.service";

@ApiTags("Reviews")
@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get("buildings/:id/reviews")
  list(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() q: ListReviewsQueryDto,
  ) {
    return this.reviews.listPublic(id, q);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Post("buildings/:id/reviews")
  @ApiBody({type: CreateReviewDto})
  create(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.reviews.create(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Get("reviews/mine")
  mine(@CurrentUser() user: AuthUser, @Query() q: MyReviewsQueryDto) {
    return this.reviews.listMine(user, q);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @ApiBody({type: UpdateReviewDto})
  @Patch("reviews/:id")
  update(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateReviewDto,
  ) {
    return this.reviews.update(user, id, dto);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard)
  @Delete("reviews/:id")
  remove(
    @CurrentUser() user: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.reviews.remove(user, id);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @Get("admin/reviews")
  queue(@Query() q: ReviewQueueQueryDto) {
    return this.reviews.queue(q);
  }

  @ApiBearerAuth()
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(Role.MODERATOR, Role.ADMIN)
  @ApiBody({type: ReviewDecisionDto})
  @Patch("admin/reviews/:id/decision")
  decide(
    @CurrentUser() moderator: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviewDecisionDto,
  ) {
    return this.reviews.decide(moderator, id, dto);
  }
}
