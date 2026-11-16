import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AnalyticsService } from "@/modules/analytics/analytics.service";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get()
  overview() {
    return this.analytics.overview();
  }
}
