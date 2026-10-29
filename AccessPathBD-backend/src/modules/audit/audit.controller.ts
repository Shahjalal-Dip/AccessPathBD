import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AuditQueryDto } from "./dto/AuditQuery.dto";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuditService } from "@/modules/audit/audit.service";

@ApiTags("Admin")
@ApiBearerAuth()
@UseGuards(JwtGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("admin/audit-logs")
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  list(@Query() q: AuditQueryDto) {
    return this.audit.list(q, { entityType: q.entityType, action: q.action });
  }
}
