import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuditModule } from "@/modules/audit/audit.module";
import { ReviewsModule } from "@/modules/reviews/reviews.module";
import { BuildingsController } from "@/modules/buildings/buildings.controller";
import { BuildingsService } from "@/modules/buildings/buildings.service";
import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([Building, AccessibilityFeature]),
    AuditModule,
    ReviewsModule,
  ],
  controllers: [BuildingsController],
  providers: [BuildingsService],
  exports: [BuildingsService],
})
export class BuildingsModule {}
