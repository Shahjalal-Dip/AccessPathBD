import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { FeatureStatusService } from "@/modules/features/feature-status.service";

@Module({
  imports: [TypeOrmModule.forFeature([AccessibilityFeature])],
  providers: [FeatureStatusService],
  exports: [FeatureStatusService, TypeOrmModule],
})
export class FeaturesModule {}
