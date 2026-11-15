import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import {
  paginated,
  PaginationQueryDto,
  skipOf,
} from "@/common/dto/pagination-query.dto";
import { BuildingsService } from "@/modules/buildings/buildings.service";
import { Building } from "@/modules/buildings/entities/building.entity";
import { SavedBuilding } from "@/modules/saved/entities/saved-building.entity";

@Injectable()
export class SavedService {
  constructor(
    @InjectRepository(SavedBuilding)
    private readonly saved: Repository<SavedBuilding>,
    @InjectRepository(Building)
    private readonly buildings: Repository<Building>,
    private readonly buildingViews: BuildingsService,
  ) {}

  /** Just the ids, so the UI can show which "Save" buttons are already on. */
  async ids(userId: string) {
    const rows = await this.saved.find({
      where: { userId },
      select: { buildingId: true },
    });
    return rows.map((r) => r.buildingId);
  }

  async list(userId: string, q: PaginationQueryDto) {
    const [rows, total] = await this.saved.findAndCount({
      where: { userId },
      relations: { building: true },
      order: { savedAt: "DESC" },
      skip: skipOf(q),
      take: q.limit,
    });
    const views = await this.buildingViews.toViews(
      rows.map((r) => r.building!),
    );
    return paginated(
      views.map((v, i) => ({ ...v, savedAt: rows[i].savedAt })),
      total,
      q,
    );
  }

  /** Idempotent: saving twice is fine. */
  async save(userId: string, buildingId: string) {
    const b = await this.buildings.findOne({
      where: { id: buildingId },
      select: { id: true },
    });
    if (!b) throw new NotFoundException("Building not found");
    await this.saved
      .createQueryBuilder()
      .insert()
      .values({ userId, buildingId })
      .orIgnore()
      .execute();
    return { saved: true };
  }

  async remove(userId: string, buildingId: string) {
    await this.saved.delete({ userId, buildingId });
    return { saved: false };
  }
}
