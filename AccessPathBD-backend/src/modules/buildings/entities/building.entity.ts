import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from "typeorm";
import { BuildingCategory } from "@/common/enums/accessibility.enums";
import { User } from "@/modules/users/entities/user.entity";

const numeric = {
  to: (v?: number | null) => v,
  from: (v?: string | null) =>
    v === null || v === undefined ? null : Number(v),
};

@Entity("buildings")
@Check(
  "CHK_buildings_lat_range",
  `"latitude" IS NULL OR "latitude" BETWEEN -90 AND 90`,
)
@Check(
  "CHK_buildings_lng_range",
  `"longitude" IS NULL OR "longitude" BETWEEN -180 AND 180`,
)
@Index(["name", "address"], { unique: true })
export class Building {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ length: 200 })
  name!: string;

  @Column({ type: "text", nullable: true })
  description!: string | null;

  @Column({ length: 300 })
  address!: string;

  @Index()
  @Column({
    type: "enum",
    enum: BuildingCategory,
    enumName: "building_category",
    default: BuildingCategory.OTHER,
  })
  category!: BuildingCategory;

  @Column({
    type: "numeric",
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numeric,
  })
  latitude!: number | null;

  @Column({
    type: "numeric",
    precision: 9,
    scale: 6,
    nullable: true,
    transformer: numeric,
  })
  longitude!: number | null;

  /** File name of the cover photo inside COVER_DIR (server-generated). Null = no cover. */
  @Column({ type: "varchar", length: 80, nullable: true })
  coverImage!: string | null;

  @Column({ type: "uuid", nullable: true })
  createdById!: string | null;

  @ManyToOne(() => User, { onDelete: "SET NULL", nullable: true })
  @JoinColumn({ name: "created_by_id" })
  createdBy?: User | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
