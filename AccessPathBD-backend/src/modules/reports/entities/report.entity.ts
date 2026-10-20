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
import {
  FeatureStatus,
  ModerationStatus,
} from "@/common/enums/accessibility.enums";
import { Building } from "@/modules/buildings/entities/building.entity";
import { AccessibilityFeature } from "@/modules/features/entities/accessibility-feature.entity";
import { User } from "@/modules/users/entities/user.entity";

@Entity("reports")
@Check(
  "CHK_reports_observation_not_unknown",
  `"observation_status" <> 'UNKNOWN'`,
)
@Index(["featureId", "moderationStatus"])
@Index(["moderationStatus", "createdAt"])
@Index(["buildingId", "moderationStatus"])
export class Report {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  buildingId!: string;

  @ManyToOne(() => Building, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "building_id" })
  building?: Building;

  @Column({ type: "uuid" })
  featureId!: string;

  @ManyToOne(() => AccessibilityFeature, {
    onDelete: "CASCADE",
    nullable: false,
  })
  @JoinColumn({ name: "feature_id" })
  feature?: AccessibilityFeature;

  @Index()
  @Column({ type: "uuid" })
  submittedById!: string;

  @ManyToOne(() => User, { onDelete: "RESTRICT", nullable: false })
  @JoinColumn({ name: "submitted_by_id" })
  submittedBy?: User;

  @Column({ type: "enum", enum: FeatureStatus, enumName: "observation_status" })
  observationStatus!: FeatureStatus;

  @Column({ type: "text" })
  description!: string;

  /** When the contributor actually saw the condition (not when they submitted). */
  @Column({ type: "timestamptz" })
  observedAt!: Date;

  @Column({
    type: "enum",
    enum: ModerationStatus,
    enumName: "moderation_status",
    default: ModerationStatus.PENDING,
  })
  moderationStatus!: ModerationStatus;

  /** Time of the latest moderation decision on this report. */
  @Column({ type: "timestamptz", nullable: true })
  decidedAt!: Date | null;

  /** "submitted_at" in the proposal. */
  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
