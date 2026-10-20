import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";
import { PaginationQueryDto } from "@/common/dto/pagination-query.dto";
import { Roles } from "@/common/decorators/roles.decorator";
import { Role } from "@/common/enums/role.enum";
import { JwtGuard, RolesGuard } from "@/common/guard";
import { AuditService } from "@/modules/audit/audit.service";

class AuditQueryDto extends PaginationQueryDto {
  @IsOptional() @IsString() @MaxLength(64) entityType?: string;
  @IsOptional() @IsString() @MaxLength(64) action?: string;
}

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
