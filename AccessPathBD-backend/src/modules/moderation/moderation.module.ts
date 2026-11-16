
import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";

import { ModerationController } from "@/modules/moderation/moderation.controller";
import { ModerationService } from "@/modules/moderation/moderation.service";

import { Report } from "@/modules/reports/entities/report.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { Verification } from "@/modules/moderation/entities/verification.entity";

import { AuditModule } from "@/modules/audit/audit.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Report,
      AccessibilityFeature,
      Verification,
    ]),
    AuditModule,
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
