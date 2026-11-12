import {
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from "typeorm";
import { Building } from "@/modules/buildings/entities/building.entity";
import { User } from "@/modules/users/entities/user.entity";

/** A bookmark: "Saved Buildings" in the user's dashboard. */
@Entity("saved_buildings")
export class SavedBuilding {
  @PrimaryColumn({ type: "uuid" })
  userId!: string;

  @PrimaryColumn({ type: "uuid" })
  buildingId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @ManyToOne(() => Building, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "building_id" })
  building?: Building;

  @CreateDateColumn({ type: "timestamptz" })
  savedAt!: Date;
}
