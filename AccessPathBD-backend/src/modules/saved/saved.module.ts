import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { BuildingsModule } from "@/modules/buildings/buildings.module";
import { Building } from "@/modules/buildings/entities/building.entity";
import { SavedBuilding } from "@/modules/saved/entities/saved-building.entity";
import { SavedController } from "@/modules/saved/saved.controller";
import { SavedService } from "@/modules/saved/saved.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([SavedBuilding, Building]),
    BuildingsModule,
  ],
  controllers: [SavedController],
  providers: [SavedService],
})
export class SavedModule {}
