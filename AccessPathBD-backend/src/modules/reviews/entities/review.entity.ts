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
import { FeatureType, ReviewStatus } from "@/common/enums/accessibility.enums";
import { Building } from "@/modules/buildings/entities/building.entity";
import { User } from "@/modules/users/entities/user.entity";

/**
 * A visitor's personal experience. Reviews are OPINIONS: they never change a
 * building's verified accessibility facts (only approved reports do).
 */
@Entity("reviews")
@Check("CHK_reviews_rating", `"rating" BETWEEN 1 AND 5`)
@Index(["buildingId", "status"])
export class Review {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  buildingId!: string;

  @ManyToOne(() => Building, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "building_id" })
  building?: Building;

  @Index()
  @Column({ type: "uuid" })
  userId!: string;

  @ManyToOne(() => User, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "user_id" })
  user?: User;

  @Column({ type: "smallint" })
  rating!: number;

  @Column({ type: "varchar", length: 120, nullable: true })
  title!: string | null;

  @Column({ type: "text" })
  body!: string;

  /** Day of the visit, YYYY-MM-DD */
  @Column({ type: "date" })
  visitDate!: string;

  @Column({ type: "jsonb", default: () => "'[]'" })
  featuresUsed!: FeatureType[];

  @Column({
    type: "enum",
    enum: ReviewStatus,
    enumName: "review_status",
    default: ReviewStatus.PENDING,
  })
  status!: ReviewStatus;

  /** Moderator's explanation when a review is not published. */
  @Column({ type: "text", nullable: true })
  moderatorNote!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
