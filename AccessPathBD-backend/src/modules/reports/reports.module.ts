import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { Building } from "@/modules/buildings/entities/building.entity";
import { FeaturesModule } from "@/modules/features/features.module";
import { Verification } from "@/modules/moderation/entities/verification.entity";
import { ReportEvidence } from "@/modules/reports/entities/report-evidence.entity";
import { Report } from "@/modules/reports/entities/report.entity";
import {
  BuildingHistoryController,
  ReportsController,
} from "@/modules/reports/reports.controller";
import { ReportsService } from "@/modules/reports/reports.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([Report, ReportEvidence, Building, Verification]),
    FeaturesModule,
    AuditModule,
  ],
  controllers: [ReportsController, BuildingHistoryController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
