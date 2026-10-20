import {
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
  FeatureType,
  VerificationStatus,
} from "@/common/enums/accessibility.enums";
import { Building } from "@/modules/buildings/entities/building.entity";

/**
 * One row per (building, feature type). status / verificationStatus /
 * lastObservedAt are DERIVED from approved reports by FeatureStatusService
 * and must never be edited directly. STALE is never stored (see util).
 */
@Entity("accessibility_features")
@Index(["buildingId", "featureType"], { unique: true })
@Index(["featureType", "status"])
export class AccessibilityFeature {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: "uuid" })
  buildingId!: string;

  @ManyToOne(() => Building, { onDelete: "CASCADE", nullable: false })
  @JoinColumn({ name: "building_id" })
  building?: Building;

  @Column({ type: "enum", enum: FeatureType, enumName: "feature_type" })
  featureType!: FeatureType;

  @Column({
    type: "enum",
    enum: FeatureStatus,
    enumName: "feature_status",
    default: FeatureStatus.UNKNOWN,
  })
  status!: FeatureStatus;

  @Column({
    type: "enum",
    enum: VerificationStatus,
    enumName: "verification_status",
    default: VerificationStatus.UNVERIFIED,
  })
  verificationStatus!: VerificationStatus;

  @Column({ type: "text", nullable: true })
  details!: string | null;

  @Column({ type: "timestamptz", nullable: true })
  lastObservedAt!: Date | null;

  @Column({ type: "timestamptz", nullable: true })
  lastVerifiedAt!: Date | null;

  @CreateDateColumn({ type: "timestamptz" })
  createdAt!: Date;

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt!: Date;
}
