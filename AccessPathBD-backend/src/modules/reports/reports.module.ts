
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ReportsController } from "@/modules/reports/reports.controller";
import { ReportsService } from "@/modules/reports/reports.service";

import { Report } from "@/modules/reports/entities/report.entity";
import { ReportEvidence } from "@/modules/reports/entities/report-evidence.entity";

import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { Verification } from "@/modules/moderation/entities/verification.entity";

import { AuditModule } from "@/modules/audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      ReportEvidence,
      Building,
      AccessibilityFeature,
      Verification,
    ]),
    AuditModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}
