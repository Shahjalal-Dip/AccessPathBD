import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditController } from "@/modules/audit/audit.controller";
import { AuditService } from "@/modules/audit/audit.service";
import { AuditLog } from "@/modules/audit/entities/audit-log.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AuditLog])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
