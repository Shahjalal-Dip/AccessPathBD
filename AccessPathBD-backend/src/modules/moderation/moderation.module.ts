import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { FeaturesModule } from "@/modules/features/features.module";
import { ModerationController } from "@/modules/moderation/moderation.controller";
import { ModerationService } from "@/modules/moderation/moderation.service";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import { Report } from "@/modules/reports/entities/report.entity";
import { ReportsModule } from "@/modules/reports/reports.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, Verification]),
    FeaturesModule,
    ReportsModule,
    AuditModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
})
export class ModerationModule {}
