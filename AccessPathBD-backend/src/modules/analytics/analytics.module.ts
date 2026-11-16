import { Module } from "@nestjs/common";
import { AnalyticsController } from "@/modules/analytics/analytics.controller";
import { AnalyticsService } from "@/modules/analytics/analytics.service";

@Module({ controllers: [AnalyticsController], providers: [AnalyticsService] })
export class AnalyticsModule {}
