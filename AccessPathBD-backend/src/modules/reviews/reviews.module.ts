import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { Building } from "@/modules/buildings/entities/building.entity";
import { Review } from "@/modules/reviews/entities/review.entity";
import { ReviewsController } from "@/modules/reviews/reviews.controller";
import { ReviewsService } from "@/modules/reviews/reviews.service";

@Module({
  imports: [TypeOrmModule.forFeature([Review, Building])],
  controllers: [ReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}