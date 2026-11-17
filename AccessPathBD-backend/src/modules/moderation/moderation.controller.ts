import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";
import {
  DecisionDto,
  ResolveDisputeDto,
  ReviewQueueQueryDto,
} from "@/modules/moderation/dto/moderation.dto";
import { ModerationService } from "@/modules/moderation/moderation.service";

@ApiTags("Moderation")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.MODERATOR, Role.ADMIN)
@Controller("admin")
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get("reports")
  queue(@Query() q: ReviewQueueQueryDto) {
    return this.moderation.queue(q);
  }

  @Patch("reports/:id/decision")
  decide(
    @CurrentUser() moderator: AuthUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
  ) {
    return this.moderation.decide(moderator, id, dto);
  }

  @Get("disputes")
  disputes(@Query() q: PaginationQueryDto) {
    return this.moderation.disputes(q);
  }

  @HttpCode(200)
  @Post("features/:featureId/resolve-dispute")
  resolve(
    @CurrentUser() moderator: AuthUser,
    @Param("featureId", ParseUUIDPipe) featureId: string,
    @Body() dto: ResolveDisputeDto,
  ) {
    return this.moderation.resolveDispute(moderator, featureId, dto);
  }
}
