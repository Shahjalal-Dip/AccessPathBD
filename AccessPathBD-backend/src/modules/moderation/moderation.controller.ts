
import {
  Controller,
  Get,
  Patch,
  Post,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  UseGuards,
} from "@nestjs/common";

import { CurrentUser } from "@/common/decorators/current-user.decorator";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuthUser } from "@/common/interfaces/auth-user.interface";

import { ModerationService } from "@/modules/moderation/moderation.service";

import {
  DecisionDto,
  ResolveDisputeDto,
  ReviewQueueQueryDto,
} from "@/modules/moderation/dto/moderation.dto";

@Controller("admin")
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.MODERATOR, Role.ADMIN)
export class ModerationController {
  constructor(
    private readonly moderationService: ModerationService,
  ) {}

  @Get("reports")
  getQueue(@Query() query: ReviewQueueQueryDto) {
    return this.moderationService.getQueue(query);
  }

  @Patch("reports/:id/decision")
  decide(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: DecisionDto,
    @CurrentUser() moderator: AuthUser,
  ) {
    return this.moderationService.decide(
      id,
      dto,
      moderator,
    );
  }

  @Get("disputes")
  getDisputes(@Query() query: ReviewQueueQueryDto) {
    return this.moderationService.getDisputes(query);
  }

  @Post("features/:id/resolve-dispute")
  resolveDispute(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() moderator: AuthUser,
  ) {
    return this.moderationService.resolveDispute(
      id,
      dto,
      moderator,
    );
  }
}
